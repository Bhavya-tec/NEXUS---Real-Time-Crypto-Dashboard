
-- Users
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,   -- bcrypt hash
  created_at TIMESTAMP DEFAULT NOW()
);

-- Accounts (1-to-1 with users)
CREATE TABLE IF NOT EXISTS accounts (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance    DECIMAL(14,4) NOT NULL DEFAULT 10000.00,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Holdings
CREATE TABLE IF NOT EXISTS holdings (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coin_id    VARCHAR(60) NOT NULL,
  sym        VARCHAR(12) NOT NULL,
  units      DECIMAL(24,10) NOT NULL DEFAULT 0,
  avg_cost   DECIMAL(24,10) NOT NULL DEFAULT 0,
  UNIQUE(user_id, coin_id)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coin_id    VARCHAR(60) NOT NULL,
  sym        VARCHAR(12) NOT NULL,
  action     VARCHAR(4)  NOT NULL CHECK (action IN ('buy','sell')),
  units      DECIMAL(24,10) NOT NULL,
  price      DECIMAL(24,10) NOT NULL,
  amount_usd DECIMAL(14,4)  NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_time   ON orders(created_at DESC);

SELECT 'Tables ready: users, accounts, holdings, orders' AS status;