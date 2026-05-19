import AsyncStorage from "@react-native-async-storage/async-storage";

import { ActivityFeedEvent, Friend, Group, GroupBalance, LedgerItem, OverviewItem } from "../types/models";

type CacheStore<T> = {
  load(): Promise<T | null>;
  save(value: T): Promise<void>;
};

function cacheStore<T>(key: string): CacheStore<T> {
  return {
    async load() {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    async save(value: T) {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    }
  };
}

function keyedCacheStore<T>(prefix: string) {
  return (id: number): CacheStore<T> => cacheStore<T>(`${prefix}.${id}`);
}

const groupsStore = cacheStore<Group[]>("splex.cache.groups");
const friendsStore = cacheStore<Friend[]>("splex.cache.friends");
const overviewStore = cacheStore<OverviewItem[]>("splex.cache.overview");
const activityStore = cacheStore<ActivityFeedEvent[]>("splex.cache.activity");

const groupStore = keyedCacheStore<Group>("splex.cache.group");
const friendStore = keyedCacheStore<Friend>("splex.cache.friend");

type GroupDetailCache = { detail: Group; balances: GroupBalance[]; ledger: LedgerItem[] };
type FriendDetailCache = { detail: Friend; ledger: LedgerItem[] };

const groupDetailStore = keyedCacheStore<GroupDetailCache>("splex.cache.groupDetail");
const friendDetailStore = keyedCacheStore<FriendDetailCache>("splex.cache.friendDetail");

export async function loadCachedGroups(): Promise<Group[]> {
  return (await groupsStore.load()) ?? [];
}

export async function saveCachedGroups(groups: Group[]): Promise<void> {
  await groupsStore.save(groups);
}

export async function loadCachedFriends(): Promise<Friend[]> {
  return (await friendsStore.load()) ?? [];
}

export async function saveCachedFriends(friends: Friend[]): Promise<void> {
  await friendsStore.save(friends);
}

export async function loadCachedGroup(id: number): Promise<Group | null> {
  return groupStore(id).load();
}

export async function saveCachedGroup(group: Group): Promise<void> {
  await groupStore(group.id).save(group);
}

export async function loadCachedFriend(id: number): Promise<Friend | null> {
  return friendStore(id).load();
}

export async function saveCachedFriend(friend: Friend): Promise<void> {
  await friendStore(friend.id).save(friend);
}

export async function loadCachedOverviewItems(): Promise<OverviewItem[]> {
  return (await overviewStore.load()) ?? [];
}

export async function saveCachedOverviewItems(items: OverviewItem[]): Promise<void> {
  await overviewStore.save(items);
}

export async function loadCachedActivityEvents(): Promise<ActivityFeedEvent[]> {
  return (await activityStore.load()) ?? [];
}

export async function saveCachedActivityEvents(events: ActivityFeedEvent[]): Promise<void> {
  await activityStore.save(events);
}

export async function loadCachedGroupDetail(id: number): Promise<GroupDetailCache | null> {
  return groupDetailStore(id).load();
}

export async function saveCachedGroupDetail(id: number, value: GroupDetailCache): Promise<void> {
  await groupDetailStore(id).save(value);
}

export async function loadCachedFriendDetail(id: number): Promise<FriendDetailCache | null> {
  return friendDetailStore(id).load();
}

export async function saveCachedFriendDetail(id: number, value: FriendDetailCache): Promise<void> {
  await friendDetailStore(id).save(value);
}
