'use client';

import { useState } from 'react';
import { parseUnits } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import { 
  Transaction, 
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from '@coinbase/onchainkit/transaction';
import type { LifecycleStatus } from '@coinbase/onchainkit/transaction';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { buildCreateBountyCalls } from '@/lib/contracts/transactions';
import { paymasterCapabilities } from '@/lib/onchainkit/config';
import { toast } from 'sonner';

interface BountyPreviewProps {
  requirements: string;
  amount: number;
  deadline: number;
  onSuccess?: (bountyId: number, txHash: string) => void;
  onCancel?: () => void;
}

export function BountyPreview({
  requirements,
  amount,
  deadline,
  onSuccess,
  onCancel,
}: BountyPreviewProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  const amountInWei = parseUnits(amount.toString(), 6); // USDC has 6 decimals
  const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + deadline * 24 * 60 * 60);

  // Build transaction calls (approve + create bounty)
  const calls = buildCreateBountyCalls(
    CONTRACTS.USDC,
    amountInWei,
    deadlineTimestamp,
    requirements
  );

  const handleStatusChange = (status: LifecycleStatus) => {
    console.log('Transaction status:', status);
    
    if (status.statusName === 'success') {
      const hash = status.statusData?.transactionReceipts?.[0]?.transactionHash;
      if (hash) {
        setTxHash(hash);
        setIsSuccess(true);
        toast.success('Bounty created successfully!');
        
        // Call onSuccess callback
        if (onSuccess) {
          // TODO: Extract bounty ID from transaction logs
          onSuccess(0, hash);
        }
      }
    } else if (status.statusName === 'error') {
      toast.error(`Transaction failed: ${status.statusData?.message || 'Unknown error'}`);
    }
  };

  if (isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bounty Created!</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-success p-4 bg-background">
              <p className="font-mono text-sm">
                Your bounty has been created successfully. Workers can now bid on it.
              </p>
            </div>

            {txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block font-mono text-sm border-2 border-foreground p-3 hover:bg-foreground hover:text-background transition-colors"
              >
                View Transaction →
              </a>
            )}

            <Button onClick={() => window.location.href = '/bounties'} className="w-full">
              View All Bounties
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Bounty</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Details */}
          <div className="border-2 border-foreground p-4 space-y-3">
            <div className="flex justify-between">
              <span className="font-mono text-sm uppercase tracking-wider text-secondary">
                Requirements:
              </span>
            </div>
            <p className="font-sans text-sm">{requirements}</p>

            <div className="flex justify-between border-t-2 border-foreground pt-3">
              <span className="font-mono text-sm uppercase tracking-wider text-secondary">
                Payment:
              </span>
              <span className="font-mono text-sm font-bold">
                ${amount} USDC
              </span>
            </div>

            <div className="flex justify-between">
              <span className="font-mono text-sm uppercase tracking-wider text-secondary">
                Deadline:
              </span>
              <span className="font-mono text-sm">
                {deadline} days
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="border-2 border-accent p-3 bg-background">
            <p className="font-mono text-xs text-accent">
              💡 Batches approve + create in one transaction • Gasless for Coinbase Smart Wallet users
            </p>
          </div>

          {/* OnchainKit Transaction Component with Paymaster */}
          <Transaction
            calls={calls}
            chainId={baseSepolia.id}
            capabilities={paymasterCapabilities}
            onStatus={handleStatusChange}
          >
            <TransactionButton 
              className="w-full border-2 border-foreground bg-foreground text-background hover:bg-background hover:text-foreground transition-colors font-mono text-sm uppercase tracking-wider py-2"
              text="Create Bounty"
            />
            <TransactionStatus className="mt-2">
              <TransactionStatusLabel className="font-mono text-sm" />
              <TransactionStatusAction className="font-mono text-xs mt-2" />
            </TransactionStatus>
          </Transaction>

          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
