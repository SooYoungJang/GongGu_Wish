export interface GroupBuyRequestResult {
  requestId: string;
  productName: string;
  requestCount: number;
  alreadyRequested: boolean;
  rankingEligible: boolean;
}

export interface GroupBuyRequestRanking {
  rank: number;
  requestId: string;
  productName: string;
  requestCount: number;
}
