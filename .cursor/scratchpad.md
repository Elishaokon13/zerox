Background and Motivation

The app currently pays a fixed ETH amount to winners and requests a fixed ETH payment from losers. Payouts are initiated server-side on win; charges are initiated client-side on loss. Amounts are configured via environment variables and default to 0.00002 ETH (the user mentioned 0.00012 ETH as a target). There is a per-address daily payout cap via Supabase. ETH price is fetched for display but not used to compute dynamic amounts. The scoreboard contract records results but doesn’t enforce validity.

This creates sustainability and scalability risks: every win costs treasury gas without a compensating margin, there’s no server-side verification of legitimate wins prior to payout, fixed ETH amounts are volatile in USD terms, and config duplication can drift. There’s also a reference to a `loss_settlements` table that isn’t present in the schema.

Key Challenges and Analysis

- Trust and verification: The server accepts a payout request with only an address. No proof binds the request to a valid, recent, and unpaid win. The onchain scoreboard doesn’t authenticate outcomes. Minimal verification is needed for scalability and to prevent faucet abuse.
- Unit economics: With equal win and loss amounts, the house pays payout gas while players pay charge gas. Without a rake/spread, expected margin is negative after infra and operations.
- Gas efficiency: Per-match onchain payouts are expensive. Even on Base/L2, frequent micro-sends add up and slow throughput.
- Price volatility: Fixed ETH amounts imply variable USD incentive, which can be too high or too low.
- Config drift: UI reads NEXT_PUBLIC_* while server reads private env vars. Divergent values cause UX and accounting issues.
- Data model inconsistencies: `loss_settlements` is used in code but absent in `db/supabase.sql`. `game_sessions` exists and is better suited as the single source of truth.
- Abuse vectors: Sybil/collusion and automated play can drain rewards. Current guard is only a daily payout cap.

Additional challenge (loss settlement not tightened): Client-initiated charge flow can be skipped or abandoned. Without a server-enforced gate, users can continue to play or request payouts while having unpaid losses. The existing UI references a `loss_settlements` table that does not exist, so gating is ineffective.

High-level Task Breakdown (TDD; smallest viable changes first)

1) Centralize economic config and expose read-only to client
- Outcome: Single server source of truth computes dynamic payout/charge and publishes public view via `/api/config`.
- Implementation:
  - Add envs: `TARGET_REWARD_USD` (e.g., 0.05), `MARGIN_BPS` (e.g., 400 = 4%), `MAX_PAYOUT_ETH` (safety cap), optional `MIN_PAYOUT_ETH`.
  - Server computes `payoutEth = clampUsdToEth(TARGET_REWARD_USD)` using `getEthPrice()` with caching/fallback.
  - Server computes `chargeEth = payoutEth * (1 + MARGIN_BPS/10000)`.
  - Add `/api/config` that returns computed values and strings for UI. Have the client display these instead of envs.
- Success criteria:
  - `/api/config` returns non-null ETH amounts within bounds and consistent across responses in a 5-minute window.
  - Client shows the same numbers as server config.
  - Unit tests cover conversion logic and clamping.

2) Wire `game_sessions` lifecycle into gameplay and payouts
- Outcome: Each game has a server-issued session; results are persisted; payouts/charges reference the last session.
- Implementation:
  - On game start: POST `/api/gamesession` to create a session; store `id` client-side.
  - On finish: PUT `/api/gamesession` with `{ id, result, requires_settlement }` (true for loss), and later `{ id, settled: true, tx_hash }` after wallet send.
  - Remove reliance on `loss_settlements`; use `game_sessions.requires_settlement` to gate starting new games/UI.
  - Server-side gate: In `/api/gamesession` POST, before creating a new session, check for any prior session for this address with `requires_settlement = true AND settled = false`. If found, return 409 `{ required: true }` and DO NOT create a new session. This ensures users cannot start new games until settling losses.
- Success criteria:
  - A game creates exactly one session and updates it on completion.
  - On loss, the UI blocks new games until the charge is sent and session marked settled.
  - Unit tests simulate session creation/update flows with Supabase stubs.

3) Server-side payout verification and idempotency
- Outcome: Payouts require a recent, unpaid win session for the requesting address and become idempotent.
- Implementation:
  - In `/api/payout`, require `{ address, sessionId }`.
  - Verify session belongs to address, result == win, created_at within a short window (e.g., 15 minutes), and not already paid (extend schema: add `paid boolean default false`, or reuse `settled` for wins).
  - After sending tx, mark session as paid/settled with `tx_hash`.
  - Rate limit per address (e.g., 1 payout/minute) in addition to daily cap.
  - Loss-tightening add-on: If any unsettled loss sessions exist, either (a) reject payouts with a clear error requiring settlement first, or (b) net the outstanding amount from the payout (Phase 2 with internal ledger). For Phase 1, use (a) to keep logic simple.
