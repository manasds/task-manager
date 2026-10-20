// Applied by migrate(). Kept as a string so it ships inside the serverless bundle.
export const SCHEMA_SQL = String.raw`
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Prototype email/password tables from the first persistence pass.
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_documents'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    DROP TABLE user_documents;
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS user_documents (
  user_id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  document JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- Copy whole-document boards into rows once per user (users without sync state yet).
WITH pending AS (
  SELECT d.user_id, d.document
  FROM user_documents d
  WHERE NOT EXISTS (SELECT 1 FROM user_sync_state s WHERE s.user_id = d.user_id)
),
rows AS (
  SELECT p.user_id, a.value AS data, a.value->>'id' AS id,
         COALESCE(a.value->>'updatedAt', a.value->>'completedAt', a.value->>'createdAt') AS ts
  FROM pending p, jsonb_array_elements(p.document->'activities') a
  WHERE jsonb_typeof(a.value->'id') = 'string'
),
numbered AS (
  SELECT user_id, id, data, ts,
         row_number() OVER (PARTITION BY user_id ORDER BY id) AS seq
  FROM rows
)
INSERT INTO activities (user_id, id, data, client_updated_at, server_seq)
SELECT user_id, id, data,
       CASE WHEN ts ~ '^\d{4}-\d{2}-\d{2}T' THEN ts::timestamptz ELSE now() END,
       seq
FROM numbered
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO user_sync_state (user_id, seq, daily_goal_minutes, goal_updated_at, goal_seq)
SELECT d.user_id,
       COALESCE((SELECT max(server_seq) FROM activities a WHERE a.user_id = d.user_id), 0) + 1,
       round((d.document->>'dailyGoalMinutes')::numeric)::int,
       d.updated_at,
       COALESCE((SELECT max(server_seq) FROM activities a WHERE a.user_id = d.user_id), 0) + 1
FROM user_documents d
WHERE NOT EXISTS (SELECT 1 FROM user_sync_state s WHERE s.user_id = d.user_id);
`;
