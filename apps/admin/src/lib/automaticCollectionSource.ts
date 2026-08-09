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
