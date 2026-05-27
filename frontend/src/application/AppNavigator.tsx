import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import NetInfo from "@react-native-community/netinfo";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { useAuth } from "../features/auth/AuthContext";
import { ActivityScreen } from "../screens/activity/ActivityScreen";
import { AccountScreen } from "../screens/account/AccountScreen";
import { ImportFromServiceScreen } from "../screens/account/ImportFromServiceScreen";
import { SplitProImportScreen } from "../screens/account/SplitProImportScreen";
import { SplitwiseImportScreen } from "../screens/account/SplitwiseImportScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { AddScreen } from "../screens/expenses/AddScreen";
import { ExpenseDetailScreen } from "../screens/expenses/ExpenseDetailScreen";
import { FriendDetailScreen } from "../screens/friends/FriendDetailScreen";
import { FriendStatisticsScreen } from "../screens/friends/FriendStatisticsScreen";
import { CreateGroupScreen } from "../screens/groups/CreateGroupScreen";
import { GroupDetailScreen } from "../screens/groups/GroupDetailScreen";
import { GroupSettingsScreen } from "../screens/groups/GroupSettingsScreen";
import { GroupStatisticsScreen } from "../screens/groups/GroupStatisticsScreen";
import { InvitationAcceptScreen } from "../screens/invitations/InvitationAcceptScreen";
import { LegalDocumentScreen } from "../screens/legal/LegalDocumentScreen";
import { OpenSourceLicensesScreen } from "../screens/legal/OpenSourceLicensesScreen";
import { OverviewScreen } from "../screens/overview/OverviewScreen";
import { SettlementDetailScreen } from "../screens/settlements/SettlementDetailScreen";
import { useI18n } from "../shared/i18n/I18nContext";
import { clearUrlQuery, inviteDebug, inviteTokenFromCurrentUrl, PENDING_INVITE_STORAGE_KEY } from "../shared/lib/inviteLinks";
import { syncPendingMutations } from "../shared/sync/queue";
import { AccountStackParamList, AddStackParamList, ActivityStackParamList, OverviewStackParamList, RootStackParamList, TabParamList } from "./navigationTypes";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
const OverviewStack = createNativeStackNavigator<OverviewStackParamList>();
const ActivityStack = createNativeStackNavigator<ActivityStackParamList>();
const AddStack = createNativeStackNavigator<AddStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();

function OverviewStackNavigator() {
  const { t } = useI18n();
  return (
    <OverviewStack.Navigator>
      <OverviewStack.Screen
        name="OverviewHome"
        component={OverviewScreen}
        options={{ headerShown: false, title: t("tabs.overview") }}
      />
      <OverviewStack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: t("group.create") }} />
      <OverviewStack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: t("group.title") }} />
      <OverviewStack.Screen name="GroupSettings" component={GroupSettingsScreen} options={{ title: t("group.settings") }} />
      <OverviewStack.Screen name="GroupStatistics" component={GroupStatisticsScreen} options={{ title: t("statistics.title") }} />
      <OverviewStack.Screen name="FriendStatistics" component={FriendStatisticsScreen} options={{ title: t("statistics.title") }} />
      <OverviewStack.Screen name="FriendDetail" component={FriendDetailScreen} options={{ title: t("friend.title") }} />
      <OverviewStack.Screen name="AddExpense" component={AddScreen} options={{ title: t("expense.add") }} />
      <OverviewStack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: t("expense.details") }} />
      <OverviewStack.Screen name="SettlementDetail" component={SettlementDetailScreen} options={{ title: t("settlement.title") }} />
    </OverviewStack.Navigator>
  );
}

function ActivityStackNavigator() {
  const { t } = useI18n();
  return (
    <ActivityStack.Navigator>
      <ActivityStack.Screen
        name="ActivityHome"
        component={ActivityScreen}
        options={{ headerShown: false, title: t("tabs.activity") }}
      />
      <ActivityStack.Screen name="AddExpense" component={AddScreen} options={{ title: t("expense.add") }} />
      <ActivityStack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: t("expense.details") }} />
      <ActivityStack.Screen name="SettlementDetail" component={SettlementDetailScreen} options={{ title: t("settlement.title") }} />
    </ActivityStack.Navigator>
  );
}

function AccountStackNavigator() {
  const { t } = useI18n();
  return (
    <AccountStack.Navigator>
      <AccountStack.Screen
        name="AccountHome"
        component={AccountScreen}
        options={{ headerShown: false, title: t("tabs.account") }}
      />
      <AccountStack.Screen
        name="ImportFromService"
        component={ImportFromServiceScreen}
        options={{ title: t("importFromService.title") }}
      />
      <AccountStack.Screen
        name="SplitwiseImport"
        component={SplitwiseImportScreen}
        options={{ title: t("splitwiseImport.title") }}
      />
      <AccountStack.Screen
        name="SplitProImport"
        component={SplitProImportScreen}
        options={{ title: t("splitProImport.title") }}
      />
    </AccountStack.Navigator>
  );
}

function AddStackNavigator() {
  const { t } = useI18n();
  return (
    <AddStack.Navigator>
      <AddStack.Screen name="AddHome" component={AddScreen} options={{ title: t("expense.add") }} />
    </AddStack.Navigator>
  );
}

