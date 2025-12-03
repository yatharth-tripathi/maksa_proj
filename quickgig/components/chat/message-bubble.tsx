'use client';

import { type Message } from '@/lib/store/chat';
import { cn } from '@/lib/utils';
import { BountyPreview } from '@/components/transaction/bounty-preview';
import { BountyCreationForm } from './bounty-creation-form';
import { BountyConfirmation } from './bounty-confirmation';
import { GigCreationForm } from './gig-creation-form';
import { AgentRecommendationPanel } from './agent-recommendation-panel';
import { MissionModePanel } from './mission-mode-panel';
import { useChatStore } from '@/lib/store/chat';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const addMessage = useChatStore((state) => state.addMessage);

  // Check if this message has a function call (transaction preview)
  const functionCall = message.metadata?.functionCall;

  // Check if this message has an action (new action-based flow)
  const action = (message.metadata as { action?: { type: string; prefilled?: unknown; data?: unknown; txHash?: string } })?.action;

  // Don't render system messages (they're shown as toasts now)
  if (isSystem) {
    return null;
  }

  // Handle new action-based flow
  if (action && !isUser) {
    return (
      <div className="flex w-full mb-4 sm:mb-5 md:mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300 justify-start">
        <div className="max-w-[95%] sm:max-w-[90%] md:max-w-[85%] space-y-2 sm:space-y-3">
          {/* AI message */}
          <div className="bg-gray-200 text-black rounded-[16px] sm:rounded-[20px] rounded-bl-[4px] px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="text-[13px] sm:text-[14px] md:text-[15px] leading-relaxed break-words prose prose-sm max-w-none prose-p:my-2 sm:prose-p:my-3 prose-p:leading-relaxed prose-strong:font-bold prose-strong:text-black prose-em:italic prose-ul:my-3 sm:prose-ul:my-4 prose-ul:list-disc prose-ul:pl-5 sm:prose-ul:pl-6 prose-ul:space-y-1.5 sm:prose-ul:space-y-2 prose-ol:my-3 sm:prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-5 sm:prose-ol:pl-6 prose-ol:space-y-1.5 sm:prose-ol:space-y-2 prose-li:my-0 prose-li:leading-relaxed prose-headings:font-bold prose-headings:mt-3 sm:prose-headings:mt-4 prose-headings:mb-2 sm:prose-headings:mb-3 prose-h1:text-base sm:prose-h1:text-lg prose-h2:text-sm sm:prose-h2:text-base prose-h3:text-xs sm:prose-h3:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          </div>

          {/* Action component */}
          {action.type === 'bounty_form' ? (
            <BountyCreationForm prefilled={action.prefilled as { description?: string; amount?: string } | undefined} />
          ) : null}

          {action.type === 'gig_form' ? (
            <GigCreationForm prefilled={action.prefilled as { description?: string } | undefined} />
          ) : null}

          {action.type === 'bounty_confirmation' ? (
            <BountyConfirmation
              messageId={message.id}
              data={action.data as { description: string; amount: string; deadline: string; tags: string[]; completed?: boolean }}
            />
          ) : null}

          {action.type === 'bounty_success' ? (
            <div className="border-2 border-black bg-black text-white p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 border-2 border-white bg-white flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-black"></div>
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg uppercase leading-tight">
                    MISSION DEPLOYED!
                  </h3>
                  <p className="font-mono text-[10px] sm:text-xs opacity-80">
                    Your mission is live. Agents can now discover and apply.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Link href="/bounties" className="flex-1">
                  <Button className="w-full text-[10px] sm:text-xs">
                    VIEW ALL MISSIONS
                  </Button>
                </Link>
                <Link href="/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full text-[10px] sm:text-xs">
                    MISSION CONTROL
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}

          {action.type === 'agent_recommendation' && action.data ? (
            <AgentRecommendationPanel data={action.data as never} />
          ) : null}

          {action.type === 'mission_mode_selection' && action.data ? (
            <MissionModePanel data={action.data as { originalMessage: string }} />
          ) : null}

          {/* Timestamp */}
          <div className="text-[10px] sm:text-[11px] px-2 text-gray-500 text-left">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full mb-4 sm:mb-5 md:mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn('max-w-[90%] sm:max-w-[85%] md:max-w-[75%]')}>
        {/* Message bubble */}
        <div className="relative">
          <div
            className={cn(
              'px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-200',
              isUser
                ? 'bg-black text-white rounded-[16px] sm:rounded-[20px] rounded-br-[4px]'
                : 'bg-gray-200 text-black rounded-[16px] sm:rounded-[20px] rounded-bl-[4px]'
            )}
          >
          {/* Message content */}
          <div className={cn(
            "text-[13px] sm:text-[14px] md:text-[15px] leading-relaxed break-words",
            isUser
              ? "prose prose-sm max-w-none prose-p:my-2 sm:prose-p:my-3 prose-p:leading-relaxed prose-strong:font-bold prose-strong:text-white prose-em:italic prose-ul:my-3 sm:prose-ul:my-4 prose-ul:list-disc prose-ul:pl-5 sm:prose-ul:pl-6 prose-ul:space-y-1.5 sm:prose-ul:space-y-2 prose-ol:my-3 sm:prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-5 sm:prose-ol:pl-6 prose-ol:space-y-1.5 sm:prose-ol:space-y-2 prose-li:my-0 prose-li:leading-relaxed prose-p:text-white prose-headings:text-white prose-headings:font-bold prose-headings:mt-3 sm:prose-headings:mt-4 prose-headings:mb-2 sm:prose-headings:mb-3 prose-li:text-white prose-h1:text-base sm:prose-h1:text-lg prose-h2:text-sm sm:prose-h2:text-base prose-h3:text-xs sm:prose-h3:text-sm"
              : "prose prose-sm max-w-none prose-p:my-2 sm:prose-p:my-3 prose-p:leading-relaxed prose-strong:font-bold prose-strong:text-black prose-em:italic prose-ul:my-3 sm:prose-ul:my-4 prose-ul:list-disc prose-ul:pl-5 sm:prose-ul:pl-6 prose-ul:space-y-1.5 sm:prose-ul:space-y-2 prose-ol:my-3 sm:prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-5 sm:prose-ol:pl-6 prose-ol:space-y-1.5 sm:prose-ol:space-y-2 prose-li:my-0 prose-li:leading-relaxed prose-headings:font-bold prose-headings:mt-3 sm:prose-headings:mt-4 prose-headings:mb-2 sm:prose-headings:mb-3 prose-h1:text-base sm:prose-h1:text-lg prose-h2:text-sm sm:prose-h2:text-base prose-h3:text-xs sm:prose-h3:text-sm"
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>

          {/* Function call preview */}
          {functionCall && functionCall.name === 'createBounty' && (
            <div className="mt-4 pt-4 border-t-2 border-current">
              <BountyPreview
                requirements={functionCall.arguments.requirements as string}
                amount={functionCall.arguments.amount as number}
                deadline={functionCall.arguments.deadline as number}
                onSuccess={(bountyId, txHash) => {
                  addMessage({
                    role: 'assistant',
                    content: `Success! Your bounty has been created with ID ${bountyId}. Workers can now submit bids.`,
                    metadata: { bountyId, txHash },
                  });
                }}
                onCancel={() => {
                  addMessage({
                    role: 'system',
                    content: 'Bounty creation cancelled.',
                  });
                }}
              />
            </div>
          )}

          {/* Transaction metadata */}
          {message.metadata?.txHash && (
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-current/20">
              <a
                href={`https://sepolia.basescan.org/tx/${message.metadata.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] sm:text-xs font-medium md:hover:underline transition-all inline-flex items-center gap-1 sm:gap-1.5 opacity-80 md:hover:opacity-100"
              >
                View transaction
                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
          </div>
        </div>

        {/* Timestamp - outside bubble */}
        <div className={cn(
          'text-[10px] sm:text-[11px] mt-1 sm:mt-1.5 px-2 text-gray-500',
          isUser ? 'text-right' : 'text-left'
        )}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
