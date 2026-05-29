/**
 * Per-group UI preferences kept on the device only.
 *
 * Currently just remembers whether the user wants to see simplified vs.
 * detailed balances for each group.  Stored under one AsyncStorage key per
 * group so toggling on one group doesn't affect another.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const SIMPLIFY_BALANCES_KEY_PREFIX = "splex.group.simplifyBalances.";

function simplifyKey(groupId: number): string {
  return `${SIMPLIFY_BALANCES_KEY_PREFIX}${groupId}`;
}

export async function loadSimplifyBalancesPreference(groupId: number): Promise<boolean> {
  const raw = await AsyncStorage.getItem(simplifyKey(groupId));
  return raw === "true";
}

export async function saveSimplifyBalancesPreference(
  groupId: number,
  enabled: boolean
): Promise<void> {
  await AsyncStorage.setItem(simplifyKey(groupId), enabled ? "true" : "false");
}
