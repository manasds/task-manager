// Applied by ensureMigrated(). Kept as a string so it ships inside the serverless bundle.
export const SCHEMA_SQL = String.raw`
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL,
  "image" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS session_userId_idx ON "session"("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_userId_idx ON "account"("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification"("identifier");

-- One row per task. Deletes stay as tombstones (data NULL) so a stale device
-- cannot bring a task back. server_seq comes from user_sync_state.seq, which
-- push locks per user, so a user's seqs commit in order and pull cursors never skip.
CREATE TABLE IF NOT EXISTS user_sync_state (
  user_id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  seq BIGINT NOT NULL DEFAULT 0,
  daily_goal_minutes INTEGER,
  goal_updated_at TIMESTAMPTZ,
  goal_seq BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activities (
  user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  id TEXT NOT NULL,
  data JSONB,
  client_updated_at TIMESTAMPTZ NOT NULL,
  server_seq BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS activities_user_seq_idx ON activities (user_id, server_seq);

-- Links on the /canvas page. Plain rows: the page reads them on load and writes each
-- edit straight through, with no local copy or sync bookkeeping.
CREATE TABLE IF NOT EXISTS canvas_tiles (
  user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  position DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS canvas_tiles_user_position_idx ON canvas_tiles (user_id, position);
`;
