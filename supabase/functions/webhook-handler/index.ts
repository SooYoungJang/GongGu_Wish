// ============================================================================
// Edge Function: webhook-handler
// Purpose: Generic webhook receiver for external service integration.
//
// Design:
//   - Validates incoming requests using a shared webhook secret
//   - Routes to the appropriate handler based on the X-Webhook-Source header
//   - Returns 200 OK to acknowledge receipt
//
// Deploy: supabase functions deploy webhook-handler
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

interface WebhookPayload {
  source: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

const ALLOWED_SOURCES = ['instagram', 'hikerapi', 'admin'] as const;

serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Source, X-Webhook-Signature',
      },
    });
  }

  // Only POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate webhook source
  const source = req.headers.get('X-Webhook-Source') ?? '';
  if (!ALLOWED_SOURCES.includes(source as any)) {
    return new Response(JSON.stringify({ error: 'Invalid webhook source' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate signature
  const signature = req.headers.get('X-Webhook-Signature') ?? '';
  const expectedSignature = Deno.env.get('WEBHOOK_SECRET') ?? '';
  if (signature !== expectedSignature) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse body
  let payload: WebhookPayload;
  try {
    payload = await req.json() as WebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Route to handler
  try {
    switch (source) {
      case 'instagram':
        await handleInstagramWebhook(payload);
        break;
      case 'hikerapi':
        await handleHikerApiWebhook(payload);
        break;
      case 'admin':
        await handleAdminWebhook(payload);
        break;
    }
  } catch (err) {
    console.error(`Webhook handler failed [${source}]:`, err);
    // Don't return error to caller — webhooks should ack even on internal failure
  }

  return new Response(JSON.stringify({ received: true, timestamp: new Date().toISOString() }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

async function handleInstagramWebhook(payload: WebhookPayload) {
  // TODO: Process Instagram webhook (new posts, updates)
  console.log('Instagram webhook:', payload.event, payload.data);
}

async function handleHikerApiWebhook(payload: WebhookPayload) {
  // TODO: Process HikerAPI callback (media lookup results)
  console.log('HikerAPI webhook:', payload.event, payload.data);
}

async function handleAdminWebhook(payload: WebhookPayload) {
  // TODO: Process admin-triggered webhooks (manual refresh, re-parse)
  console.log('Admin webhook:', payload.event, payload.data);
}
