/**
 * Mission Orchestrator API Route
 * Thin wrapper around core orchestration module
 * Accepts HTTP requests and delegates to core logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { startMissionOrchestration, type MissionPayload } from '@/lib/orchestrator/core';

/**
 * Execute mission endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const payload: MissionPayload = await request.json();

    console.log('[Orchestrator Route] Received mission:', payload.missionId);
    console.log('[Orchestrator Route] Mode:', payload.orchestrationMode);
    console.log('[Orchestrator Route] Agents:', payload.subAgents.length);

    // Execute asynchronously (don't await) - delegates to core module
    startMissionOrchestration(payload).catch((error) => {
      console.error('[Orchestrator Route] Mission execution failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Mission execution started',
      missionId: payload.missionId,
    });
  } catch (error) {
    console.error('[Orchestrator Route] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
