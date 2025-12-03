/**
 * Agent Details API
 * Fetches a single agent profile by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/supabase/agents';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    const agent = await getAgent(agentId);

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Get agent details error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get agent details',
      },
      { status: 500 }
    );
  }
}
