'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '@/lib/store/chat';
import { Button } from '@/components/ui/button';
import { useAccount } from 'wagmi';
import { PaymentModal } from '@/components/x402/payment-modal';
import { isX402Response, extractPaymentRequest } from '@/lib/x402/middleware';
import type { X402PaymentRequest, X402PaymentProof } from '@/lib/x402/types';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function InputBar() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const { isConnected } = useAccount();
  const addMessage = useChatStore((state) => state.addMessage);
  const setLoading = useChatStore((state) => state.setLoading);
  const isLoading = useChatStore((state) => state.isLoading);
  const needsSessionCheck = useChatStore((state) => state.needsSessionCheck);
  const getCurrentSession = useChatStore((state) => state.getCurrentSession);
  const updateMessagesRemaining = useChatStore((state) => state.updateMessagesRemaining);
  const createNewSession = useChatStore((state) => state.createNewSession);
  const [paymentRequest, setPaymentRequest] = useState<X402PaymentRequest | null>(null);

  const session = getCurrentSession();
  const isSessionLocked = session?.locked || false;

  const sendMessageToAgent = useCallback(async (userMessage: string, proof?: X402PaymentProof, silent: boolean = false) => {
    try {
      const session = getCurrentSession();
      if (!session) return;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };

      // Add payment proof if available
      if (proof) {
        headers['X-Payment-Proof'] = JSON.stringify(proof);
      }

      // Call AI agent endpoint with X402 support
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage,
          sessionId: session.id,
        }),
      });

      // Check for 402 Payment Required
      if (isX402Response(response)) {
        const payment = await extractPaymentRequest(response);
        setPaymentRequest(payment);
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Update session ID if returned (happens after payment)
      if (data.sessionId && session.id !== data.sessionId) {
        // Backend created a new session, update our local reference
        console.log('[InputBar] Updating session ID:', session.id, '->', data.sessionId);
        useChatStore.setState((state) => {
          const currentSession = state.sessions[session.id];
          if (currentSession) {
            // Copy the session with the new ID
            const newSessions = { ...state.sessions };
            delete newSessions[session.id];
            newSessions[data.sessionId] = {
              ...currentSession,
              id: data.sessionId,
              messagesRemaining: data.messagesRemaining ?? currentSession.messagesRemaining,
            };
            return {
              sessions: newSessions,
              currentSessionId: data.sessionId,
            };
          }
          return state;
        });
      }

      // Update messages remaining
      if (data.messagesRemaining !== undefined) {
        updateMessagesRemaining(data.messagesRemaining);
      }

      // Check if response contains a special action (bounty form)
      let messageContent = data.message;
      const messageMetadata: {
        paid?: boolean;
        messagesRemaining?: number;
        action?: { type: string; data?: Record<string, unknown> }
      } = {
        paid: data.paid,
        messagesRemaining: data.messagesRemaining,
      };

      try {
        const parsed = JSON.parse(data.message);
        if (parsed.action) {
          messageContent = parsed.message;
          messageMetadata.action = parsed.action;
        }
      } catch {
        // Not JSON, use as regular message
      }

      // Add assistant response (unless silent)
      if (!silent) {
        addMessage({
          role: 'assistant',
          content: messageContent,
          metadata: messageMetadata,
        });
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Failed to send message'}`);
    } finally {
      setLoading(false);
    }
  }, [getCurrentSession, addMessage, updateMessagesRemaining, setLoading]);

  // Handle upfront session check - trigger payment immediately ONLY for NEW sessions
  useEffect(() => {
    const session = getCurrentSession();
    // Only trigger for brand new sessions (no messages AND no messagesRemaining)
    if (needsSessionCheck && isConnected && session &&
        session.messages.length === 0 && session.messagesRemaining === 0) {
      // Send greeting request to establish session (will trigger 402 payment)
      // Don't add to messages - this is just to trigger payment modal
      setLoading(true);
      sendMessageToAgent('Hello', undefined, true); // Pass silent flag
      useChatStore.setState({ needsSessionCheck: false });
    } else if (needsSessionCheck && session && (session.messages.length > 0 || session.messagesRemaining > 0)) {
      // Session already exists with messages or credits - don't trigger payment
      useChatStore.setState({ needsSessionCheck: false });
    }
  }, [needsSessionCheck, isConnected, getCurrentSession, sendMessageToAgent, setLoading]);

  // Also trigger when user connects wallet on empty chat - but ONLY if truly empty
  useEffect(() => {
    const session = getCurrentSession();
    if (isConnected && session && session.messages.length === 0 && session.messagesRemaining === 0) {
      // Trigger session check when wallet connects to empty chat
      useChatStore.setState({ needsSessionCheck: true });
    }
  }, [isConnected, getCurrentSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Check wallet connection
    if (!isConnected) {
      toast.error('Wallet connection required to start mission planning');
      return;
    }

    // Add user message
    const userMessage = input.trim();
    addMessage({
      role: 'user',
      content: userMessage,
    });
    setInput('');
    setLoading(true);

    await sendMessageToAgent(userMessage);
  };

  const handlePaymentComplete = async (proof: X402PaymentProof) => {
    setPaymentRequest(null);
    setLoading(false); // Reset loading state immediately

    // Check if this was an upfront payment (no user messages yet)
    const session = getCurrentSession();
    if (!session) return;

    const hasUserMessages = session.messages.some((m) => m.role === 'user');

    if (!hasUserMessages) {
      // Upfront payment - send greeting request (will show AI greeting)
      toast.success('Session active! Mission planning ready.');
      setLoading(true);
      await sendMessageToAgent('Hello', proof, false); // Not silent - show greeting
    } else {
      // Retry the last message with payment proof
      const lastUserMessage = [...session.messages]
        .reverse()
        .find((m) => m.role === 'user');

      if (lastUserMessage) {
        toast.success('Payment verified. Processing your request...');
        setLoading(true);
        await sendMessageToAgent(lastUserMessage.content, proof);
      }
    }
  };

  const handlePaymentCancel = () => {
    setPaymentRequest(null);
    setLoading(false);
    toast.info('Payment cancelled. Session not started.');
  };

  return (
    <>
      <div className="border-t-2 border-black bg-white p-2 sm:p-3 md:p-4">
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">
          {/* Locked Session Warning */}
          {isSessionLocked && (
            <div className="border-2 border-black bg-yellow-50 p-3 sm:p-4 mb-2 sm:mb-3 md:mb-4">
              <p className="font-bold text-[10px] sm:text-xs uppercase mb-1.5 sm:mb-2">SESSION COMPLETE</p>
              <p className="font-mono text-[10px] sm:text-xs mb-2 sm:mb-3">
                You have used all 30 messages in this session. Start a new session to continue mission planning.
              </p>
              <Button
                type="button"
                onClick={() => {
                  const newSessionId = createNewSession();
                  router.push('/chat');
                }}
                className="h-9 sm:h-10 px-3 sm:px-4 text-[10px] sm:text-xs w-full sm:w-auto"
              >
                START NEW SESSION
              </Button>
            </div>
          )}

          <div className="flex gap-1.5 sm:gap-2 md:gap-3 items-center">
            <div className="flex-1 min-w-0">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={
                  isSessionLocked
                    ? 'SESSION COMPLETE'
                    : isConnected
                    ? 'TYPE MESSAGE...'
                    : 'CONNECT WALLET'
                }
                disabled={!isConnected || isLoading || isSessionLocked}
                rows={1}
                className="w-full h-10 sm:h-11 md:h-12 resize-none border-2 border-black bg-white px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 font-mono text-[11px] sm:text-xs text-black placeholder:text-black placeholder:opacity-30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              />
            </div>
            <Button
              type="submit"
              disabled={!isConnected || !input.trim() || isLoading || isSessionLocked}
              isLoading={isLoading}
              className="h-10 sm:h-11 md:h-12 px-3 sm:px-4 md:px-6 text-[10px] sm:text-xs flex-shrink-0"
            >
              {isLoading ? '...' : 'SEND'}
            </Button>
            <button
              type="button"
              onClick={() => router.push('/agents')}
              className="hidden md:flex h-10 sm:h-11 md:h-12 px-3 sm:px-4 md:px-6 bg-black md:hover:bg-white text-white md:hover:text-black border-2 border-black transition-all duration-300 font-bold text-[10px] sm:text-xs uppercase tracking-wide whitespace-nowrap items-center justify-center"
            >
              FIND AGENTS
            </button>
          </div>
        </form>
      </div>

      {/* X402 Payment Modal */}
      {paymentRequest && (
        <PaymentModal
          paymentRequest={paymentRequest}
          onPaymentComplete={handlePaymentComplete}
          onCancel={handlePaymentCancel}
        />
      )}
    </>
  );
}
