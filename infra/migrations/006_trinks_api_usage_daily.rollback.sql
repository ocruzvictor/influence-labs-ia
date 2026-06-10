-- Rollback de 006: volta ao contador mensal (005)
DROP TABLE IF EXISTS trinks_api_usage;
CREATE TABLE trinks_api_usage (
  yyyymm     TEXT        PRIMARY KEY,
  used       INTEGER     NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