function MainTabs() {
  const { t } = useI18n();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarLabelPosition: "below-icon",
        tabBarHideOnKeyboard: true
      }}
    >
      <Tabs.Screen
        name="Overview"
        component={OverviewStackNavigator}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate({
              name: "Overview",
              params: {
                screen: "OverviewHome"
              },
              merge: false
            } as never);
          }
        })}
        options={{ title: t("tabs.overview"), tabBarIcon: ({ color }) => <MaterialCommunityIcons name="view-dashboard-outline" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="Add"
        component={AddStackNavigator}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate({
              name: "Add",
              params: {
                screen: "AddHome",
                params: { resetKey: Date.now() }
              },
              merge: false
            } as never);
          }
        })}
        options={{ title: t("tabs.add"), tabBarIcon: ({ color }) => <MaterialCommunityIcons name="plus-circle-outline" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="Activity"
        component={ActivityStackNavigator}
        options={{ title: t("tabs.activity"), tabBarIcon: ({ color }) => <MaterialCommunityIcons name="history" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="Account"
        component={AccountStackNavigator}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate({
              name: "Account",
              params: { screen: "AccountHome" },
              merge: false
            } as never);
          }
        })}
        options={{ title: t("tabs.account"), tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-cog-outline" size={22} color={color} /> }}
      />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { t } = useI18n();
  const { tokens, api, initialized } = useAuth();
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [checkedAuthState, setCheckedAuthState] = useState<"guest" | "auth" | null>("guest");

  useEffect(() => {
    let cancelled = false;

    async function useInviteTokenIfValid(token: string, source: "url" | "storage") {
      inviteDebug("navigator validating invite token", {
        source,
        tokenPreview: `${token.slice(0, 6)}...`
      });
      try {
        const preview = await api.get<{ valid: boolean }>(`/api/invitations/${token}/`);
        if (cancelled) return;
        if (preview.valid) {
          inviteDebug("navigator invite token is valid", { source });
          if (source === "storage") {
            await AsyncStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
          }
          setPendingInviteToken(token);
          return;
        }
        inviteDebug("navigator invite token is not valid", { source });
      } catch (error) {
        inviteDebug("navigator invite token validation failed", { source, error });
      }
      await AsyncStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
      if (source === "url") {
        clearUrlQuery();
      }
      setPendingInviteToken(null);
    }

    async function checkInvite() {
      const authState = tokens ? "auth" : "guest";
      inviteDebug("navigator invite check started", { authenticated: Boolean(tokens), authState });
      if (!tokens) {
        inviteDebug("navigator is unauthenticated; login screen will handle invite storage");
        setPendingInviteToken(null);
        setCheckedAuthState("guest");
        return;
      }

      setCheckedAuthState(null);
      const urlInviteToken = inviteTokenFromCurrentUrl();
      if (urlInviteToken) {
        inviteDebug("navigator found invite token in current url");
        await useInviteTokenIfValid(urlInviteToken, "url");
        if (!cancelled) setCheckedAuthState("auth");
        return;
      }

      const stored = await AsyncStorage.getItem(PENDING_INVITE_STORAGE_KEY);
      inviteDebug("navigator loaded pending invite token from storage", { hasStoredToken: Boolean(stored) });
      if (stored) {
        await useInviteTokenIfValid(stored, "storage");
      } else {
        setPendingInviteToken(null);
      }
      if (!cancelled) {
        inviteDebug("navigator invite check finished");
        setCheckedAuthState("auth");
      }
    }

    checkInvite().catch((error) => {
      inviteDebug("navigator invite check failed", error);
      setPendingInviteToken(null);
      setCheckedAuthState(tokens ? "auth" : "guest");
    });

    return () => {
      cancelled = true;
    };
  }, [tokens, api]);

  useEffect(() => {
    if (!tokens) return;

    syncPendingMutations.flush(api).catch(() => undefined);

    return NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncPendingMutations.flush(api).catch(() => undefined);
      }
    });
  }, [api, tokens]);

  if (!initialized) {
    return null;
  }

  if (tokens && checkedAuthState !== "auth") {
    inviteDebug("navigator waiting for invite check before rendering");
    return null;
  }

  inviteDebug("navigator rendering stack", {
    authenticated: Boolean(tokens),
    checkedAuthState,
    hasPendingInviteToken: Boolean(pendingInviteToken),
    initialRouteName: tokens ? (pendingInviteToken ? "InvitationAccept" : "Main") : "Login"
  });

  return (
    <Stack.Navigator
      key={tokens ? `auth-${pendingInviteToken ?? "main"}` : "login"}
      initialRouteName={tokens ? (pendingInviteToken ? "InvitationAccept" : "Main") : "Login"}
    >
      <Stack.Screen
        name="TermsOfService"
        options={{ title: t("legal.tos.title") }}
      >
        {() => <LegalDocumentScreen kind="tos" />}
      </Stack.Screen>
      <Stack.Screen
        name="PrivacyPolicy"
        options={{ title: t("legal.privacy.title") }}
      >
        {() => <LegalDocumentScreen kind="privacy" />}
      </Stack.Screen>
      <Stack.Screen
        name="Imprint"
        options={{ title: t("legal.imprint.title") }}
      >
        {() => <LegalDocumentScreen kind="imprint" />}
      </Stack.Screen>
      <Stack.Screen
        name="OpenSourceLicenses"
        component={OpenSourceLicensesScreen}
        options={{ title: t("legal.openSource.title") }}
      />
      {tokens ? (
        pendingInviteToken ? (
          <>
            <Stack.Screen
              name="InvitationAccept"
              component={InvitationAcceptScreen}
              initialParams={{ token: pendingInviteToken }}
            />
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="InvitationAccept" component={InvitationAcceptScreen} />
          </>
        )
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false, title: t("auth.title") }}
          />
          <Stack.Screen
            name="LoginMagic"
            component={LoginScreen}
            options={{ headerShown: false, title: t("auth.title") }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
