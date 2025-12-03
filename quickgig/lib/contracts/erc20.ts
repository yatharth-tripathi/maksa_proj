import { useReadContract, useWriteContract } from 'wagmi';
import type { Address } from 'viem';

// Standard ERC20 ABI (minimal)
export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

/**
 * Get token balance for an address
 */
export function useTokenBalance(tokenAddress: Address, owner?: Address) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
  });
}

/**
 * Get token allowance
 */
export function useTokenAllowance(tokenAddress: Address, owner?: Address, spender?: Address) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
  });
}

/**
 * Get token decimals
 */
export function useTokenDecimals(tokenAddress: Address) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });
}

/**
 * Approve token spending
 */
export function useApproveToken() {
  const { writeContract, ...rest } = useWriteContract();

  const approve = (tokenAddress: Address, spender: Address, amount: bigint) => {
    return writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, amount],
    });
  };

  return { approve, ...rest };
}

/**
 * Transfer tokens
 */
export function useTransferToken() {
  const { writeContract, ...rest } = useWriteContract();

  const transfer = (tokenAddress: Address, to: Address, amount: bigint) => {
    return writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, amount],
    });
  };

  return { transfer, ...rest };
}
