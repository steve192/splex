import { useCallback, useEffect, useRef, useState } from "react";

const SEARCH_DEBOUNCE_MS = 300;

export type ListSearch = {
  /** Whether the searchbar is shown in place of the screen title/header. */
  active: boolean;
  /** Raw, un-debounced text bound to the searchbar input. */
  input: string;
  /** Current committed (debounced) term, also exposed via {@link termRef}. */
  term: string;
  /**
   * Ref mirror of the committed term so data-loading callbacks can read it
   * without having to be recreated whenever the term changes.
   */
  termRef: { readonly current: string };
  setInput: (text: string) => void;
  /** Reveals the searchbar. */
  open: () => void;
  /** Hides the searchbar and clears the term. */
  close: () => void;
};

/**
 * Search state shared by the searchable list screens (group / friend ledgers
 * and the activity feed): a debounced term, an "active" flag for the
 * searchbar, and a ref mirror of the term for use inside data-loading
 * callbacks.
 *
 * `onCommit` runs whenever the debounced term changes (skipping the initial
 * empty value so it does not race a screen's own first load), letting the
 * screen refetch its list with the new term applied.
 */
export function useListSearch(onCommit: () => void): ListSearch {
  const [active, setActive] = useState(false);
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const termRef = useRef("");
  const committedOnce = useRef(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Debounce the raw input into the committed term so typing does not fire a
  // request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setTerm(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [input]);

  // Notify the screen whenever the committed term changes, skipping the initial
  // empty value so it does not race the screen's focus-effect first load.
  useEffect(() => {
    termRef.current = term;
    if (!committedOnce.current) {
      committedOnce.current = true;
      return;
    }
    onCommitRef.current();
  }, [term]);

  const open = useCallback(() => setActive(true), []);
  const close = useCallback(() => {
    setActive(false);
    setInput("");
    setTerm("");
  }, []);

  return { active, input, term, termRef, setInput, open, close };
}
