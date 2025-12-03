/**
 * Mission Status Update API
 * Allows orchestrator and agents to update mission execution status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  updateMissionStatus,
  updateExecution,
  getMissionExecutions,
} from '@/lib/supabase/missions';
import { createDeliverable } from '@/lib/supabase/agents';

interface UpdateMissionRequest {
  executionId?: number;
  agentId?: string;
  status?: 'executing' | 'completed' | 'failed';
  deliverableUri?: string;
  resultData?: Record<string, unknown>;
  errorMessage?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
) {
  try {
    const { missionId } = await params;
    const body: UpdateMissionRequest = await request.json();

    console.log(`[Mission Update] Mission ${missionId}:`, body);

    // If no executionId provided but agentId is, try to find execution
    let executionId = body.executionId;
    if (!executionId && body.agentId) {
      try {
        const executions = await getMissionExecutions(missionId);
        const execution = executions.find(e => e.agent_id === body.agentId);
        if (execution) {
          executionId = execution.id;
          console.log(`[Mission Update] Found execution ID ${executionId} for agent ${body.agentId}`);
        } else {
          console.warn(`[Mission Update] No execution found for agent ${body.agentId}, will still update mission status`);
        }
      } catch (error) {
        console.warn(`[Mission Update] Failed to find execution for agent ${body.agentId}:`, error);
      }
    }

    // Update execution if executionId available
    if (executionId) {
      const updates: {
        status?: 'executing' | 'completed' | 'failed';
        deliverable_uri?: string;
        result_data?: Record<string, unknown>;
        error_message?: string;
        started_at?: string;
        completed_at?: string;
      } = {
        status: body.status,
        deliverable_uri: body.deliverableUri,
        result_data: body.resultData,
        error_message: body.errorMessage,
      };

      if (body.status === 'executing') {
        updates.started_at = new Date().toISOString();
      } else if (body.status === 'completed' || body.status === 'failed') {
        updates.completed_at = new Date().toISOString();
      }

      await updateExecution(executionId, updates);

      // Create deliverable record if URI provided
      if (body.deliverableUri && body.agentId) {
        await createDeliverable({
          mission_id: missionId,
          agent_id: body.agentId,
          ipfs_hash: body.deliverableUri,
          metadata: body.resultData,
        });
      }
    }

    // Check if all executions are complete
    const executions = await getMissionExecutions(missionId);
    const allComplete = executions.every(
      (e) => e.status === 'completed' || e.status === 'failed'
    );
    const anyFailed = executions.some((e) => e.status === 'failed');

    // Update mission status based on executions
    if (allComplete) {
      const newStatus = anyFailed ? 'failed' : 'completed';
      await updateMissionStatus(missionId, newStatus, {
        completed_at: new Date().toISOString(),
      });
      console.log(`[Mission Update] Mission ${missionId} ${newStatus}`);
    } else if (body.status === 'executing') {
      await updateMissionStatus(missionId, 'in_progress', {
        started_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Mission updated',
      missionId,
    });
  } catch (error) {
    console.error('Mission update error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update mission',
      },
      { status: 500 }
    );
  }
}
