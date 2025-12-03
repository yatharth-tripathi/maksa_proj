'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [currentChainId, setCurrentChainId] = useState<number | undefined>();

  useEffect(() => {
    if (isConnected) {
      setCurrentChainId(chainId);
      if (chainId !== baseSepolia.id) {
        setIsWrongNetwork(true);
      } else {
        setIsWrongNetwork(false);
      }
    } else {
      setIsWrongNetwork(false);
      setCurrentChainId(undefined);
    }
  }, [isConnected, chainId]);

  if (!isConnected) {
    return <>{children}</>;
  }

  if (isWrongNetwork) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full border-4 border-black p-8 bg-yellow-50">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="font-black text-2xl uppercase mb-2">WRONG NETWORK</h2>
            <p className="font-mono text-sm opacity-60">
              QUICKGIG only works on Base Sepolia testnet
            </p>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-black p-4 bg-white">
              <p className="font-mono text-xs mb-2 opacity-60">Current Network:</p>
              <p className="font-bold text-lg">
                {currentChainId === 1 ? 'Ethereum Mainnet' :
                 currentChainId === 8453 ? 'Base Mainnet' :
                 currentChainId === 84532 ? 'Base Sepolia' :
                 `Chain ID: ${currentChainId}`}
              </p>
            </div>

            <div className="border-2 border-black p-4 bg-white">
              <p className="font-mono text-xs mb-2 opacity-60">Required Network:</p>
              <p className="font-bold text-lg">Base Sepolia Testnet</p>
            </div>

            <Button
              onClick={() => switchChain({ chainId: baseSepolia.id })}
              className="w-full h-12 bg-black hover:bg-white text-white hover:text-black border-4 border-black font-black text-sm uppercase tracking-wider transition-all duration-300"
            >
              SWITCH TO BASE SEPOLIA
            </Button>

            <p className="text-center font-mono text-xs opacity-60">
              Need testnet ETH?{' '}
              <a
                href="https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-black"
              >
                Get it from the Base faucet
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
