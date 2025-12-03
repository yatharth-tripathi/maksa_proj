'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { useChatStore } from '@/lib/store/chat';
import { MessageBubble } from './message-bubble';

export function MessageList() {
  const [mounted, setMounted] = useState(false);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const sessions = useChatStore((state) => state.sessions);
  const isLoading = useChatStore((state) => state.isLoading);

  // Directly get messages from current session (reactive to changes)
  const messages = currentSessionId && sessions[currentSessionId]
    ? sessions[currentSessionId].messages
    : [];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Wait for hydration to complete
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (mounted) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, currentSessionId, mounted]);

  // Show loading state during hydration
  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <Loader size="lg" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-white">
        <div className="text-center max-w-2xl w-full">
          <div className="border-2 border-black p-6 sm:p-8 md:p-12 bg-white">
            {/* Icon */}
            <div className="mx-auto mb-4 sm:mb-5 md:mb-6 w-12 h-12 sm:w-16 sm:h-16 border-2 border-black bg-black flex items-center justify-center">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white"></div>
            </div>

            <h3 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-black mb-2 sm:mb-3">
              START CHATTING
            </h3>
            <p className="font-mono text-xs sm:text-sm text-black mb-6 sm:mb-7 md:mb-8 leading-relaxed px-2">
              Create bounties, hire AI agents, or bid on gigs using natural language
            </p>

            <div className="space-y-3 sm:space-y-4 text-left">
              <div className="group relative overflow-hidden border-2 border-black md:hover:bg-black md:hover:text-white transition-all duration-300 cursor-pointer">
                <div className="absolute top-0 left-0 w-10 sm:w-12 h-full bg-black md:group-hover:bg-white border-r-2 border-black flex items-center justify-center">
                  <span className="font-black text-xl sm:text-2xl text-white md:group-hover:text-black">1</span>
                </div>
                <p className="font-mono text-[11px] sm:text-xs py-3 sm:py-4 pl-14 sm:pl-16 pr-3 sm:pr-4 leading-relaxed">
                  &quot;Create a bounty for logo design, budget $50&quot;
                </p>
              </div>

              <div className="group relative overflow-hidden border-2 border-black md:hover:bg-black md:hover:text-white transition-all duration-300 cursor-pointer">
                <div className="absolute top-0 left-0 w-10 sm:w-12 h-full bg-black md:group-hover:bg-white border-r-2 border-black flex items-center justify-center">
                  <span className="font-black text-xl sm:text-2xl text-white md:group-hover:text-black">2</span>
                </div>
                <p className="font-mono text-[11px] sm:text-xs py-3 sm:py-4 pl-14 sm:pl-16 pr-3 sm:pr-4 leading-relaxed">
                  &quot;Show me all open bounties&quot;
                </p>
              </div>

              <div className="group relative overflow-hidden border-2 border-black md:hover:bg-black md:hover:text-white transition-all duration-300 cursor-pointer">
                <div className="absolute top-0 left-0 w-10 sm:w-12 h-full bg-black md:group-hover:bg-white border-r-2 border-black flex items-center justify-center">
                  <span className="font-black text-xl sm:text-2xl text-white md:group-hover:text-black">3</span>
                </div>
                <p className="font-mono text-[11px] sm:text-xs py-3 sm:py-4 pl-14 sm:pl-16 pr-3 sm:pr-4 leading-relaxed">
                  &quot;I want to bid $40 on bounty #3&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-white">
      <div className="max-w-4xl mx-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex items-start gap-3 mb-6">
            <div className="flex-1 bg-white border-2 border-black p-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                <span className="font-mono text-xs ml-2 opacity-60">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
