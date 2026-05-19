import { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

type Options = {
  enabled?: boolean;
  loadingMore: boolean;
  nextOffset: number | null;
  threshold?: number;
  onLoadMore: (offset: number) => void;
};

export function useInfiniteScroll({
  enabled = true,
  loadingMore,
  nextOffset,
  threshold = 320,
  onLoadMore
}: Options) {
  return function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!enabled || loadingMore || nextOffset === null) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (remaining < threshold) onLoadMore(nextOffset);
  };
}
