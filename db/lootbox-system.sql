-- Lootbox System Database Schema
-- Created for marketing campaign feature

-- Lootbox items definition table
CREATE TABLE IF NOT EXISTS lootbox_items (
  id SERIAL PRIMARY KEY,
  item_type VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  description TEXT,
  rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  points_value INTEGER DEFAULT 0,
  usage_type VARCHAR(30) NOT NULL CHECK (usage_type IN ('immediate', 'pre_game', 'mid_game', 'post_game')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  item_id INTEGER REFERENCES lootbox_items(id),
  quantity INTEGER DEFAULT 1,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(address, item_id)
);

-- Power-up usage tracking
CREATE TABLE IF NOT EXISTS power_up_usage (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  item_id INTEGER REFERENCES lootbox_items(id),
  game_session_id VARCHAR(100),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  result TEXT -- Store any relevant result data
);

-- Lootbox opening history
CREATE TABLE IF NOT EXISTS lootbox_openings (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  item_id INTEGER REFERENCES lootbox_items(id),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  campaign_week BOOLEAN DEFAULT true
);

-- Daily lootbox distribution tracking
CREATE TABLE IF NOT EXISTS daily_lootbox_tracking (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  date DATE NOT NULL,
  lootboxes_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(address, date)
);

-- Insert initial lootbox items
INSERT INTO lootbox_items (item_type, item_name, description, rarity, points_value, usage_type) VALUES
('points', '10 Points', 'Earn 10 bonus points immediately', 'common', 10, 'immediate'),
('try_again', 'Try Again', 'Get another chance to make a move', 'common', 0, 'mid_game'),
('help', 'Help', 'AI suggests the best move for you', 'common', 0, 'mid_game'),
('undo_step', 'Undo Step', 'Reverse your last move', 'rare', 0, 'mid_game'),
('extra_life', 'Extra Life', 'Continue playing after a loss', 'epic', 0, 'post_game'),
('streak_recovery', 'Streak Recovery', 'Restore your lost win streak', 'epic', 0, 'post_game'),
('double_points', '2X Power Up', 'Double points for your next game', 'legendary', 0, 'pre_game')
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_inventory_address ON user_inventory(address);
CREATE INDEX IF NOT EXISTS idx_user_inventory_item ON user_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_power_up_usage_address ON power_up_usage(address);
CREATE INDEX IF NOT EXISTS idx_lootbox_openings_address ON lootbox_openings(address);
CREATE INDEX IF NOT EXISTS idx_daily_lootbox_address_date ON daily_lootbox_tracking(address, date);

-- RLS policies for security
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_up_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE lootbox_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_lootbox_tracking ENABLE ROW LEVEL SECURITY;

-- Allow users to access their own data
CREATE POLICY "Users can view own inventory" ON user_inventory
  FOR SELECT USING (address = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own inventory" ON user_inventory
  FOR ALL USING (address = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can view own power up usage" ON power_up_usage
  FOR SELECT USING (address = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own power up usage" ON power_up_usage
  FOR INSERT WITH CHECK (address = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can view own lootbox openings" ON lootbox_openings
  FOR SELECT USING (address = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own lootbox openings" ON lootbox_openings
  FOR INSERT WITH CHECK (address = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can view own daily tracking" ON daily_lootbox_tracking
  FOR SELECT USING (address = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own daily tracking" ON daily_lootbox_tracking
  FOR ALL USING (address = current_setting('request.jwt.claims', true)::json->>'sub');
