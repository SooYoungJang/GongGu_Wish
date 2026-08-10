import type { CollectionProfileLinkCandidate } from "../types";
import { normalizeProfileLinkCandidates } from "../../../../supabase/functions/_shared/automaticCollectionReview";

type ProfileLinkSnapshot = {
  originalPostUrl?: string | null;
  profileLinkCandidates?: unknown;
};

type AutomaticCollectionSourceItem = {
  originalPostUrl?: string | null;
  collectionProposalSnapshot?: ProfileLinkSnapshot | null;
  collectionReviewedSnapshot?: ProfileLinkSnapshot | null;
};

export function automaticCollectionOriginalPostUrl(item: {
  originalPostUrl?: string | null;
  collectionProposalSnapshot?: { originalPostUrl?: string | null } | null;
}) {
  return (
    item.collectionProposalSnapshot?.originalPostUrl ??
    item.originalPostUrl ??
    null
  );
}

export function automaticCollectionProfileLinkCandidates(
  item: AutomaticCollectionSourceItem,
): CollectionProfileLinkCandidate[] {
  const proposalCandidates =
    item.collectionProposalSnapshot?.profileLinkCandidates;
  const storedCandidates = Array.isArray(proposalCandidates)
    ? proposalCandidates
    : item.collectionReviewedSnapshot?.profileLinkCandidates;
  return normalizeProfileLinkCandidates(storedCandidates);
}

export function automaticCollectionProfilePurchaseFallback(
  item: AutomaticCollectionSourceItem,
) {
  const candidates = automaticCollectionProfileLinkCandidates(item);
  return candidates.length === 1 ? candidates[0].url : null;
}
