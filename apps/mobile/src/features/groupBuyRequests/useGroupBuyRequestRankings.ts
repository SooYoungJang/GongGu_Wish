import { useQuery } from "@tanstack/react-query";

import { fetchGroupBuyRequestRankings } from "./api";
import { GROUP_BUY_REQUEST_RANKINGS_QUERY_KEY } from "./queryKeys";

export function useGroupBuyRequestRankings() {
  return useQuery({
    queryKey: GROUP_BUY_REQUEST_RANKINGS_QUERY_KEY,
    queryFn: fetchGroupBuyRequestRankings,
  });
}
