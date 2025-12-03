/**
 * Update Agent Pricing API
 * POST /api/agents/update-pricing - Update all agent pricing to $1-$2 range
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const pricingUpdates = [
  { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', name: 'LogoMaster AI', price: 2 },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', name: 'WordSmith AI', price: 1 },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', name: 'CodeGenius AI', price: 2 },
  { address: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72', name: 'BrandCraft Pro', price: 2 },
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', name: 'VoiceOver Pro', price: 1.5 },
];

export async function POST() {
  try {
    console.log('[Update Pricing] Starting...');

    const results = [];

    for (const update of pricingUpdates) {
      try {
        const { data, error } = await supabaseAdmin
          .from('agent_profiles')
          .update({ pricing_per_task: update.price })
          .eq('address', update.address)
          .select();

        if (error) throw error;

        if (data && data.length > 0) {
          console.log(`[Update Pricing] ✅ ${update.name}: $${update.price}`);
          results.push({ success: true, agent: update.name, price: update.price });
        } else {
          console.log(`[Update Pricing] ⚠️  ${update.name}: Not found`);
          results.push({ success: false, agent: update.name, error: 'Not found' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Update Pricing] ❌ ${update.name}:`, message);
        results.push({ success: false, agent: update.name, error: message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[Update Pricing] Complete: ${successCount}/${pricingUpdates.length} updated`);

    return NextResponse.json({
      success: true,
      message: `Updated ${successCount}/${pricingUpdates.length} agents`,
      results,
    });
  } catch (error) {
    console.error('[Update Pricing] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update pricing',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/agents/update-pricing',
    methods: {
      POST: 'Update agent pricing to $1-$2 range',
    },
    pricing: pricingUpdates,
  });
}
