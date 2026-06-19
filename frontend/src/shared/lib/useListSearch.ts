import { useCallback, useEffect, useState } from "react";

const SEARCH_DEBOUNCE_MS = 300;

export type ListSearch = {
  /** Whether the searchbar is shown in place of the screen title/header. */
  active: boolean;
  /** Raw, un-debounced text bound to the searchbar input. */
  input: string;
  /** Debounced term; consumers refetch their list when this changes. */
  term: string;
  setInput: (text: string) => void;
  /** Reveals the searchbar. */
  open: () => void;
  /** Hides the searchbar and clears the term. */
  close: () => void;
};

type ListSearchOptions = {
  canOpen?: boolean;
  onBlockedOpen?: () => void;
};

export function canUseOnlineSearch({
  isConnected,
  isInternetReachable
}: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean {
  return isConnected !== false && isInternetReachable !== false;
}

/**
 * Searchbar UI state for the searchable list screens: an "active" flag plus the
 * raw input debounced into a committed `term`. The data side (refetching when
 * `term` changes) lives in {@link usePaginatedFeed}, keeping this concerned only
 * with input.
 */
export function useListSearch({ canOpen = true, onBlockedOpen }: ListSearchOptions = {}): ListSearch {
  const [active, setActive] = useState(false);
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");

  // Debounce the raw input into the committed term so typing does not fire a
  // request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setTerm(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [input]);

  useEffect(() => {
    if (canOpen || !active) return;
    setActive(false);
    setInput("");
    setTerm("");
  }, [active, canOpen]);

  const open = useCallback(() => {
    if (!canOpen) {
      onBlockedOpen?.();
      return;
    }
    setActive(true);
  }, [canOpen, onBlockedOpen]);
  const close = useCallback(() => {
    setActive(false);
    setInput("");
    setTerm("");
  }, []);

  return { active, input, term, setInput, open, close };
}
