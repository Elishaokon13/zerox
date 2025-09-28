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
