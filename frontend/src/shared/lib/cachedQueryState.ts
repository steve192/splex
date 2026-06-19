export function cachedQueryRefreshCountAfterDelta(current: number, delta: 1 | -1): number {
  return Math.max(0, current + delta);
}

export function cachedQueryLoading({
  foregroundLoading,
  backgroundRefreshes
}: {
  foregroundLoading: boolean;
  backgroundRefreshes: number;
}): boolean {
  return foregroundLoading || backgroundRefreshes > 0;
}

export function cachedQueryLoadingInitial({
  hasData,
  loading
}: {
  hasData: boolean;
  loading: boolean;
}): boolean {
  return loading && !hasData;
}
