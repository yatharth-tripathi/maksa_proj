'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useApproveToken, useTokenAllowance, useTransferToken, useTokenBalance } from '@/lib/contracts/erc20';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { toast } from 'sonner';
import type { X402PaymentRequest, X402PaymentProof } from '@/lib/x402/types';
import { createPaymentProof } from '@/lib/x402/middleware';

interface PaymentModalProps {
  paymentRequest: X402PaymentRequest;
  onPaymentComplete: (proof: X402PaymentProof) => void;
  onCancel: () => void;
}

export function PaymentModal({ paymentRequest, onPaymentComplete, onCancel }: PaymentModalProps) {
  const { address } = useAccount();
  const [step, setStep] = useState<'preview' | 'approving' | 'paying' | 'verifying'>('preview');
  const [copied, setCopied] = useState(false);

  const amount = BigInt(paymentRequest.amount);
  const amountFormatted = formatUnits(amount, 6); // USDC has 6 decimals

  // Copy and explorer handlers
  const copyRecipient = () => {
    navigator.clipboard.writeText(paymentRequest.recipient);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const viewRecipientOnExplorer = () => {
    window.open(`https://sepolia.basescan.org/address/${paymentRequest.recipient}`, '_blank');
  };

  // Check current balance
  const { data: balanceData, isLoading: isLoadingBalance } = useTokenBalance(CONTRACTS.USDC, address);
  const balance = balanceData as bigint | undefined | null;
  const hasEnoughBalance = balance !== undefined && balance !== null && balance >= amount;

  // Check current allowance
  const { data: allowanceData, refetch: refetchAllowance } = useTokenAllowance(
    CONTRACTS.USDC,
    address,
    paymentRequest.recipient
  );
  const allowance = (allowanceData as bigint | undefined) || 0n;

  const needsApproval = !allowance || allowance < amount;

  // Approval hooks
  const { approve, data: approveHash, isPending: isApproving } = useApproveToken();
  const { isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Transfer hooks
  const { transfer, data: transferHash, isPending: isTransferring } = useTransferToken();
  const { isSuccess: isTransferred } = useWaitForTransactionReceipt({
    hash: transferHash,
  });

  // Handle approval
  const handleApprove = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      setStep('approving');
      toast.info('Approving USDC...');
      approve(CONTRACTS.USDC, paymentRequest.recipient, amount);
    } catch (error) {
      toast.error(`Approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('preview');
    }
  };

  // Handle payment
  const handlePay = useCallback(async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      setStep('paying');
      toast.info('Sending payment...');
      transfer(CONTRACTS.USDC, paymentRequest.recipient, amount);
    } catch (error) {
      toast.error(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('preview');
    }
  }, [address, paymentRequest.recipient, amount, transfer]);

  // Auto-transition after approval
  useEffect(() => {
    if (isApproved && step === 'approving') {
      toast.success('USDC approved! Now sending payment...');
      refetchAllowance();
      setStep('preview');
      setTimeout(() => handlePay(), 1000);
    }
  }, [isApproved, step, handlePay, refetchAllowance]);

  // Handle successful transfer
  useEffect(() => {
    if (isTransferred && transferHash && step === 'paying') {
      setStep('verifying');
      toast.success('Payment sent! Verifying...');

      // Create payment proof
      const proof = createPaymentProof(
        transferHash,
        address!,
        paymentRequest.recipient,
        paymentRequest.amount,
        paymentRequest.token
      );

      // Complete payment flow
      setTimeout(() => {
        onPaymentComplete(proof);
      }, 1000);
    }
  }, [isTransferred, transferHash, step, address, onPaymentComplete, paymentRequest.amount, paymentRequest.recipient, paymentRequest.token]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="max-w-md w-full border-2 border-black bg-white">
        {/* Header */}
        <div className="bg-black text-white p-4 sm:p-5 md:p-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-white mx-auto mb-3 sm:mb-4 flex items-center justify-center">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white"></div>
          </div>
          <h2 className="font-black text-lg sm:text-xl md:text-2xl uppercase tracking-tight text-center">
            MISSION SESSION - PAYMENT REQUIRED
          </h2>
        </div>

        <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
          {/* Payment Details */}
          <div className="border-2 border-black p-3 sm:p-4 space-y-2 sm:space-y-3 bg-white">
            <div>
              <div className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black mb-1 opacity-60">
                INTELLIGENCE SESSION:
              </div>
              <p className="font-mono text-xs sm:text-sm uppercase">
                {paymentRequest.description || 'MISSION PLANNING SESSION WITH QUICKGIG-AI-AGENT (30 MESSAGES)'}
              </p>
            </div>

            <div className="border-t-2 border-black pt-2 sm:pt-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide">
                  AMOUNT:
                </span>
                <span className="font-black text-lg sm:text-xl">
                  ${amountFormatted} USDC
                </span>
              </div>
            </div>

            <div className="border-t-2 border-black pt-2 sm:pt-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide opacity-60">
                  RECIPIENT:
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-mono text-[10px] sm:text-xs">
                    {paymentRequest.recipient.slice(0, 6)}...{paymentRequest.recipient.slice(-4)}
                  </span>
                  <button
                    onClick={copyRecipient}
                    className="w-4 h-4 sm:w-5 sm:h-5 border border-black md:hover:bg-black md:hover:text-white transition-all duration-200 flex items-center justify-center"
                    title="Copy address"
                  >
                    {copied ? (
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={viewRecipientOnExplorer}
                    className="w-4 h-4 sm:w-5 sm:h-5 border border-black md:hover:bg-black md:hover:text-white transition-all duration-200 flex items-center justify-center"
                    title="View on explorer"
                  >
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="border-2 border-black p-3 sm:p-4 bg-white">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-black"></div>
              </div>
              <p className="font-mono text-[10px] sm:text-xs">
                Talk to AI agents instantly. Pay per session, not per month. Fast payment via X402 protocol on Base.
              </p>
            </div>
          </div>

          {/* Warnings */}
          {!isLoadingBalance && !hasEnoughBalance && address && balance !== undefined && (
            <div className="border-2 border-red-600 bg-red-50 p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="font-black text-[10px] sm:text-xs text-red-600">!</span>
                </div>
                <div>
                  <p className="font-mono text-[10px] sm:text-xs text-red-900">
                    Insufficient USDC balance. You need ${amountFormatted} USDC.
                  </p>
                  {balance !== undefined && balance !== null && (
                    <p className="font-mono text-[10px] sm:text-xs mt-1.5 sm:mt-2 text-red-700">
                      Current balance: ${formatUnits(balance, 6)} USDC
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!address && (
            <div className="border-2 border-black p-3 sm:p-4 bg-white">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="font-black text-[10px] sm:text-xs">!</span>
                </div>
                <p className="font-mono text-[10px] sm:text-xs">
                  Please connect your wallet to make payment
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 sm:space-y-3">
            {step === 'approving' && (
              <div className="border-2 border-black p-3 sm:p-4 bg-white text-center">
                <Loader size="md" />
                <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide">
                  WAITING FOR APPROVAL CONFIRMATION...
                </p>
              </div>
            )}

            {step === 'paying' && (
              <div className="border-2 border-black p-3 sm:p-4 bg-white text-center">
                <Loader size="md" />
                <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide">
                  SENDING PAYMENT TO AGENT...
                </p>
              </div>
            )}

            {step === 'verifying' && (
              <div className="border-2 border-black p-3 sm:p-4 bg-black text-white text-center">
                <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 sm:gap-2">
                  <span className="text-base sm:text-lg">✓</span>
                  PAYMENT VERIFIED! CONTINUING...
                </p>
              </div>
            )}

            {step === 'preview' && needsApproval && (
              <Button
                onClick={handleApprove}
                disabled={isApproving || !address || isLoadingBalance || (balance !== undefined && !hasEnoughBalance)}
                isLoading={isApproving || isLoadingBalance}
                className="w-full h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
              >
                {isLoadingBalance ? 'CHECKING BALANCE...' : isApproving ? 'APPROVING USDC...' : 'APPROVE USDC'}
              </Button>
            )}

            {step === 'preview' && !needsApproval && (
              <Button
                onClick={handlePay}
                disabled={isTransferring || !address || isLoadingBalance || (balance !== undefined && !hasEnoughBalance)}
                isLoading={isTransferring || isLoadingBalance}
                className="w-full h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
              >
                {isLoadingBalance ? 'CHECKING BALANCE...' : isTransferring ? 'SENDING PAYMENT...' : `PAY $${amountFormatted} USDC`}
              </Button>
            )}

            {step === 'preview' && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="w-full h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
              >
                CANCEL
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

