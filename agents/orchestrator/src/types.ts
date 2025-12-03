/**
 * Orchestrator Agent Types
 */

import type { Address } from 'viem';

export interface SubAgent {
  agentId: bigint;
  name: string;
  address: Address;
  endpoint: string;
  capability: string;
  payment: bigint; // In USDC (6 decimals)
}

export interface MissionPlan {
  missionId: string;
  description: string;
  subAgents: SubAgent[];
  orchestrationMode: 'sequential' | 'parallel';
  totalBudget: bigint;
  requirements: Record<string, string>; // Per-agent requirements
}

export interface AgentTask {
  agentId: bigint;
  capability: string;
  requirements: string;
  maxPayment: bigint;
  dependsOn?: bigint[]; // Agent IDs that must complete first
}

export interface TaskResult {
  agentId: bigint;
  success: boolean;
  result: string;
  paid: bigint;
  txHash?: string;
  error?: string;
  completedAt: Date;
}

export interface MissionExecution {
  missionId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  results: TaskResult[];
  totalPaid: bigint;
  error?: string;
}
