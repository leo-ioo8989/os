export type ApiErrorCode = 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
export class ApiError extends Error {
  constructor(public readonly status: 401 | 403 | 404 | 409 | 422 | 429 | 500, public readonly code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
export function errorBody(error: unknown) {
  if (error instanceof ApiError) return { error: { code: error.code, message: error.message } };
  return { error: { code: 'INTERNAL_ERROR' as const, message: 'An internal error occurred.' } };
}