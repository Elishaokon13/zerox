import { createPublicClient, createWalletClient, http, parseEther, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Grant funding configuration
const GRANT_FUNDING_WALLET = process.env.GRANT_FUNDING_WALLET || '0x0000000000000000000000000000000000000000';
const GRANT_FUNDING_PRIVATE_KEY = process.env.GRANT_FUNDING_PRIVATE_KEY || '';

// USDC configuration
const USDC_TOKEN_ADDRESS = process.env.USDC_TOKEN_ADDRESS || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const USDC_DECIMALS = 6; // USDC has 6 decimals
const GRANT_MAX_WEEKLY_USDC = parseFloat(process.env.GRANT_MAX_WEEKLY_USDC || '100');
const GRANT_TOTAL_CAP_USDC = parseFloat(process.env.GRANT_TOTAL_CAP_USDC || '1200');

// Create clients for Base network
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org')
});

// Only create wallet client if private key is properly configured
const walletClient = GRANT_FUNDING_PRIVATE_KEY && GRANT_FUNDING_PRIVATE_KEY.startsWith('0x') && GRANT_FUNDING_PRIVATE_KEY.length === 66
  ? createWalletClient({
      account: privateKeyToAccount(GRANT_FUNDING_PRIVATE_KEY as `0x${string}`),
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org')
    })
  : null;

export interface GrantPayment {
  id: number;
  recipient_address: string;
  amount_eth: string;
  week_start: string;
}

export interface USDCGrantPayment {
  id: number;
  recipient_address: string;
  amount_usdc: number;
  week_start: string;
}

export async function checkWalletBalance(): Promise<{
  balance: bigint;
  balanceEth: string;
  sufficient: boolean;
}> {
  if (!GRANT_FUNDING_WALLET || GRANT_FUNDING_WALLET === '0x0000000000000000000000000000000000000000') {
    throw new Error('Grant funding wallet not configured');
  }

  const balance = await publicClient.getBalance({
    address: GRANT_FUNDING_WALLET as `0x${string}`
  });

  const balanceEth = (Number(balance) / 1e18).toFixed(6);
  
  return {
    balance,
    balanceEth,
    sufficient: balance > BigInt(0)
  };
}

export async function processGrantPayments(payments: GrantPayment[]): Promise<{
  success: boolean;
  results: Array<{
    id: number;
    txHash?: string;
    error?: string;
    status: 'success' | 'failed';
  }>;
}> {
  if (!walletClient || !walletClient.account) {
    throw new Error('Grant funding wallet private key not configured');
  }

  const results = [];

  for (const payment of payments) {
    try {
      // Convert ETH amount to wei
      const amountWei = parseEther(payment.amount_eth);

      // Send transaction
      const txHash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: payment.recipient_address as `0x${string}`,
        value: amountWei,
        gas: BigInt(21000) // Standard ETH transfer gas limit
      });

      results.push({
        id: payment.id,
        txHash,
        status: 'success' as const
      });

      console.log(`Grant payment sent: ${payment.amount_eth} ETH to ${payment.recipient_address}, TX: ${txHash}`);

    } catch (error) {
      console.error(`Failed to send grant payment for ID ${payment.id}:`, error);
      results.push({
        id: payment.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed' as const
      });
    }
  }

  return {
    success: results.some(r => r.status === 'success'),
    results
  };
}

export async function updatePaymentStatus(
  paymentId: number, 
  txHash: string, 
  status: 'completed' | 'failed'
): Promise<void> {
  // This would update the database with the transaction hash and status
  // Implementation depends on your database setup
  console.log(`Updating payment ${paymentId}: ${txHash} - ${status}`);
}

// USDC ERC-20 ABI (minimal for transfer function)
const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  }
] as const;

export async function checkUSDCBalance(): Promise<{
  balance: bigint;
  balanceUsdc: string;
  sufficient: boolean;
}> {
  if (!GRANT_FUNDING_WALLET || GRANT_FUNDING_WALLET === '0x0000000000000000000000000000000000000000') {
    throw new Error('Grant funding wallet not configured');
  }

  const balance = await publicClient.readContract({
    address: USDC_TOKEN_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [GRANT_FUNDING_WALLET as `0x${string}`]
  });

  const balanceUsdc = formatUnits(balance, USDC_DECIMALS);
  
  return {
    balance,
    balanceUsdc,
    sufficient: balance > BigInt(0)
  };
}

export async function processUSDCGrantPayments(payments: USDCGrantPayment[]): Promise<{
  success: boolean;
  results: Array<{
    id: number;
    txHash?: string;
    error?: string;
    status: 'success' | 'failed';
  }>;
}> {
  if (!walletClient || !walletClient.account) {
    throw new Error('Grant funding wallet private key not configured');
  }

  // Check USDC balance before processing
  const balanceInfo = await checkUSDCBalance();
  const totalRequired = payments.reduce((sum, payment) => sum + payment.amount_usdc, 0);
  const totalRequiredWei = parseUnits(totalRequired.toString(), USDC_DECIMALS);

  if (balanceInfo.balance < totalRequiredWei) {
    throw new Error(`Insufficient USDC balance. Required: ${totalRequired} USDC, Available: ${balanceInfo.balanceUsdc} USDC`);
  }

  const results = [];

  for (const payment of payments) {
    try {
      // Convert USDC amount to wei (6 decimals)
      const amountWei = parseUnits(payment.amount_usdc.toString(), USDC_DECIMALS);

      // Send USDC transfer transaction
      const txHash = await walletClient.writeContract({
        address: USDC_TOKEN_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [
          payment.recipient_address as `0x${string}`,
          amountWei
        ]
      });

      results.push({
        id: payment.id,
        txHash,
        status: 'success' as const
      });

      console.log(`USDC grant payment sent: ${payment.amount_usdc} USDC to ${payment.recipient_address}, TX: ${txHash}`);

    } catch (error) {
      console.error(`Failed to send USDC grant payment for ID ${payment.id}:`, error);
      results.push({
        id: payment.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed' as const
      });
    }
  }

  return {
    success: results.some(r => r.status === 'success'),
    results
  };
}

export function isGrantSystemReady(): boolean {
  return !!(
    GRANT_FUNDING_WALLET && 
    GRANT_FUNDING_WALLET !== '0x0000000000000000000000000000000000000000' &&
    GRANT_FUNDING_PRIVATE_KEY &&
    GRANT_FUNDING_PRIVATE_KEY.startsWith('0x') &&
    GRANT_FUNDING_PRIVATE_KEY.length === 66 &&
    walletClient
  );
}

export function getUSDCConfig() {
  return {
    tokenAddress: USDC_TOKEN_ADDRESS,
    decimals: USDC_DECIMALS,
    maxWeeklyUsdc: GRANT_MAX_WEEKLY_USDC,
    totalCapUsdc: GRANT_TOTAL_CAP_USDC
  };
}
