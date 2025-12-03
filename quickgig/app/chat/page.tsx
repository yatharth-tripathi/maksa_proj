'use client';

import { useEffect, useState, Suspense } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { Header } from '@/components/layout/header';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { MessageList } from '@/components/chat/message-list';
import { InputBar } from '@/components/chat/input-bar';
import { useChatStore } from '@/lib/store/chat';
import { useSearchParams } from 'next/navigation';

function ChatContent() {
  const searchParams = useSearchParams();
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const createNewSession = useChatStore((state) => state.createNewSession);
  const getMessagesRemaining = useChatStore((state) => state.getMessagesRemaining);
  const [mounted, setMounted] = useState(false);

  // Wait for hydration to complete
  useEffect(() => {
    setMounted(true);
  }, []);

  // On mount (after hydration), create session if none exists
  useEffect(() => {
    if (!mounted) return;

    if (!currentSessionId) {
      const agentId = searchParams?.get('agent') || undefined;
      createNewSession(agentId);
    }
    // Don't trigger checkSession on existing sessions - let InputBar handle it
  }, [mounted, createNewSession, currentSessionId, searchParams]);

  return (
    <div className="h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 flex relative overflow-hidden min-h-0">
        <ChatSidebar />

        <div className="flex-1 flex flex-col min-h-0">
          <MessageList />
          <InputBar />
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader size="lg" className="mx-auto mb-4" />
          <p className="font-mono text-sm uppercase tracking-wide">LOADING CHAT...</p>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
