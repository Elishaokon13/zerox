const { createClient } = require('@supabase/supabase-js');

// You'll need to set these environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const lootboxItems = [
  {
    item_type: 'points',
    item_name: '10 Points',
    description: 'Earn 10 bonus points immediately',
    rarity: 'common',
    points_value: 10,
    usage_type: 'immediate'
  },
  {
    item_type: 'try_again',
    item_name: 'Try Again',
    description: 'Get another chance to make a move',
    rarity: 'common',
    points_value: 0,
    usage_type: 'mid_game'
  },
  {
    item_type: 'help',
    item_name: 'Help',
    description: 'AI suggests the best move for you',
    rarity: 'common',
    points_value: 0,
    usage_type: 'mid_game'
  },
  {
    item_type: 'undo_step',
    item_name: 'Undo Step',
    description: 'Reverse your last move',
    rarity: 'rare',
    points_value: 0,
    usage_type: 'mid_game'
  },
  {
    item_type: 'extra_life',
    item_name: 'Extra Life',
    description: 'Continue playing after a loss',
    rarity: 'epic',
    points_value: 0,
    usage_type: 'post_game'
  },
  {
    item_type: 'streak_recovery',
    item_name: 'Streak Recovery',
    description: 'Restore your lost win streak',
    rarity: 'epic',
    points_value: 0,
    usage_type: 'post_game'
  },
  {
    item_type: 'double_points',
    item_name: '2X Power Up',
    description: 'Double points for your next game',
    rarity: 'legendary',
    points_value: 0,
    usage_type: 'pre_game'
  }
];

async function insertLootboxItems() {
  try {
    console.log('Inserting lootbox items...');
    
    const { data, error } = await supabase
      .from('lootbox_items')
      .insert(lootboxItems);
    
    if (error) {
      console.error('Error inserting lootbox items:', error);
    } else {
      console.log('Successfully inserted lootbox items:', data);
    }
    
    // Verify the items were inserted
    const { data: items, error: fetchError } = await supabase
      .from('lootbox_items')
      .select('*');
    
    if (fetchError) {
      console.error('Error fetching lootbox items:', fetchError);
    } else {
      console.log('Current lootbox items in database:', items);
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

insertLootboxItems();
