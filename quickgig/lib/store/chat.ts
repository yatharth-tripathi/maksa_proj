import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    gigId?: number;
    bountyId?: number;
    txHash?: string;
    paid?: boolean;
    messagesRemaining?: number;
    functionCall?: {
      name: string;
      arguments: Record<string, unknown>;
    };
    action?: {
      type: string;
      data?: Record<string, unknown>;
    };
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  messagesRemaining: number;
  createdAt: number;
  lastMessageAt: number;
  agentId?: string;
  locked?: boolean;
}

interface ChatState {
  currentSessionId: string | null;
  sessions: Record<string, ChatSession>;
  isLoading: boolean;
  needsSessionCheck: boolean;
  bountyFormData: unknown | null;

  // Getters
  getCurrentSession: () => ChatSession | null;
  getMessages: () => Message[];
  getMessagesRemaining: () => number;

  // Session management
  createNewSession: (agentId?: string) => string;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;

  // Message management
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessageMetadata: (messageId: string, metadata: Message['metadata']) => void;
  updateMessagesRemaining: (count: number) => void;

  // State management
  setLoading: (loading: boolean) => void;
  checkSession: () => void;
  setBountyFormData: (data: unknown) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      currentSessionId: null,
      sessions: {},
      isLoading: false,
      needsSessionCheck: false,
      bountyFormData: null,

      // Getters
      getCurrentSession: () => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return null;

        const session = sessions[currentSessionId];
        if (!session) return null;

        // Auto-lock sessions with 60+ messages (handles old sessions)
        if (session.messages.length >= 60 && !session.locked) {
          set((state) => ({
            sessions: {
              ...state.sessions,
              [currentSessionId]: {
                ...session,
                locked: true,
              },
            },
          }));
          return { ...session, locked: true };
        }

        return session;
      },

      getMessages: () => {
        const session = get().getCurrentSession();
        return session?.messages || [];
      },

      getMessagesRemaining: () => {
        const session = get().getCurrentSession();
        return session?.messagesRemaining || 0;
      },

      // Session management
      createNewSession: (agentId?: string) => {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newSession: ChatSession = {
          id: sessionId,
          title: 'New Chat',
          messages: [],
          messagesRemaining: 0,
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
          agentId,
        };

        set((state) => ({
          sessions: {
            ...state.sessions,
            [sessionId]: newSession,
          },
          currentSessionId: sessionId,
          needsSessionCheck: true,
        }));

        return sessionId;
      },

      switchSession: (sessionId) => {
        set({ currentSessionId: sessionId });
      },

      deleteSession: (sessionId) => {
        set((state) => {
          const newSessions = { ...state.sessions };
          delete newSessions[sessionId];

          // If deleting current session, switch to most recent
          let newCurrentId = state.currentSessionId;
          if (state.currentSessionId === sessionId) {
            const remainingSessions = Object.values(newSessions);
            newCurrentId = remainingSessions.length > 0
              ? remainingSessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt)[0].id
              : null;
          }

          return {
            sessions: newSessions,
            currentSessionId: newCurrentId,
          };
        });
      },

      // Message management
      addMessage: (message) => {
        set((state) => {
          const session = state.getCurrentSession();
          if (!session) return state;

          const newMessage: Message = {
            ...message,
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          };

          // Update title from first user message
          let title = session.title;
          if (title === 'New Chat' && message.role === 'user') {
            title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
          }

          const newMessages = [...session.messages, newMessage];

          // Lock session after 30 exchanges (60 total messages: 30 user + 30 AI)
          const locked = newMessages.length >= 60;

          const updatedSession: ChatSession = {
            ...session,
            messages: newMessages,
            title,
            lastMessageAt: Date.now(),
            locked,
          };

          return {
            sessions: {
              ...state.sessions,
              [session.id]: updatedSession,
            },
          };
        });
      },

      updateMessageMetadata: (messageId, metadata) => {
        set((state) => {
          const session = state.getCurrentSession();
          if (!session) return state;

          const updatedMessages = session.messages.map((msg) =>
            msg.id === messageId
              ? { ...msg, metadata: { ...msg.metadata, ...metadata } }
              : msg
          );

          return {
            sessions: {
              ...state.sessions,
              [session.id]: {
                ...session,
                messages: updatedMessages,
              },
            },
          };
        });
      },

      updateMessagesRemaining: (count) => {
        set((state) => {
          const session = state.getCurrentSession();
          if (!session) return state;

          return {
            sessions: {
              ...state.sessions,
              [session.id]: {
                ...session,
                messagesRemaining: count,
              },
            },
          };
        });
      },

      // State management
      setLoading: (loading) => set({ isLoading: loading }),

      checkSession: () => set({ needsSessionCheck: true }),

      setBountyFormData: (data) => set({ bountyFormData: data }),
    }),
    {
      name: 'quickgig-chat-storage',
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        sessions: state.sessions,
      }),
    }
  )
);
