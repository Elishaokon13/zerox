-- Grant Distribution Database Setup
-- Run this in your Supabase SQL Editor

-- 1. Create the grant_distributions table
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
  tx_status TEXT DEFAULT 'pending',
  distributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_grant_distributions_week ON grant_distributions(week_start);
CREATE INDEX IF NOT EXISTS idx_grant_distributions_address ON grant_distributions(recipient_address);
CREATE INDEX IF NOT EXISTS idx_grant_distributions_status ON grant_distributions(tx_status);

-- 3. Disable Row Level Security for this table (since it's admin-only)
ALTER TABLE grant_distributions DISABLE ROW LEVEL SECURITY;

-- 4. Create a policy that allows all operations (admin access)
CREATE POLICY "Allow all operations for grant_distributions" ON grant_distributions
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Grant necessary permissions
GRANT ALL ON grant_distributions TO authenticated;
GRANT ALL ON grant_distributions TO anon;
GRANT USAGE, SELECT ON SEQUENCE grant_distributions_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE grant_distributions_id_seq TO anon;

-- 6. Verify the table was created
SELECT 'Grant distributions table created successfully' as status;