- Success criteria:
  - Invalid or stale sessions are rejected with clear errors.
  - Repeated POSTs return success without duplicate sends (idempotent behavior validated in tests).
  - When unpaid loss exists, payout requests are denied with a specific, user-facing message.

3.5) Loss charge verification (onchain) and completion flow
- Outcome: The server verifies that a user’s loss settlement transaction actually transferred the expected amount to treasury before marking the session settled.
- Implementation:
  - Update `/api/charge` to return `{ to, value, chainId, sessionId }`.
  - After the client sends the tx, it POSTs to `/api/gamesession` PUT with `{ id: sessionId, settled: true, tx_hash }`.
  - On that PUT, the server fetches the tx via RPC, verifies: `from == address`, `to == TREASURY_ADDRESS`, `value >= expectedWei` (allow small slippage if needed), `chainId == configured`, and receipt succeeded. Only then set `settled = true` and persist `tx_hash`.
  - If verification fails or pending, return a retriable status; the client can poll until confirmed.
- Success criteria:
  - Marking a loss as settled only occurs after a valid onchain transfer is confirmed.
  - Double-submissions are idempotent (re-PUT with same tx_hash is safe).

4) Introduce rake/spread and USD peg
- Outcome: `chargeEth` exceeds `payoutEth` by `MARGIN_BPS` to cover gas and margin; both derived from USD target.
- Implementation:
  - Update `/api/charge` to return `parseEther(chargeEth)` from centralized calculator rather than raw env.
  - Update `/api/payout` to use `payoutEth` and enforce `<= MAX_PAYOUT_ETH` guard.
  - Keep legacy envs as overrides for emergency.
- Success criteria:
  - For a fixed ETH price in tests, `chargeEth = payoutEth * (1 + margin)`.
  - Guard prevents outsized payouts if misconfigured.

5) Strengthen abuse controls (minimal viable)
- Outcome: Reduce trivial faucet abuse without harming honest users.
- Implementation:
  - Enforce per-session verification from step 3.
  - Keep daily cap; add short-interval rate limit on `/api/payout`.
  - Optional: require net-positive or zero outstanding loss sessions before allowing further payouts.
  - Enforce server-side gate on new sessions (step 2) so users cannot play more until unpaid losses are settled.
- Success criteria:
  - Tests show capped behavior when exceeding limits; honest path remains smooth.

6) Tests (TDD)
- Outcome: Deterministic tests validate economics and session gating.
- Implementation:
  - Unit tests for USD->ETH conversion with mocked `getEthPrice()`.
  - Tests for payout verification under: valid session, stale session, already-paid session, foreign session.
  - Tests for margin math and clamping.
- Success criteria:
  - All new tests pass. Coverage includes calculator and payout/charge guards.

7) Schema and data
- Outcome: Schema matches code paths; data supports idempotency and auditing.
- Implementation:
  - Amend `db/supabase.sql` to add needed columns (e.g., `paid boolean default false` to `game_sessions`) or reuse `settled` consistently for both win and loss.
  - Add a `charge_logs` table mirroring `payout_logs` for auditing.
  - Remove `loss_settlements` dependency or add the table if still needed (prefer removal).
  - Add an index for quick lookup of outstanding loss sessions: `create index on game_sessions (address, requires_settlement, settled, created_at desc);`
- Success criteria:
  - Migrations apply cleanly; endpoints run without missing-table errors.

8) Optional Phase 2: Internal ledger + batched withdrawals
- Outcome: Reduce gas per game and scale better under load.
- Implementation:
  - Record net balances in Supabase; allow user-initiated withdrawals (treasury batch or per-request with queueing).
  - Keep per-session economic entries for transparency.
- Success criteria:
  - With batching enabled, observed onchain tx count per 100 games decreases materially in testing.

Project Status Board

- [ ] Centralize config and add `/api/config` with USD-pegged amounts and margin
- [ ] Integrate `game_sessions` lifecycle into client flow (create, update, settle)
- [ ] Add server gate in `/api/gamesession` POST to block when unpaid losses exist
- [ ] Add payout verification (requires valid recent win session) and idempotency; deny payouts with unpaid losses
- [ ] Update `/api/charge` to include sessionId and verify tx on settlement PUT
- [ ] Update `/api/payout` and `/api/charge` to use centralized calculator and guards
- [ ] Add minimal rate limiting beyond daily caps
- [ ] Add/adjust Supabase schema (paid/settled semantics, remove `loss_settlements`, add `charge_logs`, indexes)
- [ ] Implement unit tests for conversion, verification, and margin math
- [ ] Implement unit tests for unpaid-loss gating and tx verification path
- [ ] Wire client UI to read amounts from `/api/config`
- [ ] Optional: prototype internal ledger, netting, and withdrawal flow

