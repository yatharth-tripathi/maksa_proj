'use client';

import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity, EthBalance } from '@coinbase/onchainkit/identity';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useAccount, useBalance } from 'wagmi';
import { useState } from 'react';

export function ConnectButton() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const viewOnExplorer = () => {
    if (address) {
      window.open(`https://sepolia.basescan.org/address/${address}`, '_blank');
    }
  };

  return (
    <Wallet>
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
        {address ? (
          <>
            <ConnectWallet className="h-9 sm:h-10 px-2 sm:px-3 md:px-4 bg-black md:hover:bg-white text-white md:hover:text-black border-2 border-black font-mono text-[10px] sm:text-xs flex items-center justify-center transition-all duration-300 cursor-pointer">
              <span className="hidden xs:inline">{address.slice(0, 4)}...{address.slice(-3)}</span>
              <span className="inline xs:hidden">{address.slice(0, 3)}..{address.slice(-2)}</span>
            </ConnectWallet>
            <button
              onClick={copyAddress}
              className="h-9 sm:h-10 px-2 sm:px-2.5 md:px-3 bg-black md:hover:bg-white text-white md:hover:text-black border-2 border-black transition-all duration-300 flex items-center justify-center hidden sm:flex"
              title="Copy address"
            >
              {copied ? (
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={viewOnExplorer}
              className="h-9 sm:h-10 px-2 sm:px-2.5 md:px-3 bg-black md:hover:bg-white text-white md:hover:text-black border-2 border-black transition-all duration-300 flex items-center justify-center hidden sm:flex"
              title="View on BaseScan"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </>
        ) : (
          <ConnectWallet className="group relative overflow-hidden bg-black md:hover:bg-white text-white md:hover:text-black border-2 border-black font-semibold text-[10px] sm:text-xs px-3 sm:px-4 md:px-5 py-2 uppercase tracking-wide sm:tracking-widest transition-all duration-300 h-9 sm:h-10 flex items-center justify-center gap-1.5 sm:gap-2">
            <Avatar className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="hidden xs:inline"><Name /></span>
          </ConnectWallet>
        )}
      </div>
      <WalletDropdown className="bg-white border-2 border-black mt-2 min-w-[280px] overflow-hidden">
        <Identity
          className="px-4 py-4 border-b-2 border-black"
        >
          <div className="flex items-center gap-3 mb-3">
            <Avatar />
            <Name />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="font-mono text-[10px] px-2 py-1 flex-1">
              <Address />
            </Badge>
            <button
              onClick={copyAddress}
              className="p-2 border-2 border-black hover:bg-black hover:text-white transition-all duration-200"
              title="Copy address"
            >
              {copied ? '✓' : '📋'}
            </button>
            <button
              onClick={viewOnExplorer}
              className="p-2 border-2 border-black hover:bg-black hover:text-white transition-all duration-200"
              title="View on BaseScan"
            >
              🔗
            </button>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] px-2 py-1">
            <EthBalance />
          </Badge>
        </Identity>
        <div className="p-3 space-y-2">
          <Link
            href="/dashboard"
            className="block w-full text-left px-3 py-2.5 hover:bg-black hover:text-white font-bold text-xs transition-all duration-200 uppercase tracking-wide border-2 border-black"
          >
            MY DASHBOARD
          </Link>
          <Link
            href="/bounties"
            className="block w-full text-left px-3 py-2.5 hover:bg-black hover:text-white font-bold text-xs transition-all duration-200 uppercase tracking-wide border-2 border-black"
          >
            BROWSE GIGS
          </Link>
          <WalletDropdownDisconnect className="block w-full !text-left !px-3 !py-2.5 hover:!bg-black hover:!text-white !font-bold !text-xs !transition-all !duration-200 !uppercase !tracking-wide !border-2 !border-black !bg-transparent" />
        </div>
      </WalletDropdown>
    </Wallet>
  );
}
