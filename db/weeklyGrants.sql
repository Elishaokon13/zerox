-- Weekly Grants Database Setup
-- Run this in your Supabase SQL Editor

-- 1. Create the weekly_grants table for USDC distributions
CREATE TABLE IF NOT EXISTS weekly_grants (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  rank INTEGER NOT NULL,
  address TEXT NOT NULL,
  alias TEXT,
  weekly_points INTEGER NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  amount_usdc DECIMAL(10,2) NOT NULL DEFAULT 0,
  tx_hash TEXT,
  tx_status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed
  distributed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_weekly_grant UNIQUE (week_start, rank)
);

-- 2. Create player_lifetime_tracking table for lifetime cap management
CREATE TABLE IF NOT EXISTS player_lifetime_tracking (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  alias TEXT,
  lifetime_earned_usdc DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_capped BOOLEAN NOT NULL DEFAULT FALSE,
  capped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_weekly_grants_week ON weekly_grants(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_grants_address ON weekly_grants(address);
CREATE INDEX IF NOT EXISTS idx_weekly_grants_status ON weekly_grants(tx_status);

-- Indexes for player_lifetime_tracking
CREATE INDEX IF NOT EXISTS idx_player_lifetime_address ON player_lifetime_tracking(address);
CREATE INDEX IF NOT EXISTS idx_player_lifetime_capped ON player_lifetime_tracking(is_capped);
CREATE INDEX IF NOT EXISTS idx_player_lifetime_earned ON player_lifetime_tracking(lifetime_earned_usdc);

-- 4. Disable Row Level Security for these tables (since they're admin-only)
ALTER TABLE weekly_grants DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_lifetime_tracking DISABLE ROW LEVEL SECURITY;

-- 5. Create policies that allow all operations (admin access)
CREATE POLICY "Allow all operations for weekly_grants" ON weekly_grants
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for player_lifetime_tracking" ON player_lifetime_tracking
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Grant necessary permissions
GRANT ALL ON weekly_grants TO authenticated;
GRANT ALL ON weekly_grants TO anon;
GRANT USAGE, SELECT ON SEQUENCE weekly_grants_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE weekly_grants_id_seq TO anon;

GRANT ALL ON player_lifetime_tracking TO authenticated;
GRANT ALL ON player_lifetime_tracking TO anon;
GRANT USAGE, SELECT ON SEQUENCE player_lifetime_tracking_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE player_lifetime_tracking_id_seq TO anon;

-- 6. Drop and recreate function to get weekly top 5 players with minimum threshold
DROP FUNCTION IF EXISTS get_weekly_top5_players(DATE);

CREATE OR REPLACE FUNCTION get_weekly_top5_players(week_start_date DATE)
RETURNS TABLE (
  address TEXT,
  alias TEXT,
  weekly_points INTEGER,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    le.address,
    le.alias,
    le.points::INTEGER as weekly_points,
    ROW_NUMBER() OVER (ORDER BY le.points DESC, le.wins DESC)::INTEGER as rank
  FROM public.leaderboard_entries le
  WHERE le.season = week_start_date::TEXT
    AND le.points >= 100  -- Minimum threshold
  ORDER BY le.points DESC, le.wins DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- 7. Drop and recreate function to calculate proportional USDC distribution
DROP FUNCTION IF EXISTS calculate_weekly_grant_distribution(DATE);

CREATE OR REPLACE FUNCTION calculate_weekly_grant_distribution(week_start_date DATE)
RETURNS TABLE (
  address TEXT,
  alias TEXT,
  weekly_points INTEGER,
  rank INTEGER,
  percentage DECIMAL(5,2),
  amount_usdc DECIMAL(10,2)
) AS $$
DECLARE
  total_points BIGINT;
  weekly_budget DECIMAL(10,2) := 100.00; -- $100 weekly budget
BEGIN
  -- Get total points for eligible players (>= 100 points)
  SELECT COALESCE(SUM(le.points), 0)
  INTO total_points
  FROM public.leaderboard_entries le
  WHERE le.season = week_start_date::TEXT
    AND le.points >= 100;

  -- If no eligible players, return empty result
  IF total_points = 0 THEN
    RETURN;
  END IF;

  -- Calculate proportional distribution
  RETURN QUERY
  SELECT 
    le.address,
    le.alias,
    le.points::INTEGER as weekly_points,
    ROW_NUMBER() OVER (ORDER BY le.points DESC, le.wins DESC)::INTEGER as rank,
    ROUND((le.points::DECIMAL / total_points::DECIMAL) * 100, 2) as percentage,
    ROUND((le.points::DECIMAL / total_points::DECIMAL) * weekly_budget, 2) as amount_usdc
  FROM public.leaderboard_entries le
  WHERE le.season = week_start_date::TEXT
    AND le.points >= 100
  ORDER BY le.points DESC, le.wins DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to maintain updated_at column
CREATE OR REPLACE FUNCTION touch_weekly_grants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_weekly_grants_touch
  BEFORE UPDATE ON weekly_grants
  FOR EACH ROW EXECUTE FUNCTION touch_weekly_grants_updated_at();

-- 9. Verify the setup
SELECT 'Weekly grants setup completed successfully' as status;
