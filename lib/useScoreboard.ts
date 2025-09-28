import { useCallback, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, useTransaction } from 'wagmi';

// You'll need to replace this with your deployed contract address
export const SCOREBOARD_ADDRESS = '0x6303d8208FA29C20607BDD7DA3e5dD8f68E5146C';

export const SCOREBOARD_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "result",
        "type": "string"
      }
    ],
    "name": "recordGame",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "getScore",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "wins",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "losses",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "draws",
            "type": "uint256"
          }
        ],
        "internalType": "struct ZeroXScoreboard.Score",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export function useScoreboard() {
  const { address } = useAccount();

  const { data: score, refetch: refetchScore, error: scoreError } = useContractRead({
    address: SCOREBOARD_ADDRESS as `0x${string}`,
    abi: SCOREBOARD_ABI,
    functionName: 'getScore',
    args: address ? [address] : undefined,
    enabled: !!address && !!SCOREBOARD_ADDRESS,
  });

  // Debug logging
  useEffect(() => {
    if (scoreError) {
      console.warn('Scoreboard contract error:', scoreError);
      console.warn('Contract address:', SCOREBOARD_ADDRESS);
    }
    if (address) {
      console.log('Fetching score for address:', address);
      console.log('Score data:', score);
      console.log('Contract address:', SCOREBOARD_ADDRESS);
    }
  }, [address, score, scoreError]);

  const { writeContract: recordGame, data: recordGameData } = useContractWrite();

  const { isLoading: isRecording } = useTransaction({
    hash: recordGameData,
  });

  useEffect(() => {
    if (!isRecording) {
      refetchScore();
    }
  }, [isRecording, refetchScore]);

  const recordResult = useCallback((result: 'win' | 'loss' | 'draw') => {
    if (!SCOREBOARD_ADDRESS) {
      console.warn('No contract address available for recording result');
      return;
    }
    
    recordGame({ 
      address: SCOREBOARD_ADDRESS as `0x${string}`,
      abi: SCOREBOARD_ABI,
      functionName: 'recordGame',
      args: [result]
    });
  }, [recordGame]);

  return {
    score: score ? {
      wins: Number(score.wins),
      losses: Number(score.losses),
      draws: Number(score.draws),
    } : null,
    recordResult,
    isRecording,
  };
}