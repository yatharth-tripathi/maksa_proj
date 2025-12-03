/**
 * Seed Agents API
 * POST /api/agents/seed - Populate database with initial agents
 */

import { NextResponse } from 'next/server';
import { createAgent } from '@/lib/supabase/agents';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function POST() {
  try {
    console.log('[Seed] Starting agent seeding...');

    const agents = [
      {
        name: 'LogoMaster AI',
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as `0x${string}`,
        capabilities: ['logo-design', 'graphic-design'],
        agentType: 'ai' as const,
        pricingPerTask: 0.01, // X402 micropayment pricing (matches on-chain metadata)
        bio: 'AI-powered logo designer using DALL-E 3. Creates modern, minimalist logos in minutes. Powered by X402 micropayments.',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=logomaster',
        endpointUrl: 'https://supermission.fun/api/agents/logo-master',
      },
      {
        name: 'CopyWriter AI',
        address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as `0x${string}`,
        capabilities: ['copywriting', 'content-writing'],
        agentType: 'ai' as const,
        pricingPerTask: 0.01, // X402 micropayment pricing (matches on-chain metadata)
        bio: 'GPT-4o powered copywriter. Creates engaging taglines, brand copy, and marketing content. Powered by X402 micropayments.',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=copywriter',
        endpointUrl: 'https://supermission.fun/api/agents/copywriter',
      },
      {
        name: 'SocialMedia AI',
        address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as `0x${string}`,
        capabilities: ['social-media', 'content-writing'],
        agentType: 'ai' as const,
        pricingPerTask: 0.01, // X402 micropayment pricing (matches on-chain metadata)
        bio: 'Social media content specialist. Generates 15-20 platform-optimized posts with hashtags. Powered by X402 micropayments.',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=socialmedia',
        endpointUrl: 'https://supermission.fun/api/agents/socialmedia',
      },
    ];

    const results = [];

    for (const agentData of agents) {
      try {
        // First, try to find existing agent by wallet address
        const { data: existingAgent } = await supabaseAdmin
          .from('agent_profiles')
          .select('*')
          .eq('address', agentData.address)
          .single();

        if (existingAgent) {
          // Update existing agent
          const { data: updatedAgent, error: updateError } = await supabaseAdmin
            .from('agent_profiles')
            .update({
              name: agentData.name,
              capabilities: agentData.capabilities,
              agent_type: agentData.agentType,
              pricing_per_task: agentData.pricingPerTask,
              bio: agentData.bio,
              avatar_url: agentData.avatarUrl,
              endpoint_url: agentData.endpointUrl,
            })
            .eq('address', agentData.address)
            .select()
            .single();

          if (updateError) throw updateError;
          console.log(`[Seed] ✅ Updated agent: ${updatedAgent.name} (${updatedAgent.id})`);
          results.push({ success: true, agent: updatedAgent.name, id: updatedAgent.id, action: 'updated' });
        } else {
          // Create new agent
          const agent = await createAgent(agentData);
          console.log(`[Seed] ✅ Created agent: ${agent.name} (${agent.id})`);
          results.push({ success: true, agent: agent.name, id: agent.id, action: 'created' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Seed] ❌ Failed to process ${agentData.name}:`, message);
        results.push({ success: false, agent: agentData.name, error: message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[Seed] Complete: ${successCount}/${agents.length} agents created`);

    return NextResponse.json({
      success: true,
      message: `Seeded ${successCount}/${agents.length} agents`,
      results,
    });
  } catch (error) {
    console.error('[Seed] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed agents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/agents/seed',
    methods: {
      POST: 'Seed initial agent profiles',
    },
    warning: 'This will create 3 initial agents in the database',
  });
}
