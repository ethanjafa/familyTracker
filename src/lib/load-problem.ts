import { errorMessage } from '@/lib/errors';

/** The parts of a query this needs (any React Query result fits). */
type Loadable = { isError: boolean; isFetching: boolean; data: unknown; error: unknown; refetch: () => unknown };

export type LoadProblem = { message: string; retrying: boolean; retry: () => void };

/**
 * A load that failed with nothing to show for it, or null when all is well. A failed refresh of
 * data that's already on screen isn't a problem: the screen keeps showing what it has.
 */
export function loadProblem(...queries: Loadable[]): LoadProblem | null {
  const failed = queries.filter((q) => q.isError && q.data === undefined);
  if (!failed.length) return null;
  return {
    message: friendlyLoadError(failed[0].error),
    retrying: failed.some((q) => q.isFetching),
    retry: () => failed.forEach((q) => q.refetch()),
  };
}

/** Network failures read as "check your connection"; anything else shows what the server said. */
export function friendlyLoadError(error: unknown): string {
  const message = errorMessage(error);
  if (/network request failed|failed to fetch|load failed|networkerror|timed? ?out|fetch failed/i.test(message)) {
    return 'Check your internet connection and try again.';
  }
  return message && message !== 'undefined' ? message : 'Something went wrong. Please try again.';
}
