/**
 * Remembers the last group/friend the user added an expense to, but only when
 * the Add screen is opened from the navigation tab (not when it was launched
 * from a specific group/friend with a pre-populated target).
 *
 * Two device-only values are kept:
 *  - a flag for whether the user opted in via the "Remember Group / Friend"
 *    checkbox, and
 *  - the last context (type + id) that was selected while the checkbox was on.
 *
 * When the flag is off we clear the stored context so unchecking the box really
 * does mean "no pre-population next time".
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ContextType } from "../types/models";

const REMEMBER_KEY = "splex.add.rememberContext";
const LAST_CONTEXT_KEY = "splex.add.lastContext";

export type RememberedContext = {
  type: ContextType;
  id: number;
};

export type RememberContextPreference = {
  remember: boolean;
  context: RememberedContext | null;
};

export async function loadRememberContextPreference(): Promise<RememberContextPreference> {
  const [rememberRaw, contextRaw] = await Promise.all([
    AsyncStorage.getItem(REMEMBER_KEY),
    AsyncStorage.getItem(LAST_CONTEXT_KEY)
  ]);
  const remember = rememberRaw === "true";
  let context: RememberedContext | null = null;
  if (contextRaw) {
    try {
      const parsed = JSON.parse(contextRaw) as RememberedContext;
      if (
        parsed &&
        (parsed.type === "group" || parsed.type === "friendship") &&
        typeof parsed.id === "number"
      ) {
        context = parsed;
      }
    } catch {
      context = null;
    }
  }
  return { remember, context };
}

export async function saveRememberContextPreference(
  preference: RememberContextPreference
): Promise<void> {
  if (!preference.remember) {
    await Promise.all([
      AsyncStorage.setItem(REMEMBER_KEY, "false"),
      AsyncStorage.removeItem(LAST_CONTEXT_KEY)
    ]);
    return;
  }
  await Promise.all([
    AsyncStorage.setItem(REMEMBER_KEY, "true"),
    preference.context
      ? AsyncStorage.setItem(LAST_CONTEXT_KEY, JSON.stringify(preference.context))
      : AsyncStorage.removeItem(LAST_CONTEXT_KEY)
  ]);
}
