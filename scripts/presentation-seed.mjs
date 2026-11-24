import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const CONFIRMATION = 'seed-demo-data-in-development';
const DAY_MS = 24 * 60 * 60 * 1000;
const MOCK_NAMES = [
  ['Mia', 'Carter'], ['Jay', 'Bennett'], ['Alex', 'Morgan'], ['Sam', 'Rivera'],
  ['Nora', 'Brooks'], ['Leo', 'Foster'], ['Zoe', 'Reed'], ['Eli', 'Parker'],
  ['Ava', 'Hayes'], ['Noah', 'Wells'], ['Lily', 'Price'], ['Jack', 'Cole'],
  ['Emma', 'Gray'], ['Ryan', 'Ward'], ['Chloe', 'Ross'], ['Owen', 'Kelly'],
  ['Ruby', 'James'], ['Finn', 'Bailey'], ['Ivy', 'Cooper'], ['Ezra', 'Bell'],
  ['Aria', 'Cook'], ['Theo', 'Murphy'], ['Luna', 'Diaz'], ['Kai', 'Howard'],
];
const MOCK_POINTS = [
  245, 1280, 765, 3420, 910, 1865, 530, 2740, 1150, 420, 3980, 1600,
  675, 2205, 980, 3125, 1490, 855, 2510, 575, 1820, 1055, 2875, 730,
];
const OFFERWALLS = ['Lootably', 'Torox', 'Revlum'];
const MOCK_OFFERS = [
  'Puzzle Quest - Reach Level 10', 'Word Journey - Complete Chapter 4',
  'Merge Valley - Finish 3 milestones', 'Daily Trivia - Complete a survey',
  'Garden Story - Unlock a new area', 'Number Match - Play 5 rounds',
  'City Builder - Upgrade your town hall', 'Quick Poll - Submit your answers',
];
const CHOICES = ['rock', 'paper', 'scissors'];
const REQUIRED_TABLES = [
  'users',
  'survey_reward_balances',
  'referrals',
  'rps_lobbies',
  'rps_matches',
  'rps_house_ledger',
  'live_offer_credits',
  'support_tickets',
];

