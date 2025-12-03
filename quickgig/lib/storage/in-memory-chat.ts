/**
 * In-Memory Chat Storage
 * Temporary storage for chat sessions and messages (replaces Supabase)
 * Note: Data resets on server restart
 */

export interface ChatSession {
  session_id: string;
  user_address: string;
  agent_id: string;
  messages_remaining: number;
  total_paid: string;
  expires_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  id?: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: unknown;
  created_at?: string;
}

// In-memory storage
const sessions = new Map<string, ChatSession>();
const messages = new Map<string, ChatMessage[]>();

/**
 * Session management
 */

export async function createSession(session: Omit<ChatSession, 'created_at' | 'updated_at'>): Promise<ChatSession> {
  const now = new Date().toISOString();
  const fullSession: ChatSession = {
    ...session,
    created_at: now,
    updated_at: now,
  };

  sessions.set(session.session_id, fullSession);
  console.log('[In-Memory Storage] Session created:', session.session_id);

  return fullSession;
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const session = sessions.get(sessionId);
  console.log('[In-Memory Storage] Session lookup:', sessionId, '-> found:', !!session);
  return session || null;
}

export async function updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession> {
  const session = sessions.get(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const updatedSession: ChatSession = {
    ...session,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  sessions.set(sessionId, updatedSession);
  console.log('[In-Memory Storage] Session updated:', sessionId, '-> messages_remaining:', updatedSession.messages_remaining);

  return updatedSession;
}

export async function deleteExpiredSessions(): Promise<void> {
  const now = new Date();
  let deletedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    if (new Date(session.expires_at) < now) {
      sessions.delete(sessionId);
      messages.delete(sessionId);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log('[In-Memory Storage] Deleted expired sessions:', deletedCount);
  }
}

/**
 * Message management
 */

export async function saveMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage> {
  const fullMessage: ChatMessage = {
    ...message,
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };

  const sessionMessages = messages.get(message.session_id) || [];
  sessionMessages.push(fullMessage);
  messages.set(message.session_id, sessionMessages);

  console.log('[In-Memory Storage] Message saved for session:', message.session_id);

  return fullMessage;
}

export async function getMessages(sessionId: string, limit: number = 100): Promise<ChatMessage[]> {
  const sessionMessages = messages.get(sessionId) || [];
  const limited = sessionMessages.slice(-limit);

  console.log('[In-Memory Storage] Messages retrieved for session:', sessionId, '-> count:', limited.length);

  return limited;
}

export async function deleteMessagesForSession(sessionId: string): Promise<void> {
  messages.delete(sessionId);
  console.log('[In-Memory Storage] Messages deleted for session:', sessionId);
}

/**
 * Utility: Get storage stats
 */
export function getStorageStats() {
  return {
    totalSessions: sessions.size,
    totalMessages: Array.from(messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
    activeSessions: Array.from(sessions.values()).filter(s => new Date(s.expires_at) > new Date()).length,
  };
}

/**
 * Utility: Clear all storage (for testing)
 */
export function clearAllStorage() {
  sessions.clear();
  messages.clear();
  console.log('[In-Memory Storage] All storage cleared');
}
