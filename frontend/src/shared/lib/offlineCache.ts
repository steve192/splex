import AsyncStorage from "@react-native-async-storage/async-storage";

import { ActivityFeedEvent, Friend, Group, GroupBalance, LedgerItem, OverviewItem } from "../types/models";

const GROUPS_KEY = "splex.cache.groups";
const FRIENDS_KEY = "splex.cache.friends";
const OVERVIEW_KEY = "splex.cache.overview";
const ACTIVITY_KEY = "splex.cache.activity";

function groupKey(id: number) {
  return `splex.cache.group.${id}`;
}

function friendKey(id: number) {
  return `splex.cache.friend.${id}`;
}

function groupDetailKey(id: number) {
  return `splex.cache.groupDetail.${id}`;
}

function friendDetailKey(id: number) {
  return `splex.cache.friendDetail.${id}`;
}

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadCachedGroups(): Promise<Group[]> {
  return (await readJson<Group[]>(GROUPS_KEY)) ?? [];
}

export async function saveCachedGroups(groups: Group[]): Promise<void> {
  await writeJson(GROUPS_KEY, groups);
}

export async function loadCachedFriends(): Promise<Friend[]> {
  return (await readJson<Friend[]>(FRIENDS_KEY)) ?? [];
}

export async function saveCachedFriends(friends: Friend[]): Promise<void> {
  await writeJson(FRIENDS_KEY, friends);
}

export async function loadCachedGroup(id: number): Promise<Group | null> {
  return readJson<Group>(groupKey(id));
}

export async function saveCachedGroup(group: Group): Promise<void> {
  await writeJson(groupKey(group.id), group);
}

export async function loadCachedFriend(id: number): Promise<Friend | null> {
  return readJson<Friend>(friendKey(id));
}

export async function saveCachedFriend(friend: Friend): Promise<void> {
  await writeJson(friendKey(friend.id), friend);
}

export async function loadCachedOverviewItems(): Promise<OverviewItem[]> {
  return (await readJson<OverviewItem[]>(OVERVIEW_KEY)) ?? [];
}

export async function saveCachedOverviewItems(items: OverviewItem[]): Promise<void> {
  await writeJson(OVERVIEW_KEY, items);
}

export async function loadCachedActivityEvents(): Promise<ActivityFeedEvent[]> {
  return (await readJson<ActivityFeedEvent[]>(ACTIVITY_KEY)) ?? [];
}

export async function saveCachedActivityEvents(events: ActivityFeedEvent[]): Promise<void> {
  await writeJson(ACTIVITY_KEY, events);
}

export async function loadCachedGroupDetail(
  id: number
): Promise<{ detail: Group; balances: GroupBalance[]; ledger: LedgerItem[] } | null> {
  return readJson<{ detail: Group; balances: GroupBalance[]; ledger: LedgerItem[] }>(groupDetailKey(id));
}

export async function saveCachedGroupDetail(
  id: number,
  value: { detail: Group; balances: GroupBalance[]; ledger: LedgerItem[] }
): Promise<void> {
  await writeJson(groupDetailKey(id), value);
}

export async function loadCachedFriendDetail(
  id: number
): Promise<{ detail: Friend; ledger: LedgerItem[] } | null> {
  return readJson<{ detail: Friend; ledger: LedgerItem[] }>(friendDetailKey(id));
}

export async function saveCachedFriendDetail(
  id: number,
  value: { detail: Friend; ledger: LedgerItem[] }
): Promise<void> {
  await writeJson(friendDetailKey(id), value);
}