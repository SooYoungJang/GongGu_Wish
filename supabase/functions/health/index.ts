// ============================================================================
// Edge Function: health
// Purpose: Basic health check endpoint for Supabase Edge Functions
//
// Deploy: supabase functions deploy health
// Invoke: supabase functions serve health (local)
//         curl https://<project-ref>.supabase.co/functions/v1/health
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  supabase: {
    project: string;
    region: string;
  };
}

serve(async (_req: Request) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    supabase: {
      project: Deno.env.get('SUPABASE_URL')?.replace('https://', '').replace('.supabase.co', '') ?? 'unknown',
      region: 'ap-northeast-2',
    },
  };

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
});
