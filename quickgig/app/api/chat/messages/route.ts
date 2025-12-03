/**
 * Chat Messages API
 * Save and load chat messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveMessage, getMessages, toAppMessage, toDbMessage } from '@/lib/supabase/chat';
import type { Message } from '@/lib/store/chat';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const messages = await getMessages(sessionId, limit);
    const appMessages = messages.map(toAppMessage);

    return NextResponse.json({ messages: appMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return NextResponse.json({ error: 'Session ID and message required' }, { status: 400 });
    }

    const dbMessage = toDbMessage(message, sessionId);
    const savedMessage = await saveMessage(dbMessage);
    const appMessage = toAppMessage(savedMessage);

    return NextResponse.json({ message: appMessage });
  } catch (error) {
    console.error('Save message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
