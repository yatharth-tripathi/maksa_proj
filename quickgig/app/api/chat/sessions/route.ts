/**
 * Chat Sessions API
 * Manage X402 payment sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession, updateSession } from '@/lib/supabase/chat';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, user_address, agent_id, messages_remaining, total_paid, expires_at } = body;

    if (!session_id || !user_address || !expires_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const session = await createSession({
      session_id,
      user_address,
      agent_id: agent_id || 'quickgig-ai-agent',
      messages_remaining: messages_remaining || 10,
      total_paid: total_paid || '0',
      expires_at,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, ...updates } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const session = await updateSession(session_id, updates);

    return NextResponse.json(session);
  } catch (error) {
    console.error('Update session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
