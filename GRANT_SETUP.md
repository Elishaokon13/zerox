# Grant Distribution System Setup

## Overview
The grant distribution system automatically pays weekly grants to the top 3 players based on their points. Grants are paid in ETH directly to players' Farcaster-connected wallets on the Base network.

## Environment Variables Required

Add these environment variables to your `.env.local` file:

```bash
# Grant Funding Configuration
GRANT_FUNDING_WALLET=0xYourWalletAddressHere
GRANT_FUNDING_PRIVATE_KEY=0xYourPrivateKeyHere

# Base Network RPC Configuration
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
# Or use Alchemy Base RPC: https://base-mainnet.g.alchemy.com/v2/your-api-key
```

## Setup Steps

### 1. Fund the Grant Wallet
- Send ETH to the `GRANT_FUNDING_WALLET` address on Base network
- Recommended: Start with 0.1-0.5 ETH for testing (Base has lower fees)
- The system will automatically distribute grants from this wallet

### 2. Configure Environment Variables
- Set `GRANT_FUNDING_WALLET` to your wallet address
- Set `GRANT_FUNDING_PRIVATE_KEY` to the private key of that wallet
- Ensure `NEXT_PUBLIC_RPC_URL` is set to a reliable Base network RPC endpoint

### 3. Database Setup
Run the database migration:
```sql
-- Execute the contents of db/grant-distributions.sql in your Supabase database
```

### 4. Test the System
1. Go to `/admin/grant-distribution`
2. Check that "System Ready" shows ✅
3. Verify wallet balance is displayed
4. Record a weekly distribution
5. Process pending payments

## How It Works

### Weekly Process
1. **Record Distribution**: Admin records the week's top 3 players and amounts
2. **Automatic Payment**: System sends ETH directly to players' wallets
3. **Transaction Tracking**: All transaction hashes are stored in the database
4. **Status Monitoring**: Track payment status (pending, completed, failed)

### Payment Flow
1. System checks wallet balance
2. Creates individual ETH transfer transactions
3. Sends transactions to Base network
4. Updates database with transaction hashes
5. Marks payments as completed/failed

### Security Notes
- Private key is only used server-side
- All transactions are recorded in the database
- Failed transactions can be retried
- Wallet balance is monitored before processing

## Monitoring

### Admin Dashboard Features
- **System Status**: Shows if grant system is ready
- **Wallet Balance**: Current ETH balance in funding wallet
- **Pending Payments**: Number of payments waiting to be processed
- **Transaction History**: Complete record of all payments with Basescan links

### Transaction Tracking
- All payments include transaction hashes
- Links to Basescan for verification
- Status tracking (pending, completed, failed)
- Automatic retry for failed payments

## Troubleshooting

### Common Issues
1. **System Not Ready**: Check environment variables are set correctly
2. **Insufficient Funds**: Add more ETH to the funding wallet
3. **Failed Transactions**: Check RPC endpoint and gas settings
4. **Database Errors**: Ensure grant_distributions table exists

### Support
- Check the admin dashboard for system status
- Review transaction history for failed payments
- Monitor wallet balance regularly
- Test with small amounts first

## Grant Amounts
- **Total Grant**: $1,200 over 15 weeks
- **Weekly Budget**: $80 per week
- **Distribution**: Proportional to points earned by top 3 players
- **Payment**: Automatic ETH transfers to Farcaster wallets
