/**
 * API Error Types
 *
 * Shared between postgrest-client.ts and api.ts to avoid circular imports.
 */

export interface ApiValidationError {
  field: string;
  message: string;
  code: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: ApiValidationError[],
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isRateLimit(): boolean {
    return this.status === 429;
  }

  get isValidationError(): boolean {
    return this.status === 400 && Array.isArray(this.errors);
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number; // 1-indexed
  limit: number;
}
