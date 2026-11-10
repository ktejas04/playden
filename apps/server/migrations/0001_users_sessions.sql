CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  invited_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'banned')),
  created_at INTEGER NOT NULL,
  approved_at INTEGER
);

CREATE INDEX users_status_created ON users (status, created_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_user ON sessions (user_id);
