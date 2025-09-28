# ZeroX - Social Game on Base & Farcaster

ZeroX is a social-first game built for Base and Farcaster, focusing on competitive play and social sharing.

## 🎮 Game Modes

### 1. Party Mode
- Create or join rooms with 4-letter codes
- Play against friends in real-time
- Share results directly to Farcaster
- Beautiful shareable result cards

### 2. Daily Challenge
- New challenge every day
- Compete on the daily leaderboard
- Earn rewards for completing challenges
- Track your daily streak

### 3. Practice Mode
- Play against AI
- Multiple difficulty levels
- Perfect your strategy
- No stakes, just practice

## 🏆 Competitive Features

### Leaderboard System
- Weekly rankings
- All-time stats
- Win/loss tracking
- Player profiles

### Rewards
- Win ETH for victories
- Daily bonus rewards
- Special achievements
- Seasonal rewards

## 🔄 Real-time Gameplay

### Party Mode Flow
1. **Create Room**
   - Click "CREATE ROOM"
   - Get a unique 4-letter code
   - Share with friends

2. **Join Room**
   - Enter room code
   - Connect with opponent
   - Start playing instantly

3. **Gameplay**
   - Real-time moves
   - Live opponent status
   - Turn timer
   - Game state sync

4. **Results**
   - Beautiful result cards
   - Share on Farcaster
   - Instant rewards
   - Play again option

## 🌐 Social Features

### Farcaster Integration
- One-click sharing
- Challenge friends
- Share victories
- Embedded game results

### Challenge System
- Direct challenges
- Room code sharing
- Cast-to-play functionality
- Auto-join from casts

## 💻 Technical Stack

### Frontend
- Next.js 13 App Router
- React 18
- Tailwind CSS
- Framer Motion

### Backend
- Supabase Database
- Pusher WebSockets
- Redis Caching
- Base Smart Contracts

### Integrations
- Farcaster SDK
- Base MiniKit
- OnchainKit
- Wagmi

## 🔧 Development

1. Install dependencies:
\`\`\`bash
npm install
# or
yarn install
\`\`\`

2. Set up environment variables:
\`\`\`bash
cp .env.example .env.local
\`\`\`

Required variables:
- \`NEXT_PUBLIC_URL\`: Your app URL
- \`NEXT_PUBLIC_PUSHER_KEY\`: Pusher key for real-time
- \`NEXT_PUBLIC_SUPABASE_URL\`: Supabase URL
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`: Supabase anon key

3. Run development server:
\`\`\`bash
npm run dev
\`\`\`

## 📱 Features in Detail

### Real-time Game State
- WebSocket connections via Pusher
- Instant move updates
- Player presence tracking
- Game state synchronization

### Social Sharing
- Shareable result cards
- Direct Farcaster integration
- Challenge links
- Embedded results

### User Profiles
- Farcaster integration
- Win/loss statistics
- Achievement tracking
- Player rankings

### Smart Contract Integration
- Automated payouts
- Secure transactions
- Verifiable results
- On-chain statistics

## 🔐 Security

- Rate limiting on game actions
- Move validation
- Anti-cheat measures
- Secure WebSocket connections
- Protected API endpoints

## 📈 Future Plans

- Tournament mode
- Team battles
- Custom board sizes
- More social features
- Enhanced rewards
- Mobile app

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ **Commercial use** - Use this project in commercial applications
- ✅ **Modification** - Modify the code to suit your needs
- ✅ **Distribution** - Share and distribute the software
- ✅ **Private use** - Use privately without restrictions
- ✅ **Patent use** - Use any patents included in the code

### Requirements:
- 📝 **Include license and copyright notice** in all copies
- 📝 **State changes** if you modify the code

For more information about the MIT License, visit [choosealicense.com](https://choosealicense.com/licenses/mit/).