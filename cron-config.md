# Weekly Grants Cron Configuration

## Overview
The weekly grants system is designed to automatically process USDC distributions every Monday for the previous week's top 5 players.

## Cron Endpoint
- **URL**: `/api/cron/weeklyGrants`
- **Method**: POST
- **Authentication**: Bearer token via `CRON_SECRET` environment variable

## Environment Variables Required
```bash
# Grant system configuration
GRANT_FUNDING_WALLET=0x... # Address of the USDC funding wallet
GRANT_FUNDING_PRIVATE_KEY=0x... # Private key for the funding wallet
USDC_TOKEN_ADDRESS=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 # Base USDC contract
CRON_SECRET=your-secure-random-string # Secret for cron authentication

# Optional configuration
GRANT_MAX_WEEKLY_USDC=100 # Weekly budget (default: 100)
GRANT_TOTAL_CAP_USDC=1200 # Total program budget (default: 1200)
PAUSE_GRANTS=false # Pause all grant processing (default: false)
```

## Cron Schedule Examples

### Vercel Cron (recommended)
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/weeklyGrants",
      "schedule": "0 5 * * 1"
    }
  ]
}
```

### GitHub Actions
Create `.github/workflows/weekly-grants.yml`:
```yaml
name: Weekly Grants Processing
on:
  schedule:
    - cron: '0 5 * * 1'  # Every Monday at 5 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  process-grants:
    runs-on: ubuntu-latest
    steps:
      - name: Process Weekly Grants
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            https://your-domain.com/api/cron/weeklyGrants
```

### External Cron Service (cron-job.org, etc.)
- **URL**: `https://your-domain.com/api/cron/weeklyGrants`
- **Method**: POST
- **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`
- **Schedule**: `0 5 * * 1` (Every Monday at 5 AM UTC)

## Manual Testing
Test the cron endpoint manually:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://your-domain.com/api/cron/weeklyGrants
```

## Monitoring
- Check system status: `GET /api/cron/weeklyGrants`
- View admin panel: `/admin/weeklyGrants`
- Monitor logs for processing results

## Safety Features
- **Idempotency**: Won't process the same week twice
- **Balance checks**: Verifies USDC balance before processing
- **Pause capability**: Set `PAUSE_GRANTS=true` to halt all processing
- **Minimum threshold**: Only players with 100+ weekly points qualify
- **Proportional distribution**: $100 split proportionally among eligible players
- **Transaction tracking**: All payments recorded with tx hashes
