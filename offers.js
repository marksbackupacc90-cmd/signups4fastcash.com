import express from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const COINS_PER_USD = 1000;

function safeHexEqual(left, right) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  if (left.length !== right.length) return false;
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function canonicalSignaturePayload(params) {
  return Object.keys(params)
    .filter((key) => !['signature', 'sig', 'hash'].includes(key.toLowerCase()))
    .sort()
    .map((key) => `${key}=${String(params[key]).trim()}`)
    .join('&');
}

function validateLootablySignature(params, suppliedSignature, secret, req) {
  if (!secret || !suppliedSignature) return false;
  if (!/^[a-f0-9]{64}$/i.test(suppliedSignature)) return false;

  const candidates = [
    canonicalSignaturePayload(params),
    [
      params.transaction_id || params.txid || params.conversion_id,
      params.user_id || params.subid || params.user,
      params.offer_id || params.offer || '',
      params.payout_usd || params.payout || params.reward || '0',
    ].join('.'),
  ];

  const headerPayload = req?.header?.('X-Lootably-Signature-Payload');
  if (typeof headerPayload === 'string' && headerPayload.trim()) candidates.push(headerPayload.trim());

  return candidates.some((payload) => {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    return safeHexEqual(expected, suppliedSignature);
  });
}

export function createOffersRouter({
  database,
  requireAdmin,
  liveOffersStore,
  offerCampaignsStore,
  validateOfferCampaign,
  persistOfferCampaign,
  auditAdminAction,
  handleAffiliatePostback,
}) {
  const router = express.Router();

  router.get('/api/v1/callbacks/postback', handleAffiliatePostback);
  router.post('/api/v1/callbacks/postback', handleAffiliatePostback);

  const handleLootablyPostback = async (req, res) => {
    const params = req.method === 'GET' ? req.query : req.body;
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      return res.status(400).json({ error: 'Invalid Lootably postback.' });
    }

    const transactionId = String(
      params.transaction_id || params.txid || params.conversion_id || '',
    ).trim();
    const userId = String(params.user_id || params.subid || params.user || '').trim();
    const offerName = String(params.offer_name || params.offer || 'Lootably offer').trim();
    const payoutText = String(params.payout_usd || params.payout || params.reward || '').trim();
    const signature = String(
      params.signature || params.sig || req.header('X-Lootably-Signature') || '',
    ).trim();
    const secret = process.env.LOOTABLY_POSTBACK_SECRET?.trim();

    if (!transactionId || transactionId.length > 191) {
      return res.status(400).json({ error: 'A valid transaction ID is required.' });
    }
    if (!userId || userId.length > 255) {
      return res.status(400).json({ error: 'A valid user ID is required.' });
    }
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(payoutText)) {
      return res.status(400).json({ error: 'A valid payout is required.' });
    }

    const payoutUsd = Number(payoutText);
    const coins = Math.round(payoutUsd * COINS_PER_USD);
    if (!Number.isFinite(payoutUsd) || payoutUsd <= 0 || coins < 1 || coins > 2147483647) {
      return res.status(400).json({ error: 'The payout is outside the supported range.' });
    }
    if (!validateLootablySignature(params, signature, secret, req)) {
      return res.status(401).json({ error: 'Invalid Lootably signature.' });
    }
    if (!database) {
      return res.status(503).json({ error: 'Payout storage is unavailable.' });
    }

    let client;
    try {
      client = await database.connect();
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT transaction_id, user_id, status, payout_usd, coins
           FROM payout_logs
          WHERE transaction_id = $1
          FOR UPDATE`,
        [transactionId],
      );
      if (existing.rows[0]) {
        const prior = existing.rows[0];
        if (
          prior.user_id !== userId ||
          Math.round(Number(prior.payout_usd) * COINS_PER_USD) !== coins
        ) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Transaction conflicts with an existing payout.' });
        }
        await client.query('COMMIT');
        return res.status(200).json({ success: true, duplicate: true, coins });
      }

      const account = await client.query(
        `SELECT id
           FROM users
          WHERE id = $1
            AND account_status = 'active'
            AND is_banned = FALSE
          FOR UPDATE`,
        [userId],
      );
      if (!account.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Eligible user account not found.' });
      }

      const inserted = await client.query(
        `INSERT INTO payout_logs
          (transaction_id, user_id, offerwall, offer_name, payout_usd, coins, status)
         VALUES ($1, $2, 'Lootably', $3, $4, $5, 'pending')
         ON CONFLICT (transaction_id) DO NOTHING
         RETURNING id`,
        [transactionId, userId, offerName.slice(0, 255), payoutUsd, coins],
      );
      if (!inserted.rows[0]) {
        const conflict = await client.query(
          `SELECT transaction_id, user_id, payout_usd
             FROM payout_logs
            WHERE transaction_id = $1`,
          [transactionId],
        );
        const prior = conflict.rows[0];
        if (
          !prior ||
          prior.user_id !== userId ||
          Math.round(Number(prior.payout_usd) * COINS_PER_USD) !== coins
        ) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Transaction conflicts with an existing payout.' });
        }
        await client.query('COMMIT');
        return res.status(200).json({ success: true, duplicate: true, coins });
      }
      await client.query(
        `INSERT INTO survey_reward_balances (user_id, points)
         VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      const credited = await client.query(
        `UPDATE survey_reward_balances
            SET points = points + $2,
                updated_at = NOW()
          WHERE user_id = $1
            AND points + $2 BETWEEN 0 AND 2147483647
          RETURNING points`,
        [userId, coins],
      );
      if (!credited.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Coin balance limit exceeded.' });
      }

      await client.query(
        `UPDATE payout_logs
            SET status = 'credited',
                coins = $2,
                credited_at = NOW()
          WHERE transaction_id = $1`,
        [transactionId, coins],
      );
      await client.query('COMMIT');
      return res.status(200).json({ success: true, duplicate: false, coins });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => undefined);
      console.error('Could not process Lootably postback:', error);
      return res.status(500).json({ error: 'Payout could not be processed.' });
    } finally {
      if (client) client.release();
    }
  };

  router.get('/api/callbacks/lootably', handleLootablyPostback);
  router.post('/api/callbacks/lootably', handleLootablyPostback);
  router.post('/api/v1/callbacks/lootably', handleLootablyPostback);

  router.get('/api/admin/offers', requireAdmin, async (_req, res) => {
    try {
      let campaigns = [...offerCampaignsStore.values()];
      if (database) {
        const result = await database.query(
          `SELECT id, title, description, category, total_value, milestones,
                  tracking_parameters, active, created_at, updated_at
             FROM offer_campaigns
            ORDER BY updated_at DESC`,
        );
        campaigns = result.rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          category: row.category,
          total_value: Number(row.total_value),
          milestones: row.milestones,
          tracking_parameters: row.tracking_parameters,
          active: row.active,
          created_at: new Date(row.created_at).toISOString(),
          updated_at: new Date(row.updated_at).toISOString(),
        }));
      }
      return res.json({ offers: liveOffersStore, campaigns });
    } catch (error) {
      console.error('Could not load admin offer campaigns:', error);
      return res.status(500).json({ error: 'Could not load offer campaigns.' });
    }
  });

  router.post('/api/admin/offers', requireAdmin, async (req, res) => {
    if (!database) return res.status(503).json({ error: 'Campaign management requires persistent database storage.' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Campaign details are required.' });
    }

    const allowedFields = new Set(['id', 'title', 'description', 'category', 'total_value', 'milestones', 'tracking_parameters']);
    const unexpectedField = Object.keys(req.body).find((field) => !allowedFields.has(field));
    if (unexpectedField) return res.status(400).json({ field: unexpectedField, error: 'This campaign field cannot be set.' });
    if (req.body.id !== undefined && typeof req.body.id !== 'string') {
      return res.status(400).json({ field: 'id', error: 'Campaign ID must be text.' });
    }

    const id = typeof req.body.id === 'string' ? req.body.id.trim() : `campaign-${randomUUID()}`;
    if (offerCampaignsStore.has(id) || liveOffersStore.some((offer) => offer.id === id)) {
      return res.status(409).json({ field: 'id', error: 'This campaign ID is already in use.' });
    }

    const now = new Date().toISOString();
    const validation = validateOfferCampaign(req.body, id, now, now);
    if ('error' in validation) return res.status(400).json({ field: validation.field, error: validation.error });

    try {
      await persistOfferCampaign(validation.campaign, true, true);
      offerCampaignsStore.set(id, validation.campaign);
      await auditAdminAction(req, 'offer_campaign_created', { campaignId: id });
      return res.status(201).json({ campaign: validation.campaign });
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(409).json({ field: 'id', error: 'This campaign ID or milestone is already in use.' });
      }
      console.error('Could not create offer campaign:', error);
      return res.status(500).json({ error: 'Could not create offer campaign.' });
    }
  });

  router.put('/api/admin/offers/:id', requireAdmin, async (req, res) => {
    if (!database) return res.status(503).json({ error: 'Campaign management requires persistent database storage.' });
    const existing = offerCampaignsStore.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Offer campaign not found.' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Campaign updates are required.' });
    }

    const allowedFields = new Set(['title', 'description', 'category', 'total_value', 'milestones', 'tracking_parameters', 'milestone']);
    const unexpectedField = Object.keys(req.body).find((field) => !allowedFields.has(field));
    if (unexpectedField) return res.status(400).json({ field: unexpectedField, error: 'This campaign field cannot be updated.' });
    if (req.body.milestone !== undefined && req.body.milestones !== undefined) {
      return res.status(400).json({ field: 'milestones', error: 'Update either one milestone or the complete milestone list.' });
    }

    const candidate = {
      title: Object.prototype.hasOwnProperty.call(req.body, 'title') ? req.body.title : existing.title,
      description: Object.prototype.hasOwnProperty.call(req.body, 'description') ? req.body.description : existing.description,
      category: Object.prototype.hasOwnProperty.call(req.body, 'category') ? req.body.category : existing.category,
      total_value: Object.prototype.hasOwnProperty.call(req.body, 'total_value') ? req.body.total_value : existing.total_value,
      milestones: Object.prototype.hasOwnProperty.call(req.body, 'milestones') ? req.body.milestones : existing.milestones,
      tracking_parameters: Object.prototype.hasOwnProperty.call(req.body, 'tracking_parameters')
        ? req.body.tracking_parameters
        : existing.tracking_parameters,
    };

    let replaceMilestones = req.body.milestones !== undefined || req.body.milestone !== undefined;
    if (req.body.milestone !== undefined) {
      if (!req.body.milestone || typeof req.body.milestone !== 'object' || Array.isArray(req.body.milestone)) {
        return res.status(400).json({ field: 'milestone', error: 'Milestone updates must be an object.' });
      }
      const stepNumber = req.body.milestone.step_number;
      if (typeof stepNumber !== 'number' || !Number.isSafeInteger(stepNumber)) {
        return res.status(400).json({ field: 'milestone.step_number', error: 'Provide a valid step_number.' });
      }
      if (req.body.milestone.description === undefined && req.body.milestone.payout_amount === undefined) {
        return res.status(400).json({ field: 'milestone', error: 'Provide a description or payout_amount to update.' });
      }
      const tierIndex = existing.milestones.findIndex((tier) => tier.step_number === stepNumber);
      if (tierIndex < 0) return res.status(404).json({ field: 'milestone.step_number', error: 'Milestone step was not found.' });
      const milestones = [...existing.milestones];
      milestones[tierIndex] = { ...milestones[tierIndex], ...req.body.milestone };
      candidate.milestones = milestones;
    }
    if (replaceMilestones && req.body.total_value === undefined) {
      candidate.total_value = Array.isArray(candidate.milestones)
        ? candidate.milestones.reduce((sum, tier) => sum + (typeof tier?.payout_amount === 'number' ? tier.payout_amount : 0), 0)
        : existing.total_value;
    }

    const validation = validateOfferCampaign(candidate, existing.id, existing.created_at, new Date().toISOString());
    if ('error' in validation) return res.status(400).json({ field: validation.field, error: validation.error });
    validation.campaign.active = existing.active;

    try {
      await persistOfferCampaign(validation.campaign, false, replaceMilestones);
      offerCampaignsStore.set(existing.id, validation.campaign);
      await auditAdminAction(req, 'offer_campaign_updated', { campaignId: existing.id });
      return res.json({ campaign: validation.campaign });
    } catch (error) {
      console.error('Could not update offer campaign:', error);
      return res.status(500).json({ error: 'Could not update offer campaign.' });
    }
  });

  router.delete('/api/admin/offers/:id', requireAdmin, async (req, res) => {
    if (!database) return res.status(503).json({ error: 'Campaign management requires persistent database storage.' });
    const existing = offerCampaignsStore.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Offer campaign not found.' });
    const campaign = { ...existing, active: false, updated_at: new Date().toISOString() };
    try {
      await persistOfferCampaign(campaign, false, true);
      offerCampaignsStore.set(campaign.id, campaign);
      await auditAdminAction(req, 'offer_campaign_deactivated', { campaignId: campaign.id });
      return res.json({ campaign });
    } catch (error) {
      console.error('Could not deactivate offer campaign:', error);
      return res.status(500).json({ error: 'Could not deactivate offer campaign.' });
    }
  });

  return router;
}

/*
-- PostgreSQL setup
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  account_status TEXT NOT NULL DEFAULT 'active',
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offerwall TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  payout_usd NUMERIC(12, 4) NOT NULL CHECK (payout_usd > 0),
  coins INTEGER NOT NULL CHECK (coins > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'credited', 'failed')),
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payout_logs_user_id_created_at_idx
  ON payout_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payout_logs_status_created_at_idx
  ON payout_logs (status, created_at DESC);
*/