New UX Task: Simplify gameplay (remove difficulty selection)

- Rationale: Reduce friction; current easy/hard selection increases clicks and may bias outcomes. A single, fast start against a randomized AI keeps outcomes unpredictable and balanced with the economic rake.
- Implementation:
  - Remove difficulty selection UI (`GameControls` related props/states in `app/page.tsx`) and default to a single start/play CTA.
  - Replace AI policy with a randomized move selector (or seeded PRNG for reproducibility) and optional minimal heuristics to avoid obvious blunders if desired.
  - Ensure `gameStatus` transitions are unchanged so payout/charge flows remain intact.
  - Update any copy that references easy/hard.
  - Adjust daily challenge logic in `/api/daily/route.ts` which currently checks `difficulty === 'hard'` and `symbol === 'X'`. Options:
    - Option A (simple): remove difficulty requirement and keep `symbol === 'X'`.
    - Option B (neutral): remove both difficulty and symbol constraints; base eligibility on completion + win + correct daily seed.
    - Option C (new rule): add a different objective (e.g., win under N moves). Phase 1 suggests Option B for minimal change.
- Success criteria:
  - Users can start a game in one click without selecting difficulty.
  - No references to `difficulty` remain in the client path; no runtime errors.
  - Daily bonus flow remains functional under the updated eligibility.
  - Payout/charge continue to trigger as before after win/loss.

Current Status / Progress Tracking

- Planner draft v1 created. Awaiting approval to proceed with Executor step 1.

Executor's Feedback or Assistance Requests

- Confirm target economics:
  - TARGET_REWARD_USD default (e.g., $0.05?) or keep fixed ETH (0.00012)?
  - MARGIN_BPS default (suggest 400 = 4%).
  - Daily payout cap (current default 5). Adjust?
- Confirm whether to remove `loss_settlements` and standardize on `game_sessions`.
- Provide/confirm envs: `TREASURY_PRIVATE_KEY`, `TREASURY_ADDRESS`, `NEXT_PUBLIC_RPC_URL`, chain selection. Ensure treasury funded on selected chain.
- Approve adding `/api/config` and moving UI copy to server-provided values.
 - Approve server-side gate on new sessions and payout denial while unpaid loss exists.
 - Approve onchain tx verification for loss settlement (may add a few seconds of confirmation wait on L2).

Lessons

- Per-match onchain payouts without verification bleed treasury via gas; add minimal verification and a small spread.
- Keep one source of truth for economics on the server; have the client render what the server computes.
- Use USD-pegged targets to stabilize incentives; clamp ETH with safety caps.
# TicTacToe Farcaster Share Implementation

## Background and Motivation
We need to implement a complete Farcaster sharing functionality for the TicTacToe game, based on the minicolours implementation. The goal is to allow users to share their game results on Farcaster with a beautiful preview card and proper metadata.

## Key Challenges and Analysis
1. Current Implementation Status:
   - ✅ Basic `farcaster-share.ts` with core functionality
   - ✅ Share page implementation
   - ✅ GameResultCard component for display
   - ✅ GameResultEmbed component for preview
   - ❌ Missing proper integration in game flow
   - ❌ Missing metadata for share preview
   - ❌ Missing proper share button placement

2. Key Differences from Minicolours:
   - Different game data structure (TicTacToe vs Color game)
   - Different visual style requirements
   - Need to adapt share text format
   - Need to integrate with game flow

## High-level Task Breakdown

1. Update Farcaster Frame Metadata Format
   - Success Criteria: Implement new fc:miniapp and fc:frame meta tags
   - Ensure proper JSON structure with version, imageUrl, and button properties
   - Maintain backward compatibility with both tags

2. Update OpenGraph Image Generation
   - Success Criteria: Image meets Farcaster Frame requirements
   - Aspect ratio: 3:2
   - Dimensions: At least 600x400px
   - Format: PNG for best compatibility
   - File size < 10MB

3. Implement Dynamic Image Caching
   - Success Criteria: Proper Cache-Control headers
   - Set appropriate max-age for dynamic content
   - Handle fallback images correctly

4. Update Share Button Integration
   - Success Criteria: Share button appears at appropriate time in game
   - Clear call-to-action text
   - Proper handling of share action

5. Test Share Functionality
   - Success Criteria: Complete end-to-end test of share flow
   - Verify preview works in Farcaster
   - Test both miniapp and frame meta tags
   - Verify image caching behavior

