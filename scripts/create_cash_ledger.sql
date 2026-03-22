BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_donate_cash_ledger (
  ledger_id BIGSERIAL PRIMARY KEY,
  guild_id VARCHAR(32),
  txn_type VARCHAR(10) NOT NULL CHECK (txn_type IN ('IN', 'OUT')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  balance_after BIGINT NOT NULL,
  reason VARCHAR(200) NOT NULL,
  note TEXT,
  image_url TEXT,
  actor_id VARCHAR(32),
  actor_tag VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE public.tb_donate_cash_ledger ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_donate_cash_ledger_guild_created
  ON public.tb_donate_cash_ledger (guild_id, created_at DESC);

COMMIT;
