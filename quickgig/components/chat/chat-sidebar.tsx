'use client';

import { useChatStore } from '@/lib/store/chat';
import { useUIStore } from '@/lib/store/ui';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { formatRelativeTime } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export function ChatSidebar() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const mobileMenuOpen = useUIStore((state) => state.mobileMenuOpen);
  const sessions = useChatStore((state) => state.sessions);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const createNewSession = useChatStore((state) => state.createNewSession);
  const switchSession = useChatStore((state) => state.switchSession);
  const deleteSession = useChatStore((state) => state.deleteSession);

  const sessionsList = Object.values(sessions).sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  // Wait for hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Toggle button for mobile - positioned on right edge, vertically centered - hidden when mobile menu is open */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`lg:hidden fixed top-1/2 -translate-y-1/2 z-50 w-8 h-14 sm:w-9 sm:h-16 border-2 border-black bg-white md:hover:bg-black md:hover:text-white transition-all duration-300 flex items-center justify-center text-base sm:text-lg font-black ${
          isOpen ? 'left-[calc(16rem-2px)] sm:left-[calc(18rem-2px)]' : 'left-0'
        } ${mobileMenuOpen ? 'hidden' : ''}`}
        style={{
          borderRadius: isOpen ? '0 8px 8px 0' : '0 8px 8px 0',
          borderLeft: isOpen ? 'none' : '2px solid black'
        }}
      >
        {isOpen ? '‹' : '›'}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:relative top-14 sm:top-16 lg:top-0 left-0 bottom-0 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] lg:h-auto w-64 sm:w-72 max-w-[85vw] sm:max-w-none bg-white border-r-2 border-black transition-transform duration-300 z-40 flex flex-col shadow-2xl lg:shadow-none`}
      >
        {/* Header */}
        <div className="border-b-2 border-black p-2.5 sm:p-3 md:p-4">
          <Button
            onClick={() => createNewSession()}
            className="w-full h-9 sm:h-10 text-[10px] sm:text-xs"
            size="sm"
          >
            + NEW CHAT
          </Button>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto">
          {!mounted ? (
            <div className="p-3 sm:p-4 flex justify-center">
              <Loader size="md" />
            </div>
          ) : sessionsList.length === 0 ? (
            <div className="p-4 sm:p-5 text-center">
              <p className="font-mono text-[10px] sm:text-xs uppercase text-black opacity-60">
                NO CHATS YET
              </p>
            </div>
          ) : (
            <div className="p-1.5 sm:p-2 space-y-0.5 sm:space-y-1">
              {sessionsList.map((session) => (
                <div
                  key={session.id}
                  className={`group relative p-2 sm:p-2.5 md:p-3 border-2 cursor-pointer transition-all duration-200 ${
                    session.id === currentSessionId
                      ? 'border-black bg-black text-white'
                      : 'border-transparent md:hover:border-black bg-white'
                  }`}
                  onClick={() => switchSession(session.id)}
                >
                  <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                    <h3 className="font-bold text-[10px] sm:text-[11px] md:text-xs uppercase tracking-wide line-clamp-2 flex-1 leading-tight">
                      {session.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteSessionId(session.id);
                      }}
                      className={`opacity-0 md:group-hover:opacity-100 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center transition-opacity flex-shrink-0 ${
                        session.id === currentSessionId
                          ? 'md:hover:bg-white md:hover:text-black'
                          : 'md:hover:bg-black md:hover:text-white'
                      }`}
                    >
                      ×
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-xs font-mono mb-1">
                    <span className="opacity-60">
                      {formatRelativeTime(Math.floor(session.lastMessageAt / 1000))}
                    </span>
                    {session.locked ? (
                      <span className={`font-bold text-[9px] sm:text-[10px] ${
                        session.id === currentSessionId ? 'text-white' : 'text-red-600'
                      }`}>
                        LOCKED
                      </span>
                    ) : session.messagesRemaining > 0 ? (
                      <span className={`font-bold text-[9px] sm:text-[10px] ${
                        session.id === currentSessionId ? 'text-white' : 'text-black'
                      }`}>
                        {session.messagesRemaining} left
                      </span>
                    ) : null}
                  </div>

                  {session.messages.length > 0 && (
                    <p className="font-mono text-[9px] sm:text-[10px] md:text-xs opacity-60 line-clamp-1">
                      {session.messages[session.messages.length - 1].content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - current session info */}
        {mounted && currentSessionId && sessions[currentSessionId] && (
          <div className="border-t-2 border-black p-2.5 sm:p-3 md:p-4 bg-black text-white">
            <div className="font-mono">
              {sessions[currentSessionId].locked ? (
                <div className="flex justify-between items-center mb-1 sm:mb-1.5">
                  <span className="uppercase opacity-60 text-[9px] sm:text-[10px] md:text-xs">Session Status:</span>
                  <span className="font-bold text-sm sm:text-base md:text-lg text-red-600">
                    LOCKED
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center mb-1 sm:mb-1.5">
                  <span className="uppercase opacity-60 text-[9px] sm:text-[10px] md:text-xs">Messages Left:</span>
                  <span className="font-bold text-sm sm:text-base md:text-lg">
                    {sessions[currentSessionId].messagesRemaining}
                  </span>
                </div>
              )}
              <p className="text-[9px] sm:text-[10px] md:text-xs opacity-60">
                $0.01 per message • $0.10 per session
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteSessionId && (
        <ConfirmModal
          title="DELETE CHAT?"
          message="This action cannot be undone. All messages in this chat will be permanently deleted."
          confirmText="DELETE"
          cancelText="CANCEL"
          onConfirm={() => {
            deleteSession(deleteSessionId);
            setDeleteSessionId(null);
          }}
          onCancel={() => setDeleteSessionId(null)}
        />
      )}
    </>
  );
}
