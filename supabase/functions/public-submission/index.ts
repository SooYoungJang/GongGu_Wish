// ============================================================================
// Edge Function: public-submission
// Purpose: Public GongGu submission intake via Supabase service role.
//
// Invoke: POST /functions/v1/public-submission
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE' | 'CANCELLED';

interface SubmissionRequest {
  productName?: string;
  brandName?: string;
  startDate?: string;
  endDate?: string;
  purchaseUrl?: string;
  discountInfo?: string;
  summary?: string;
  instagramUrl?: string;
  imageUrls?: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  mediaUrls?: string[];
  mediaType?: string;
  reporterName?: string;
  reporterContact?: string;
  isAnonymous?: boolean;
}

interface ExistingSubmission {
  id: string;
  status: SubmissionStatus;
  group_buy_id: string | null;
  image_urls: string[] | null;
}

type ValidatedSubmissionRow = {
  product_name: string;
  brand_name: string | null;
  start_date: string | null;
  end_date: string | null;
  purchase_url: string | null;
  discount_info: string | null;
  summary: string | null;
  instagram_url: string | null;
  image_urls: string[];
  thumbnail_url: string | null;
  video_url: string | null;
  media_urls: string[];
  media_type: string | null;
  reporter_name: string | null;
  reporter_contact: string | null;
  is_anonymous: boolean;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
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

function normalizeOptional(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isUrl(value: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isDate(value: string | null) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function createSubmissionHash(input: {
  productName: string;
  startDate: string | null;
  purchaseUrl: string | null;
}) {
  const normalizedProductName = input.productName.toLowerCase().replace(/\s+/g, '');
  const normalizedStartDate = input.startDate ? new Date(input.startDate).toISOString().split('T')[0] : '';
  const normalizedPurchaseUrl = input.purchaseUrl?.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') ?? '';

  return sha256(`${normalizedProductName}|${normalizedStartDate}|${normalizedPurchaseUrl}`);
}

function validate(body: SubmissionRequest) {
  const productName = normalizeOptional(body.productName);
  const brandName = normalizeOptional(body.brandName);
  const startDate = normalizeOptional(body.startDate);
  const endDate = normalizeOptional(body.endDate);
  const purchaseUrl = normalizeOptional(body.purchaseUrl);
  const discountInfo = normalizeOptional(body.discountInfo);
  const summary = normalizeOptional(body.summary);
  const instagramUrl = normalizeOptional(body.instagramUrl);
  const reporterName = normalizeOptional(body.reporterName);
  const reporterContact = normalizeOptional(body.reporterContact);
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((url): url is string => typeof url === 'string' && isUrl(url)).slice(0, 5)
    : [];
  const thumbnailUrl = isUrl(normalizeOptional(body.thumbnailUrl)) ? normalizeOptional(body.thumbnailUrl) : null;
  const videoUrl = isUrl(normalizeOptional(body.videoUrl)) ? normalizeOptional(body.videoUrl) : null;
  const mediaUrls = Array.isArray(body.mediaUrls)
    ? body.mediaUrls.filter((url): url is string => typeof url === 'string' && isUrl(url)).slice(0, 20)
    : [];
  const mediaType = typeof body.mediaType === 'string' && ['IMAGE', 'VIDEO'].includes(body.mediaType)
    ? body.mediaType
    : null;

  if (!productName || productName.length < 2) {
    return { error: '제품명은 2자 이상 필수입니다.' };
  }
  if (productName.length > 100) {
    return { error: '제품명은 100자 이하로 입력해주세요.' };
  }
  if (brandName && brandName.length > 50) {
    return { error: '브랜드명은 50자 이하로 입력해주세요.' };
  }
  if (!isDate(startDate) || !isDate(endDate)) {
    return { error: '날짜는 YYYY-MM-DD 형식으로 입력해주세요.' };
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return { error: '시작일은 마감일보다 늦을 수 없습니다.' };
  }
  if (!isUrl(purchaseUrl) || !isUrl(instagramUrl)) {
    return { error: 'URL 형식을 확인해주세요.' };
  }
  if (discountInfo && discountInfo.length > 200) {
    return { error: '할인 정보는 200자 이하로 입력해주세요.' };
  }
  if (summary && summary.length > 500) {
    return { error: '요약은 500자 이하로 입력해주세요.' };
  }

  return {
    data: {
      product_name: productName,
      brand_name: brandName,
      start_date: startDate,
      end_date: endDate,
      purchase_url: purchaseUrl,
      discount_info: discountInfo,
      summary,
    instagram_url: instagramUrl,
    image_urls: imageUrls,
    thumbnail_url: thumbnailUrl,
    video_url: videoUrl,
    media_urls: mediaUrls,
    media_type: mediaType,
    reporter_name: reporterName,
    reporter_contact: reporterContact,
    is_anonymous: body.isAnonymous ?? true,
    },
  };
}

async function upsertApprovedGroupBuy(
  supabase: ReturnType<typeof createAdminClient>,
  row: ValidatedSubmissionRow,
  submissionId: string,
  existingGroupBuyId: string | null,
) {
  const payload = {
    source_type: 'SUBMISSION',
    submission_id: submissionId,
    product_name: row.product_name,
    brand_name: row.brand_name,
    start_date: row.start_date,
    end_date: row.end_date,
    purchase_url: row.purchase_url,
    discount_info: row.discount_info,
    summary: row.summary,
    thumbnail_url: row.thumbnail_url,
    video_url: row.video_url,
    media_urls: row.media_urls,
    media_type: row.media_type,
    confidence: 0.9,
    status: 'APPROVED',
    is_all_day: false,
    updated_at: new Date().toISOString(),
  };

  if (existingGroupBuyId) {
    const { data, error } = await supabase
      .from('group_buys')
      .update(payload)
      .eq('id', existingGroupBuyId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from('group_buys')
    .insert({
      id: crypto.randomUUID(),
      ...payload,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function markSubmissionApproved(
  supabase: ReturnType<typeof createAdminClient>,
  submissionId: string,
  groupBuyId: string,
) {
  const { data, error } = await supabase
    .from('gonggu_submissions')
    .update({
      status: 'APPROVED',
      group_buy_id: groupBuyId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'public-submission',
      admin_memo: '제보 즉시 자동 등록',
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function handleSubmission(body: SubmissionRequest) {
  const validated = validate(body);
  if ('error' in validated) {
    return json({ error: validated.error }, 400);
  }

  const supabase = createAdminClient();
  const row = validated.data;
  const contentHash = await createSubmissionHash({
    productName: row.product_name,
    startDate: row.start_date,
    purchaseUrl: row.purchase_url,
  });

  const { data: existing, error: findError } = await supabase
    .from('gonggu_submissions')
    .select('id,status,group_buy_id,image_urls')
    .eq('content_hash', contentHash)
    .maybeSingle<ExistingSubmission>();

  if (findError) throw new Error(findError.message);

  if (existing) {
    if (existing.status === 'APPROVED') {
      return json({
        alreadyRegistered: true,
        groupBuyId: existing.group_buy_id,
        submissionId: existing.id,
        status: 'APPROVED',
      });
    }
    if (existing.status === 'DUPLICATE') {
      return json({ error: '중복 제보입니다.', submissionId: existing.id }, 409);
    }

    const mergedImageUrls = Array.from(new Set([...(existing.image_urls ?? []), ...row.image_urls])).slice(0, 5);
    const updatePayload = {
      product_name: row.product_name,
      brand_name: row.brand_name,
      start_date: row.start_date,
      end_date: row.end_date,
      purchase_url: row.purchase_url,
      discount_info: row.discount_info,
      summary: row.summary,
      instagram_url: row.instagram_url,
      image_urls: mergedImageUrls,
      reporter_name: row.reporter_name,
      reporter_contact: row.reporter_contact,
      is_anonymous: row.is_anonymous,
      status: 'PENDING',
      admin_memo: null,
      reviewed_at: null,
      reviewed_by: null,
      group_buy_id: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('gonggu_submissions')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const groupBuy = await upsertApprovedGroupBuy(supabase, { ...row, image_urls: mergedImageUrls }, existing.id, existing.group_buy_id);
    const submission = await markSubmissionApproved(supabase, existing.id, groupBuy.id);
    return json({ submission, groupBuy });
  }

  const { data, error } = await supabase
    .from('gonggu_submissions')
    .insert({
      id: crypto.randomUUID(),
      product_name: row.product_name,
      brand_name: row.brand_name,
      start_date: row.start_date,
      end_date: row.end_date,
      purchase_url: row.purchase_url,
      discount_info: row.discount_info,
      summary: row.summary,
      instagram_url: row.instagram_url,
      image_urls: row.image_urls,
      reporter_name: row.reporter_name,
      reporter_contact: row.reporter_contact,
      is_anonymous: row.is_anonymous,
      content_hash: contentHash,
      status: 'PENDING',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const groupBuy = await upsertApprovedGroupBuy(supabase, row, data.id, null);
  const submission = await markSubmissionApproved(supabase, data.id, groupBuy.id);
  return json({ submission, groupBuy });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json() as SubmissionRequest;
    return await handleSubmission(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[public-submission] Error:', message);
    return json({ error: message }, 500);
  }
});