export function validateSeedEnvironment(env) {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Presentation seeding is permitted only when NODE_ENV=development.');
  }
  if (env.PRESENTATION_SEED_CONFIRMATION !== CONFIRMATION) {
    throw new Error(`Set PRESENTATION_SEED_CONFIRMATION=${CONFIRMATION} to confirm this development-only seed.`);
  }
  if (!env.PRESENTATION_DATABASE_URL) {
    throw new Error('PRESENTATION_DATABASE_URL is required; DATABASE_URL is intentionally not used.');
  }

  let url;
  try {
    url = new URL(env.PRESENTATION_DATABASE_URL);
  } catch {
    throw new Error('PRESENTATION_DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('PRESENTATION_DATABASE_URL must use the postgres or postgresql protocol.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  const isClearlyDevelopmentDatabase = /(^|[-_])(dev|development|test|testing|stage|staging|local)([-_]|$)/i.test(databaseName);
  if (/prod(uction)?/i.test(`${host} ${databaseName}`)) {
    throw new Error('Production-named database targets are not permitted for presentation seeding.');
  }
  if (!isLocal && (env.PRESENTATION_SEED_ALLOW_REMOTE !== 'yes' || !isClearlyDevelopmentDatabase)) {
    throw new Error('Remote seeding requires PRESENTATION_SEED_ALLOW_REMOTE=yes and a database name marked dev, test, staging, or local.');
  }

  return { url, databaseName, isLocal };
}

function stableUuid(label) {
  const bytes = createHash('sha1').update(`s4fc-presentation-seed:${label}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stableHash(label) {
  return createHash('sha256').update(`s4fc-presentation-seed:${label}`).digest('hex');
}

function outcomeFor(player1Choice, player2Choice) {
  if (player1Choice === player2Choice) return 'draw';
  const player1Wins = (
    (player1Choice === 'rock' && player2Choice === 'scissors')
    || (player1Choice === 'paper' && player2Choice === 'rock')
    || (player1Choice === 'scissors' && player2Choice === 'paper')
  );
  return player1Wins ? 'player1' : 'player2';
}

export function buildSeedFixtures(now = new Date()) {
  const timestamp = now.getTime();
  const users = MOCK_NAMES.map(([firstName, lastName], index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      id: `presentation-seed-user-${number}`,
      username: `demo_${firstName.toLowerCase()}_${number}`,
      email: `presentation-seed-${number}@example.test`,
      referralCode: `PSEED${number}`,
      firstName,
      lastName,
      points: MOCK_POINTS[index],
      referredById: null,
    };
  });

  const referralCounts = [4, 3, 3, 3, 2, 3];
  const referrals = [];
  let referredIndex = 6;
  referralCounts.forEach((count, referrerIndex) => {
    for (let countIndex = 0; countIndex < count; countIndex += 1) {
      const referee = users[referredIndex];
      const referrer = users[referrerIndex];
      referee.referredById = referrer.id;
      referrals.push({
        id: stableUuid(`referral-${referee.id}`),
        referrerId: referrer.id,
        referredUserId: referee.id,
        referredEmailHash: stableHash(`email-${referee.id}`),
        signupIpHash: stableHash(`ip-${referee.id}`),
        createdAt: new Date(timestamp - (referrals.length + 1) * DAY_MS / 20),
      });
      referredIndex += 1;
    }
  });

  const credits = Array.from({ length: 50 }, (_, index) => {
    const user = users[(index * 7) % users.length];
    const payoutCents = 25 + ((index * 137) % 975);
    return {
      id: stableUuid(`offer-credit-${String(index + 1).padStart(2, '0')}`),
      reference: `presentation-seed-offer-${String(index + 1).padStart(2, '0')}`,
      userId: user.id,
      maskedUsername: `${user.firstName.slice(0, 2)}***_${user.lastName.slice(0, 2)}***`,
      offerwall: OFFERWALLS[index % OFFERWALLS.length],
      offerName: MOCK_OFFERS[(index * 3) % MOCK_OFFERS.length],
      payout: (payoutCents / 100).toFixed(2),
      creditedAt: new Date(timestamp - ((49 - index) * 48 * 60 * 60 * 1000) / 49),
    };
  });

  const lobbies = [];
  const matches = [];
  const houseLedger = [];
  for (let index = 0; index < 24; index += 1) {
    const player1 = users[index];
    const player2 = users[(index + 5) % users.length];
    const player1Choice = CHOICES[index % CHOICES.length];
    const opponentOffset = index % 4 === 0 ? 0 : (index % 2 === 0 ? 1 : 2);
    const player2Choice = CHOICES[(index + opponentOffset) % CHOICES.length];
    const outcome = outcomeFor(player1Choice, player2Choice);
    const winnerId = outcome === 'draw'
      ? null
      : (outcome === 'player1' ? player1.id : player2.id);
    const lobbyId = stableUuid(`completed-lobby-${index + 1}`);
    const matchId = stableUuid(`completed-match-${index + 1}`);
    const wagerAmount = [50, 75, 100, 150, 200, 250][index % 6];
    const completedAt = new Date(timestamp - ((index + 1) * 14 * DAY_MS) / 24);

    lobbies.push({
      id: lobbyId,
      player1Id: player1.id,
      player2Id: player2.id,
      wagerAmount,
      state: 'completed',
      endedReason: 'settled',
      createdAt: completedAt,
      updatedAt: completedAt,
    });
    matches.push({
      id: matchId,
      lobbyId,
      player1Id: player1.id,
      player2Id: player2.id,
      player1Choice,
      player2Choice,
      winnerId,
      outcome,
      completedAt,
    });
    if (winnerId) {
      const poolAmount = wagerAmount * 2;
      houseLedger.push({
        id: stableUuid(`house-ledger-${index + 1}`),
        matchId,
        winnerId,
        poolAmount: poolAmount.toFixed(2),
        rakeAmount: (Math.round(poolAmount * 0.03 * 100) / 100).toFixed(2),
        createdAt: completedAt,
      });
    }
  }

  for (let index = 0; index < 4; index += 1) {
    const createdAt = new Date(timestamp - (index + 1) * 30 * 60 * 1000);
    lobbies.push({
      id: stableUuid(`waiting-lobby-${index + 1}`),
      player1Id: users[index + 8].id,
      player2Id: null,
      wagerAmount: [50, 100, 250, 500][index],
      state: 'waiting',
      endedReason: null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  const tickets = [0, 1, 2].map((index) => {
    const createdAt = new Date(timestamp - (36 - index * 8) * 60 * 60 * 1000);
    return {
      id: stableUuid(`support-ticket-${index + 1}`),
      userId: users[index + 2].id,
      transactionReferenceId: credits[index * 8].reference,
      subject: 'Missing Points from Offer',
      message: `[DEMO] The offer completion did not appear in the points history. Sample ticket ${index + 1}.`,
      status: 'RESOLVED',
      createdAt,
      resolvedAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
    };
  });

  return { users, referrals, credits, lobbies, matches, houseLedger, tickets };
}

async function seedPresentationDatabase(client, fixtures, targetDatabaseName) {
  const databaseResult = await client.query('SELECT current_database() AS database_name');
  if (databaseResult.rows[0]?.database_name !== targetDatabaseName) {
    throw new Error('Connected database name does not match PRESENTATION_DATABASE_URL.');
  }
  const tableResult = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES],
  );
  const presentTables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = REQUIRED_TABLES.filter((table) => !presentTables.has(table));
  if (missingTables.length) {
    throw new Error(`Database schema is not initialized; missing tables: ${missingTables.join(', ')}.`);
  }

  await client.query('BEGIN');
  try {
    const referralByUser = new Map(fixtures.referrals.map((referral) => [referral.referredUserId, referral.referrerId]));
    for (const user of fixtures.users) {
      await client.query(
        `INSERT INTO users
          (id, google_sub, email, username, referral_code, referred_by_user_id, referred_by, account_status, is_banned)
         VALUES ($1, NULL, $2, $3, $4, $5, $5, 'active', FALSE)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           username = EXCLUDED.username,
           referral_code = EXCLUDED.referral_code,
           referred_by_user_id = EXCLUDED.referred_by_user_id,
           referred_by = EXCLUDED.referred_by,
           account_status = 'active',
           is_banned = FALSE,
           updated_at = NOW()`,
        [user.id, user.email, user.username, user.referralCode, referralByUser.get(user.id) || null],
      );
      await client.query(
        `INSERT INTO survey_reward_balances (user_id, points, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           points = EXCLUDED.points,
           updated_at = NOW()`,
        [user.id, user.points],
      );
    }

    for (const referral of fixtures.referrals) {
      await client.query(
        `INSERT INTO referrals
          (id, referrer_id, referred_user_id, referred_email_hash, signup_ip_hash, status, bonus_amount, created_at)
         VALUES ($1, $2, $3, $4, $5, 'completed', 0, $6)
         ON CONFLICT (id) DO UPDATE SET
           referrer_id = EXCLUDED.referrer_id,
           referred_user_id = EXCLUDED.referred_user_id,
           referred_email_hash = EXCLUDED.referred_email_hash,
           signup_ip_hash = EXCLUDED.signup_ip_hash,
           status = EXCLUDED.status,
           bonus_amount = 0,
           created_at = EXCLUDED.created_at`,
        [
          referral.id,
          referral.referrerId,
          referral.referredUserId,
          referral.referredEmailHash,
          referral.signupIpHash,
          referral.createdAt,
        ],
      );
    }

    for (const lobby of fixtures.lobbies) {
      await client.query(
        `INSERT INTO rps_lobbies
          (id, player1_id, player2_id, wager_amount, wager_currency, state, ended_reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'points', $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           player1_id = EXCLUDED.player1_id,
           player2_id = EXCLUDED.player2_id,
           wager_amount = EXCLUDED.wager_amount,
           wager_currency = EXCLUDED.wager_currency,
           state = EXCLUDED.state,
           ended_reason = EXCLUDED.ended_reason,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at`,
        [
          lobby.id,
          lobby.player1Id,
          lobby.player2Id,
          lobby.wagerAmount,
          lobby.state,
          lobby.endedReason,
          lobby.createdAt,
          lobby.updatedAt,
        ],
      );
    }

    for (const match of fixtures.matches) {
      await client.query(
        `INSERT INTO rps_matches
          (id, lobby_id, player1_id, player2_id, player1_choice, player2_choice, winner_id, outcome, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           lobby_id = EXCLUDED.lobby_id,
           player1_id = EXCLUDED.player1_id,
           player2_id = EXCLUDED.player2_id,
           player1_choice = EXCLUDED.player1_choice,
           player2_choice = EXCLUDED.player2_choice,
           winner_id = EXCLUDED.winner_id,
           outcome = EXCLUDED.outcome,
           completed_at = EXCLUDED.completed_at`,
        [
          match.id,
          match.lobbyId,
          match.player1Id,
          match.player2Id,
          match.player1Choice,
          match.player2Choice,
          match.winnerId,
          match.outcome,
          match.completedAt,
        ],
      );
    }

    for (const entry of fixtures.houseLedger) {
      await client.query(
        `INSERT INTO rps_house_ledger
          (id, match_id, winner_id, currency, pool_amount, rake_rate_bps, rake_amount, created_at)
         VALUES ($1, $2, $3, 'points', $4, 300, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           match_id = EXCLUDED.match_id,
           winner_id = EXCLUDED.winner_id,
           currency = EXCLUDED.currency,
           pool_amount = EXCLUDED.pool_amount,
           rake_rate_bps = EXCLUDED.rake_rate_bps,
           rake_amount = EXCLUDED.rake_amount,
           created_at = EXCLUDED.created_at`,
        [entry.id, entry.matchId, entry.winnerId, entry.poolAmount, entry.rakeAmount, entry.createdAt],
      );
    }

    for (const credit of fixtures.credits) {
      await client.query(
        `INSERT INTO live_offer_credits
          (id, transaction_reference, user_id, masked_username, offerwall_name, offer_name, payout_amount, credited_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (transaction_reference) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           masked_username = EXCLUDED.masked_username,
           offerwall_name = EXCLUDED.offerwall_name,
           offer_name = EXCLUDED.offer_name,
           payout_amount = EXCLUDED.payout_amount,
           credited_at = EXCLUDED.credited_at`,
        [
          credit.id,
          credit.reference,
          credit.userId,
          credit.maskedUsername,
          credit.offerwall,
          credit.offerName,
          credit.payout,
          credit.creditedAt,
        ],
      );
    }

    for (const ticket of fixtures.tickets) {
      await client.query(
        `INSERT INTO support_tickets
          (id, user_id, transaction_reference_id, subject, message, status, created_at, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           transaction_reference_id = EXCLUDED.transaction_reference_id,
           subject = EXCLUDED.subject,
           message = EXCLUDED.message,
           status = EXCLUDED.status,
           created_at = EXCLUDED.created_at,
           resolved_at = EXCLUDED.resolved_at`,
        [
          ticket.id,
          ticket.userId,
          ticket.transactionReferenceId,
          ticket.subject,
          ticket.message,
          ticket.status,
          ticket.createdAt,
          ticket.resolvedAt,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function main() {
  let pool;
  try {
    const config = validateSeedEnvironment(process.env);
    pool = new pg.Pool({
      connectionString: config.url.toString(),
      ssl: config.isLocal ? undefined : { rejectUnauthorized: true },
      connectionTimeoutMillis: 5000,
      max: 1,
    });
    const client = await pool.connect();
    try {
      const fixtures = buildSeedFixtures();
      await seedPresentationDatabase(client, fixtures, config.databaseName);
      console.log(JSON.stringify({
        status: 'seed_complete',
        users: fixtures.users.length,
        referrals: fixtures.referrals.length,
        completedMatches: fixtures.matches.length,
        waitingLobbies: fixtures.lobbies.filter((lobby) => lobby.state === 'waiting').length,
        liveOfferCredits: fixtures.credits.length,
        resolvedTickets: fixtures.tickets.length,
        note: 'Development-only simulated data; no real cash wallet was credited.',
      }));
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(JSON.stringify({
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown presentation seed error',
    }));
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
