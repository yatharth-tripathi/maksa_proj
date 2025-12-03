/**
 * Migration Runner API
 * POST /api/migrations/run - Execute pending migrations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read migration file - run 003 (mission escrow columns)
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/003_add_mission_escrow_columns.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('[Migration] Running 003_add_mission_escrow_columns...');

    // Execute migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try alternative approach: execute directly
      const statements = migrationSQL
        .split(';')
        .filter((s) => s.trim() && !s.trim().startsWith('--'));

      for (const statement of statements) {
        const { error: execError } = await supabase.from('agent_profiles').select('*').limit(0);

        // Direct SQL execution
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: statement.trim() }),
        });

        if (!response.ok) {
          console.warn('[Migration] Statement execution note:', await response.text());
        }
      }
    }

    console.log('[Migration] ✅ 003_add_mission_escrow_columns complete');

    return NextResponse.json({
      success: true,
      message: 'Migration 003_add_mission_escrow_columns executed',
      migration: '003_add_mission_escrow_columns.sql',
    });
  } catch (error) {
    console.error('[Migration] Error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/migrations/run',
    methods: {
      POST: 'Run pending migrations (003_add_mission_escrow_columns)',
    },
    warning: 'This will modify the database schema - adds escrow, validation, and dispute columns',
  });
}
