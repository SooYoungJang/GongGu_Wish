import { postgrestPost } from "../../lib/postgrest-client";
import type { CommentPage, CommentSort, CommentView } from "./types";
import {
  COMMENT_TERMS_VERSION,
  createClientRequestId,
  normalizeCommentBody,
} from "./utils";

function normalizePage(value: unknown): CommentPage {
  const raw = (value ?? {}) as Partial<CommentPage> & { items?: unknown };
  return {
    items: Array.isArray(raw.items) ? (raw.items as CommentView[]) : [],
    nextCursor: typeof raw.nextCursor === "string" ? raw.nextCursor : null,
    liveRanking: raw.liveRanking === true,
  };
}

export async function listCommentRoots(
  groupBuyId: string,
  sort: CommentSort,
  cursor: string | null = null,
  limit = 20,
): Promise<CommentPage> {
  const data = await postgrestPost<unknown>("rpc/list_comment_roots", {
    p_group_buy_id: groupBuyId,
    p_sort: sort,
    p_limit: limit,
    p_cursor: cursor,
  });
  return normalizePage(data);
}

export async function listCommentChildren(
  groupBuyId: string,
  parentId: string,
  cursor: string | null = null,
  limit = 20,
): Promise<CommentPage> {
  const data = await postgrestPost<unknown>("rpc/list_comment_children", {
    p_group_buy_id: groupBuyId,
    p_parent_id: parentId,
    p_limit: limit,
    p_cursor: cursor,
  });
  return normalizePage(data);
}

export async function acceptCommentTerms(
  termsVersion = COMMENT_TERMS_VERSION,
): Promise<void> {
  await postgrestPost("rpc/accept_comment_terms", {
    p_terms_version: termsVersion,
  });
}

export async function createComment(input: {
  groupBuyId: string;
  parentId?: string | null;
  body: string;
  clientRequestId?: string;
  termsVersion?: string;
}): Promise<CommentView> {
  const data = await postgrestPost<CommentView>("rpc/create_comment", {
    p_group_buy_id: input.groupBuyId,
    p_parent_id: input.parentId ?? null,
    p_body: normalizeCommentBody(input.body),
    p_client_request_id: input.clientRequestId ?? createClientRequestId(),
    p_terms_version: input.termsVersion ?? COMMENT_TERMS_VERSION,
  });
  return data;
}

export async function updateComment(
  commentId: string,
  expectedVersion: number,
  body: string,
): Promise<CommentView> {
  return postgrestPost<CommentView>("rpc/update_comment", {
    p_comment_id: commentId,
    p_expected_version: expectedVersion,
    p_body: normalizeCommentBody(body),
  });
}

export async function deleteComment(commentId: string): Promise<CommentView> {
  return postgrestPost<CommentView>("rpc/delete_comment", {
    p_comment_id: commentId,
  });
}

export async function setCommentLike(
  commentId: string,
  liked: boolean,
): Promise<CommentView> {
  return postgrestPost<CommentView>("rpc/set_comment_like", {
    p_comment_id: commentId,
    p_liked: liked,
  });
}

export async function reportComment(
  commentId: string,
  reason: string,
  details?: string,
): Promise<void> {
  await postgrestPost("rpc/report_comment", {
    p_comment_id: commentId,
    p_reason: reason,
    p_details: details ?? null,
  });
}

export async function blockUserFromComment(commentId: string): Promise<void> {
  await postgrestPost("rpc/block_user_from_comment", {
    p_comment_id: commentId,
  });
}
