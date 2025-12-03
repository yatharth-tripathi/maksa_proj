/**
 * Mission Details API
 * Fetches a single mission with agents and executions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMissionWithDetails } from '@/lib/supabase/missions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
) {
  try {
    const { missionId } = await params;

    const missionDetails = await getMissionWithDetails(missionId);

    if (!missionDetails) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(missionDetails);
  } catch (error) {
    console.error('Get mission details error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get mission details',
      },
      { status: 500 }
    );
  }
}
