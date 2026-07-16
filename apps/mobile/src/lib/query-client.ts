import {
  focusManager,
  QueryCache,
  QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Platform, type AppStateStatus } from "react-native";

import { ApiError } from "./api-types";

const QUERY_CACHE_GC_TIME_MS = 5 * 60 * 1000;
const MAX_TRANSIENT_RETRIES = 1;

function apiStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

export function shouldRetryMobileQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= MAX_TRANSIENT_RETRIES) return false;
  if (error instanceof Error && error.name === "AbortError") return false;

  const status = apiStatus(error);
  if (status === undefined) return true;
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

export function reportQueryError(error: unknown, queryKey: QueryKey): void {
  console.error("[Query] request failed", {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : typeof error,
    queryKey,
    status: apiStatus(error),
  });
}

export function createMobileQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => reportQueryError(error, query.queryKey),
    }),
    defaultOptions: {
      queries: {
        gcTime: QUERY_CACHE_GC_TIME_MS,
        refetchOnMount: "always",
        refetchOnReconnect: "always",
        refetchOnWindowFocus: "always",
        retry: shouldRetryMobileQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        staleTime: 0,
      },
    },
  });
}

// TanStack Query requires React Native AppState to drive its focus manager.
// Source: https://tanstack.com/query/v5/docs/framework/react/guides/window-focus-refetching#managing-focus-in-react-native
export function syncQueryFocus(
  status: AppStateStatus,
  platform: typeof Platform.OS = Platform.OS,
): void {
  if (platform !== "web") {
    focusManager.setFocused(status === "active");
  }
}

export const mobileQueryClient = createMobileQueryClient();
