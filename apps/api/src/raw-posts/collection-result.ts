export function collectionResult<
  T extends { groupBuy?: { id: string } | null },
>(record: T, created: boolean) {
  const { groupBuy, ...rawPost } = record;
  const groupBuyId = groupBuy?.id ?? null;

  return {
    rawPost,
    created,
    duplicate: !created,
    groupBuyId,
    reviewCandidateCreated: created && groupBuyId !== null,
  };
}
