/**
 * Mission Database Operations
 * CRUD operations for missions, mission_agents, and mission_executions
 */

import { supabaseAdmin } from './client';
import type { Address } from 'viem';

// ============================================================================
// TYPES
// ============================================================================

export interface Mission {
  id: string;
  client_address: string;
  description?: string;
  total_budget: number;
  orchestration_mode: 'sequential' | 'parallel';
  status: 'pending' | 'funded' | 'in_progress' | 'submitted' | 'validating' | 'disputing' | 'approved' | 'completed' | 'auto_released' | 'rejected' | 'failed' | 'cancelled';
  escrow_tx_hash?: string;
  requirements_ipfs?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface MissionAgent {
  id?: number;
  mission_id: string;
  agent_id: string;
  capability: string;
  payment_amount: number;
  requirements?: string;
  position?: number;
  created_at?: string;
}

export interface MissionExecution {
  id?: number;
  mission_id: string;
  agent_id: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result_data?: Record<string, unknown>;
  deliverable_uri?: string;
  tx_hash?: string;
  paid_amount?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
}

export interface CreateMissionParams {
  clientAddress: Address;
  description?: string;
  totalBudget: number;
  orchestrationMode: 'sequential' | 'parallel';
  requirementsIpfs?: string;
}

export interface AddAgentToMissionParams {
  missionId: string;
  agentId: string;
  capability: string;
  paymentAmount: number;
  requirements?: string;
  position?: number;
}

// ============================================================================
// MISSION CRUD
// ============================================================================

/**
 * Create a new mission
 */
export async function createMission(params: CreateMissionParams): Promise<Mission> {
  const missionId = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const mission: Mission = {
    id: missionId,
    client_address: params.clientAddress,
    description: params.description,
    total_budget: params.totalBudget,
    orchestration_mode: params.orchestrationMode,
    status: 'pending',
    requirements_ipfs: params.requirementsIpfs,
  };

  const { data, error } = await supabaseAdmin
    .from('missions')
    .insert([mission])
    .select()
    .single();

  if (error) throw new Error(`Failed to create mission: ${error.message}`);
  return data as Mission;
}

/**
 * Get mission by ID
 */
export async function getMission(missionId: string): Promise<Mission | null> {
  const { data, error } = await supabaseAdmin
    .from('missions')
    .select('*')
    .eq('id', missionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get mission: ${error.message}`);
  }

  return data as Mission;
}

/**
 * Get missions by client address
 */
export async function getMissionsByClient(clientAddress: Address, limit = 50): Promise<Mission[]> {
  const { data, error } = await supabaseAdmin
    .from('missions')
    .select('*')
    .eq('client_address', clientAddress)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get missions: ${error.message}`);
  return data as Mission[];
}

/**
 * Update mission status
 */
export async function updateMissionStatus(
  missionId: string,
  status: Mission['status'],
  updates?: { started_at?: string; completed_at?: string; escrow_tx_hash?: string }
): Promise<Mission> {
  const { data, error } = await supabaseAdmin
    .from('missions')
    .update({ status, ...updates })
    .eq('id', missionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update mission status: ${error.message}`);
  return data as Mission;
}

/**
 * Get recent missions
 */
export async function getRecentMissions(limit = 20): Promise<Mission[]> {
  const { data, error } = await supabaseAdmin
    .from('missions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get recent missions: ${error.message}`);
  return data as Mission[];
}

// ============================================================================
// MISSION AGENTS
// ============================================================================

/**
 * Add agent to mission
 */
export async function addAgentToMission(params: AddAgentToMissionParams): Promise<MissionAgent> {
  const missionAgent: Omit<MissionAgent, 'id' | 'created_at'> = {
    mission_id: params.missionId,
    agent_id: params.agentId,
    capability: params.capability,
    payment_amount: params.paymentAmount,
    requirements: params.requirements,
    position: params.position,
  };

  const { data, error } = await supabaseAdmin
    .from('mission_agents')
    .insert([missionAgent])
    .select()
    .single();

  if (error) throw new Error(`Failed to add agent to mission: ${error.message}`);
  return data as MissionAgent;
}

/**
 * Get agents for a mission
 */
export async function getMissionAgents(missionId: string): Promise<MissionAgent[]> {
  const { data, error } = await supabaseAdmin
    .from('mission_agents')
    .select('*')
    .eq('mission_id', missionId)
    .order('position', { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Failed to get mission agents: ${error.message}`);
  return data as MissionAgent[];
}

/**
 * Get missions for an agent
 */
export async function getAgentMissions(agentId: string, limit = 50): Promise<Mission[]> {
  const { data, error } = await supabaseAdmin
    .from('mission_agents')
    .select('mission_id, missions(*)')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get agent missions: ${error.message}`);
  return data.map((row: { mission_id: string; missions: Mission[] | Mission }) =>
    Array.isArray(row.missions) ? row.missions[0] : row.missions
  ).filter(Boolean) as Mission[];
}

// ============================================================================
// MISSION EXECUTIONS
// ============================================================================

/**
 * Create execution record
 */
export async function createExecution(params: Omit<MissionExecution, 'id' | 'created_at'>): Promise<MissionExecution> {
  const { data, error } = await supabaseAdmin
    .from('mission_executions')
    .insert([params])
    .select()
    .single();

  if (error) throw new Error(`Failed to create execution: ${error.message}`);
  return data as MissionExecution;
}

/**
 * Update execution status
 */
export async function updateExecution(
  executionId: number,
  updates: Partial<MissionExecution>
): Promise<MissionExecution> {
  const { data, error } = await supabaseAdmin
    .from('mission_executions')
    .update(updates)
    .eq('id', executionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update execution: ${error.message}`);
  return data as MissionExecution;
}

/**
 * Get executions for a mission
 */
export async function getMissionExecutions(missionId: string): Promise<MissionExecution[]> {
  const { data, error } = await supabaseAdmin
    .from('mission_executions')
    .select('*')
    .eq('mission_id', missionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get mission executions: ${error.message}`);
  return data as MissionExecution[];
}

/**
 * Get execution by mission and agent
 */
export async function getExecutionByMissionAndAgent(
  missionId: string,
  agentId: string
): Promise<MissionExecution | null> {
  const { data, error } = await supabaseAdmin
    .from('mission_executions')
    .select('*')
    .eq('mission_id', missionId)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get execution: ${error.message}`);
  }

  return data as MissionExecution;
}

// ============================================================================
// COMBINED OPERATIONS
// ============================================================================

/**
 * Get complete mission with agents and executions
 */
export async function getMissionWithDetails(missionId: string) {
  const [mission, agents, executions] = await Promise.all([
    getMission(missionId),
    getMissionAgents(missionId),
    getMissionExecutions(missionId),
  ]);

  if (!mission) return null;

  return {
    mission,
    agents,
    executions,
  };
}

/**
 * Initialize mission executions for all agents
 */
export async function initializeMissionExecutions(missionId: string): Promise<MissionExecution[]> {
  const agents = await getMissionAgents(missionId);

  const executions = agents.map((agent) => ({
    mission_id: missionId,
    agent_id: agent.agent_id,
    status: 'pending' as const,
  }));

  const { data, error } = await supabaseAdmin
    .from('mission_executions')
    .insert(executions)
    .select();

  if (error) throw new Error(`Failed to initialize executions: ${error.message}`);
  return data as MissionExecution[];
}
