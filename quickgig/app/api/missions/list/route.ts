/**
 * List Missions API
 * Fetches missions from Supabase database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentMissions, getMissionsByClient } from '@/lib/supabase/missions';
import type { Address } from 'viem';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientAddress = searchParams.get('client') as Address | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let missions;

    if (clientAddress) {
      // Fetch missions for specific client
      missions = await getMissionsByClient(clientAddress, limit);
    } else {
      // Fetch recent missions
      missions = await getRecentMissions(limit);
    }

    return NextResponse.json({
      missions,
      count: missions.length,
    });
  } catch (error) {
    console.error('List missions error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to list missions',
      },
      { status: 500 }
    );
  }
}
