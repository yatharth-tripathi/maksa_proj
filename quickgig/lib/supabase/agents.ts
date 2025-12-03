/**
 * Agent Database Operations
 * CRUD operations for agent_profiles, agent_wallets, deliverables, and payments
 */

import { supabaseAdmin } from './client';
import type { Address } from 'viem';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentProfile {
  id: string;
  name: string;
  address: Address;
  capabilities: string[];
  agent_type?: 'ai' | 'human' | 'hybrid';
  reputation_score?: number;
  success_rate?: number;
  total_missions?: number;
  pricing_per_task?: number;
  bio?: string;
  avatar_url?: string;
  endpoint_url?: string; // HTTP endpoint where agent listens for mission requests
  created_at?: string;
  updated_at?: string;
}

export interface AgentWallet {
  agent_id: string;
  cdp_address: Address;
  network_id: string;
  created_at?: string;
}

export interface Deliverable {
  id?: number;
  mission_id: string;
  agent_id: string;
  ipfs_hash: string;
  file_type?: string;
  file_size?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface PaymentTransaction {
  id?: number;
  mission_id?: string;
  from_address: Address;
  to_address: Address;
  amount: number;
  token_address: Address;
  tx_hash: string;
  purpose?: 'mission_payment' | 'agent_to_agent' | 'bounty_payout' | 'escrow_release';
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface CreateAgentParams {
  name: string;
  address: Address;
  capabilities: string[];
  agentType?: 'ai' | 'human' | 'hybrid';
  pricingPerTask?: number;
  bio?: string;
  avatarUrl?: string;
  endpointUrl?: string;
}

// ============================================================================
// AGENT PROFILES
// ============================================================================

/**
 * Create agent profile
 */
export async function createAgent(params: CreateAgentParams): Promise<AgentProfile> {
  const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const agent: Omit<AgentProfile, 'created_at' | 'updated_at'> = {
    id: agentId,
    name: params.name,
    address: params.address,
    capabilities: params.capabilities,
    agent_type: params.agentType,
    pricing_per_task: params.pricingPerTask,
    bio: params.bio,
    avatar_url: params.avatarUrl,
    endpoint_url: params.endpointUrl,
    reputation_score: 50, // Start at 50/100
    success_rate: 0,
    total_missions: 0,
  };

  const { data, error } = await supabaseAdmin
    .from('agent_profiles')
    .insert([agent])
    .select()
    .single();

  if (error) throw new Error(`Failed to create agent: ${error.message}`);
  return data as AgentProfile;
}

/**
 * Get agent by ID
 */
export async function getAgent(agentId: string): Promise<AgentProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_profiles')
    .select('*')
    .eq('id', agentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get agent: ${error.message}`);
  }

  return data as AgentProfile;
}

/**
 * Get agent by address
 */
export async function getAgentByAddress(address: Address): Promise<AgentProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_profiles')
    .select('*')
    .eq('address', address)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get agent by address: ${error.message}`);
  }

  return data as AgentProfile;
}

/**
 * Search agents by capability
 */
export async function getAgentsByCapability(
  capability: string,
  options?: {
    minReputation?: number;
    limit?: number;
  }
): Promise<AgentProfile[]> {
  let query = supabaseAdmin
    .from('agent_profiles')
    .select('*')
    .contains('capabilities', [capability]);

  if (options?.minReputation) {
    query = query.gte('reputation_score', options.minReputation);
  }

  query = query
    .order('reputation_score', { ascending: false })
    .limit(options?.limit || 20);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to search agents: ${error.message}`);
  return data as AgentProfile[];
}

/**
 * Get all agents
 */
export async function getAllAgents(limit = 100): Promise<AgentProfile[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get all agents: ${error.message}`);
  return data as AgentProfile[];
}

/**
 * Update agent reputation
 */
