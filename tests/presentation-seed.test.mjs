import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeedFixtures, validateSeedEnvironment } from '../scripts/presentation-seed.mjs';

const confirmation = 'seed-demo-data-in-development';
const localEnvironment = {
  NODE_ENV: 'development',
  PRESENTATION_DATABASE_URL: 'postgresql://test:test@localhost:5432/s4fc',
  PRESENTATION_SEED_CONFIRMATION: confirmation,
};

test('presentation seeder requires development mode, explicit consent, and its separate database URL', () => {
  assert.throws(
    () => validateSeedEnvironment({ ...localEnvironment, NODE_ENV: 'production' }),
    /only when NODE_ENV=development/,
  );
  assert.throws(
    () => validateSeedEnvironment({ ...localEnvironment, PRESENTATION_SEED_CONFIRMATION: '' }),
    /PRESENTATION_SEED_CONFIRMATION/,
  );
  assert.throws(
    () => validateSeedEnvironment({
      NODE_ENV: 'development',
      DATABASE_URL: localEnvironment.PRESENTATION_DATABASE_URL,
      PRESENTATION_SEED_CONFIRMATION: confirmation,
    }),
    /DATABASE_URL is intentionally not used/,
  );
  assert.equal(validateSeedEnvironment(localEnvironment).databaseName, 's4fc');
});

test('remote presentation seeding requires an explicit opt-in and a marked development database', () => {
  const remoteEnvironment = {
    ...localEnvironment,
    PRESENTATION_DATABASE_URL: 'postgresql://test:test@db.example.net/s4fc',
  };
  assert.throws(() => validateSeedEnvironment(remoteEnvironment), /Remote seeding requires/);
  assert.throws(
    () => validateSeedEnvironment({
      ...remoteEnvironment,
      PRESENTATION_SEED_ALLOW_REMOTE: 'yes',
    }),
    /Remote seeding requires/,
  );
  assert.throws(
    () => validateSeedEnvironment({
      ...remoteEnvironment,
      PRESENTATION_DATABASE_URL: 'postgresql://test:test@db.example.net/s4fc_production_dev',
      PRESENTATION_SEED_ALLOW_REMOTE: 'yes',
    }),
    /Production-named database targets/,
  );
  assert.equal(
    validateSeedEnvironment({
      ...remoteEnvironment,
      PRESENTATION_DATABASE_URL: 'postgresql://test:test@db.example.net/s4fc_dev',
      PRESENTATION_SEED_ALLOW_REMOTE: 'yes',
    }).isLocal,
    false,
  );
});

test('presentation fixtures are deterministic, idempotency-keyed, and match requested activity volumes', () => {
  const now = new Date('2026-11-24T12:00:00.000Z');
  const first = buildSeedFixtures(now);
  const second = buildSeedFixtures(now);

  assert.equal(first.users.length, 24);
  assert.equal(new Set(first.users.map((user) => user.id)).size, 24);
  assert.ok(first.users.every((user) => user.email.endsWith('@example.test')));
  assert.ok(new Set(first.users.map((user) => user.points)).size > 10);
  assert.equal(first.referrals.length, 18);
  assert.deepEqual(first.users.map((user) => user.referredById), second.users.map((user) => user.referredById));
  assert.equal(first.credits.length, 50);
  assert.ok(first.credits.every((credit) => credit.creditedAt <= now));
  assert.ok(first.credits.every((credit) => credit.creditedAt >= new Date(now.getTime() - 48 * 60 * 60 * 1000)));
  assert.equal(first.lobbies.filter((lobby) => lobby.state === 'waiting').length, 4);
  assert.equal(first.matches.length, 24);
  assert.ok(first.matches.every((match) => match.id === second.matches.find((other) => other.lobbyId === match.lobbyId)?.id));
  for (const match of first.matches) {
    const player1Wins = (
      (match.player1Choice === 'rock' && match.player2Choice === 'scissors')
      || (match.player1Choice === 'paper' && match.player2Choice === 'rock')
      || (match.player1Choice === 'scissors' && match.player2Choice === 'paper')
    );
    const expectedOutcome = match.player1Choice === match.player2Choice
      ? 'draw'
      : (player1Wins ? 'player1' : 'player2');
    assert.equal(match.outcome, expectedOutcome);
    assert.equal(match.winnerId, expectedOutcome === 'draw'
      ? null
      : (expectedOutcome === 'player1' ? match.player1Id : match.player2Id));
  }
  assert.ok(first.houseLedger.every((entry) => entry.rakeAmount === (Number(entry.poolAmount) * 0.03).toFixed(2)));
  assert.equal(first.tickets.length, 3);
  assert.ok(first.tickets.every((ticket) => ticket.status === 'RESOLVED'));
});