## Project Status Board
- [ ] Update metadata.tsx with new Farcaster Frame format
  - [ ] Add fc:miniapp meta tag
  - [ ] Add fc:frame meta tag for backward compatibility
  - [ ] Update JSON structure with version, imageUrl, and button properties
- [ ] Update opengraph-image.tsx for Frame requirements
  - [ ] Adjust image dimensions to 3:2 aspect ratio (1200x800)
  - [ ] Ensure PNG format output
  - [ ] Optimize image size
- [ ] Implement caching headers in API routes
  - [ ] Add Cache-Control headers for dynamic images
  - [ ] Configure appropriate max-age values
  - [ ] Handle fallback image caching
- [ ] Update share button and integration
  - [ ] Update button text and styling
  - [ ] Verify share flow
- [ ] Test and verify
  - [ ] Test frame preview in Farcaster
  - [ ] Verify image caching
  - [ ] Test backward compatibility

## Executor's Feedback or Assistance Requests
(To be filled during execution)

## Lessons
- Keep consistent visual style with the game theme
- Ensure proper error handling for share data
- Maintain clear separation between share data and display components

# Points-Based System Implementation

## Background and Motivation
Pivoted from immediate per-win payouts to a points-based system with weekly top 3 rewards. This improves scalability, reduces gas costs, and creates more engaging competition. Added Farcaster profile integration for social dynamics.

## Key Changes Made

### 1. Points System
- **Game Logic**: Updated `app/page.tsx` to award points instead of immediate payouts
  - Win: +3 points
  - Loss: -1 point  
  - Draw: +1 point
- **Leaderboard**: Updated to show points and total games instead of earnings
- **Database**: Added `weekly_payouts` table for tracking weekly rewards

### 2. Weekly Payout System
- **API**: Created `/api/weekly-payout` endpoint for managing weekly rewards
  - 1st place: 0.01 ETH
  - 2nd place: 0.005 ETH
  - 3rd place: 0.002 ETH
- **Admin**: Created admin page at `/admin/weekly-payouts` for triggering payouts
- **Database**: Added weekly_payouts table with proper RLS policies

### 3. Farcaster Profile Integration
- **Leaderboard**: Added clickable profiles that open Warpcast
- **UX**: Added "View Profile" badges for users with Farcaster aliases
- **Social**: Enables easy messaging and social interaction between players

### 4. Database Schema Updates
- Added `weekly_payouts` table with proper indexing
- Added RLS policies for security
- Maintains backward compatibility with existing tables

## Success Criteria Met
- ✅ Points system replaces immediate payouts
- ✅ Weekly top 3 rewards system implemented
- ✅ Farcaster profile integration added
- ✅ Admin interface for managing payouts
- ✅ Database schema updated with proper security
- ✅ No linting errors introduced

## Next Steps
- Set up automated weekly payout cron job
- Consider adding more social features (follow, challenge)
- Add weekly payout notifications
- Consider seasonal rewards beyond weekly

# Updated Points System & Referral Feature

## Background and Motivation
Updated the points system to make wins and losses equal (2 points each) for better balance, and added a referral system to reward users for bringing in new players.

## Key Changes Made

### 1. Updated Points System
- **Win**: +2 points (was +3)
- **Loss**: +2 points (was -1) 
- **Draw**: +1 point (unchanged)
- **Rationale**: Both wins and losses now contribute equally to leaderboard, encouraging more gameplay

### 2. Referral System
- **Reward**: 2 points per successful referral
- **Database**: Added `referrals` table with proper indexing and RLS policies
- **API**: Created `/api/referral` endpoint for processing referrals
- **UI**: Added referral modal with stats and copyable referral links
- **Auto-processing**: Referrals processed automatically when users visit with `?ref=address` parameter

### 3. Database Schema Updates
- Added `referrals` table with unique constraint on referrer/referred pairs
- Added proper RLS policies for security
- Maintains referential integrity

### 4. UI Enhancements
- **Referral Button**: Shows total referrals count in main UI
- **Referral Modal**: Displays stats, referral link, and copy functionality
- **Auto-cleanup**: Removes referral parameter from URL after processing

## Success Criteria Met
- ✅ Wins and losses both give 2 points
- ✅ Referral system implemented with 2 points per referral
- ✅ Database schema updated with proper security
- ✅ UI components added for referral management
- ✅ Automatic referral processing on page load
- ✅ No linting errors introduced

## How It Works Now
1. **Gameplay**: Both wins and losses earn 2 points, draws earn 1 point
2. **Referrals**: Users get referral links, earn 2 points when someone uses their link
3. **Leaderboard**: Shows points and games played, with Farcaster profile integration
4. **Weekly Payouts**: Top 3 players get ETH rewards every Monday
