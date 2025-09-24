-- Grant Distributions Table
CREATE TABLE IF NOT EXISTS grant_distributions (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  recipient_address TEXT NOT NULL,
  recipient_alias TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  amount_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_eth DECIMAL(18,8) NOT NULL DEFAULT 0,
  tx_hash TEXT,
  tx_status TEXT DEFAULT 'pending', -- pending, completed, failed
  distributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_grant_distributions_week ON grant_distributions(week_start);
CREATE INDEX IF NOT EXISTS idx_grant_distributions_address ON grant_distributions(recipient_address);

-- Grant Summary View
CREATE OR REPLACE VIEW grant_summary AS
SELECT 
  recipient_address,
  recipient_alias,
  COUNT(*) as weeks_distributed,
  SUM(amount_usd) as total_usd_received,
  SUM(amount_eth) as total_eth_received,
  AVG(percentage) as avg_percentage,
  MIN(week_start) as first_distribution,
  MAX(week_start) as last_distribution
FROM grant_distributions
GROUP BY recipient_address, recipient_alias
ORDER BY total_usd_received DESC;