export async function updateAgentReputation(
  agentId: string,
  updates: {
    reputationScore?: number;
    successRate?: number;
    totalMissions?: number;
  }
): Promise<AgentProfile> {
  const { data, error } = await supabaseAdmin
    .from('agent_profiles')
    .update({
      reputation_score: updates.reputationScore,
      success_rate: updates.successRate,
      total_missions: updates.totalMissions,
    })
    .eq('id', agentId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update agent reputation: ${error.message}`);
  return data as AgentProfile;
}

/**
 * Increment agent mission count
 */
export async function incrementAgentMissions(agentId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('increment_agent_missions', {
    agent_id_param: agentId,
  });

  // Fallback if RPC doesn't exist
  if (error) {
    const agent = await getAgent(agentId);
    if (agent) {
      await updateAgentReputation(agentId, {
        totalMissions: (agent.total_missions || 0) + 1,
      });
    }
  }
}

// ============================================================================
// AGENT WALLETS
// ============================================================================

/**
 * Create agent wallet record
 */
export async function createAgentWallet(params: Omit<AgentWallet, 'created_at'>): Promise<AgentWallet> {
  const { data, error } = await supabaseAdmin
    .from('agent_wallets')
    .insert([params])
    .select()
    .single();

  if (error) throw new Error(`Failed to create agent wallet: ${error.message}`);
  return data as AgentWallet;
}

/**
 * Get agent wallet
 */
export async function getAgentWallet(agentId: string): Promise<AgentWallet | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_wallets')
    .select('*')
    .eq('agent_id', agentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get agent wallet: ${error.message}`);
  }

  return data as AgentWallet;
}

/**
 * Get wallet by CDP address
 */
export async function getWalletByCdpAddress(cdpAddress: Address): Promise<AgentWallet | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_wallets')
    .select('*')
    .eq('cdp_address', cdpAddress)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get wallet by CDP address: ${error.message}`);
  }

  return data as AgentWallet;
}

// ============================================================================
// DELIVERABLES
// ============================================================================

/**
 * Create deliverable record
 */
export async function createDeliverable(params: Omit<Deliverable, 'id' | 'created_at'>): Promise<Deliverable> {
  const { data, error } = await supabaseAdmin
    .from('deliverables')
    .insert([params])
    .select()
    .single();

  if (error) throw new Error(`Failed to create deliverable: ${error.message}`);
  return data as Deliverable;
}

/**
 * Get deliverables for mission
 */
export async function getMissionDeliverables(missionId: string): Promise<Deliverable[]> {
  const { data, error } = await supabaseAdmin
    .from('deliverables')
    .select('*')
    .eq('mission_id', missionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get mission deliverables: ${error.message}`);
  return data as Deliverable[];
}

/**
 * Get deliverables by agent
 */
export async function getAgentDeliverables(agentId: string, limit = 50): Promise<Deliverable[]> {
  const { data, error } = await supabaseAdmin
    .from('deliverables')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get agent deliverables: ${error.message}`);
  return data as Deliverable[];
}

// ============================================================================
// PAYMENT TRANSACTIONS
// ============================================================================

/**
 * Record payment transaction
 */
export async function recordPayment(params: Omit<PaymentTransaction, 'id' | 'timestamp'>): Promise<PaymentTransaction> {
  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .insert([params])
    .select()
    .single();

  if (error) throw new Error(`Failed to record payment: ${error.message}`);
  return data as PaymentTransaction;
}

/**
 * Get payments for mission
 */
export async function getMissionPayments(missionId: string): Promise<PaymentTransaction[]> {
  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .select('*')
    .eq('mission_id', missionId)
    .order('timestamp', { ascending: true });

  if (error) throw new Error(`Failed to get mission payments: ${error.message}`);
  return data as PaymentTransaction[];
}

/**
 * Get payments by agent (sent or received)
 */
export async function getAgentPayments(
  agentAddress: Address,
  options?: {
    type?: 'sent' | 'received';
    limit?: number;
  }
): Promise<PaymentTransaction[]> {
  let query = supabaseAdmin.from('payment_transactions').select('*');

  if (options?.type === 'sent') {
    query = query.eq('from_address', agentAddress);
  } else if (options?.type === 'received') {
    query = query.eq('to_address', agentAddress);
  } else {
    query = query.or(`from_address.eq.${agentAddress},to_address.eq.${agentAddress}`);
  }

  query = query
    .order('timestamp', { ascending: false })
    .limit(options?.limit || 50);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get agent payments: ${error.message}`);
  return data as PaymentTransaction[];
}

/**
 * Get payment by transaction hash
 */
export async function getPaymentByTxHash(txHash: string): Promise<PaymentTransaction | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .select('*')
    .eq('tx_hash', txHash)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get payment by tx hash: ${error.message}`);
  }

  return data as PaymentTransaction;
}
