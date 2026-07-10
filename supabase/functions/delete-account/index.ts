// ============================================================================
// Edge Function: delete-account
// Purpose: Permanently delete the authenticated user's app profile and Auth user.
//
// Invoke: POST /functions/v1/delete-account
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

export function extractBearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = extractBearerToken(req.headers.get('Authorization'));
  if (!token) return json({ error: '로그인이 필요합니다.' }, 401);

  try {
    const supabase = createAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) return json({ error: '인증 정보가 유효하지 않습니다.' }, 401);

    // The profile table is keyed by the Supabase Auth user id. Its favorites
    // are removed by the foreign key, while Auth-linked signal rows cascade
    // when the Auth user is deleted below.
    const { error: profileError } = await supabase.from('users').delete().eq('id', user.id);
    if (profileError) throw new Error(`사용자 프로필 삭제 실패: ${profileError.message}`);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(`Auth 계정 삭제 실패: ${deleteError.message}`);

    return json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[delete-account] Error:', message);
    return json({ error: '회원탈퇴 처리에 실패했습니다.' }, 500);
  }
}

if (import.meta.main) {
  serve(handler);
}
