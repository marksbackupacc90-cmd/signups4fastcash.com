import dotenv from 'dotenv';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { SEED_PREFIX, seedCampaigns, seedProfiles } from './seed-config.mjs';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL?.trim();
const teardown = process.argv.includes('--teardown');

if (!databaseUrl) {
  console.error(JSON.stringify({ status: 'skipped', reason: 'DATABASE_URL is not configured.' }));
  process.exit(teardown ? 0 : 1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const seedPrefix = SEED_PREFIX;
const profiles = seedProfiles;
const campaigns = seedCampaigns.map((campaign) => ({
  id: campaign.id,
  title: campaign.title,
  description: `Seed campaign: ${campaign.title}`,
  category: campaign.category,
  total: campaign.totalValue,
  milestones: campaign.milestones.map((milestone) => ({
    step_number: milestone.stepNumber,
    level: milestone.level,
    payout_amount: milestone.payoutAmount,
    description: milestone.description,
  })),
}));

function trackingHash(username) {
  return createHash('sha256').update(`seed-tracking:${username}`).digest('hex');
}

async function teardownSeedData(client) {
  await client.query('BEGIN');
  await client.query(
    `DELETE FROM offer_milestone_tiers
     WHERE offer_id LIKE $1`,
    [`${seedPrefix}%`],
  );
  await client.query(
    `DELETE FROM offer_campaigns
     WHERE id LIKE $1`,
    [`${seedPrefix}%`],
  );
  await client.query(
    `DELETE FROM offers
     WHERE id LIKE $1`,
    [`${seedPrefix}%`],
  );
  await client.query(
    `DELETE FROM users
     WHERE username LIKE $1`,
    [`${seedPrefix}%`],
  );
  await client.query('COMMIT');
  console.log(JSON.stringify({ status: 'teardown_complete', prefix: seedPrefix }));
}

async function seedDatabase(client) {
  await client.query('BEGIN');
  for (const campaign of campaigns) {
    await client.query(
      `INSERT INTO offer_campaigns
        (id, title, description, category, total_value, milestones, tracking_parameters, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, '{}'::jsonb, TRUE, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         total_value = EXCLUDED.total_value,
         milestones = EXCLUDED.milestones,
         active = TRUE,
         updated_at = NOW()`,
      [
        campaign.id,
        campaign.title,
        campaign.description,
        campaign.category,
        campaign.total,
        JSON.stringify(campaign.milestones),
      ],
    );
    const publicOffer = {
      id: campaign.id,
      company: campaign.title,
      companySlug: campaign.id.replace(/^seed_s4fc_/, ''),
      title: campaign.title,
      category: campaign.category,
      incentiveAmount: `$${campaign.total.toFixed(2)} seed milestone reward`,
      incentiveValue: campaign.total,
      payoutSpeed: 'Mock postback verification',
      difficulty: 'Easy (seed profile)',
      depositRequired: '$0 (seed test only)',
      availability: 'Development seed only',
      honestTruth: {
        summary: `Development seed campaign for ${campaign.title}.`,
        theCatch: 'This is mock test data and must not be used as an active public offer.',
        minimumHoldTime: 'No real payout hold.',
        idVerificationRequired: false,
        hiddenFeesWarning: 'No real fees or rewards.',
      },
      speedrunHints: campaign.milestones.map((milestone, index) => ({
        step: index + 1,
        instruction: milestone.description,
        proTip: `Mock payout: $${milestone.payout_amount.toFixed(2)}`,
      })),
      status: 'pending',
      verificationStatus: 'terms-vary',
      updatedAt: new Date().toISOString(),
    };
    await client.query(
      `INSERT INTO offers (id, status, offer, updated_at)
       VALUES ($1, 'pending', $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         offer = EXCLUDED.offer,
         updated_at = NOW()`,
      [campaign.id, JSON.stringify(publicOffer)],
    );
  }

  for (const campaign of campaigns) {
    await client.query(
      `DELETE FROM offer_milestone_tiers
       WHERE offer_id = $1`,
      [campaign.id],
    );
    for (const milestone of campaign.milestones) {
      await client.query(
        `INSERT INTO offer_milestone_tiers
          (offer_id, stage, level, reward_points, description, active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (offer_id, stage) DO UPDATE SET
           level = EXCLUDED.level,
           reward_points = EXCLUDED.reward_points,
           description = EXCLUDED.description,
           active = TRUE`,
        [campaign.id, milestone.step_number, milestone.level, Math.round(milestone.payout_amount * 100), milestone.description],
      );
    }
  }

  for (const [index, [name, state, balance]] of profiles.entries()) {
    const username = `${seedPrefix}${index + 1}_${name.toLowerCase()}`;
    const id = `seed-user-${index + 1}`;
    await client.query(
      `INSERT INTO users
        (id, google_sub, email, username, state, account_status, balance, affiliate_tracking_id, last_login_at, is_banned)
       VALUES ($1, NULL, $2, $3, $4, 'active', $5, $6, NOW(), FALSE)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         username = EXCLUDED.username,
         state = EXCLUDED.state,
         account_status = 'active',
         balance = EXCLUDED.balance,
         affiliate_tracking_id = EXCLUDED.affiliate_tracking_id,
         is_banned = FALSE,
         updated_at = NOW()`,
      [id, `${username}@example.test`, username, state, balance, trackingHash(username)],
    );
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ status: 'seed_complete', campaigns: campaigns.length, users: profiles.length }));
}

const client = await pool.connect();
try {
  if (teardown) await teardownSeedData(client);
  else await seedDatabase(client);
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(JSON.stringify({ status: 'failed', error: error instanceof Error ? error.message : 'Unknown seed error' }));
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
