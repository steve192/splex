import type { NavigatorScreenParams } from "@react-navigation/native";

import { ContextType } from "../shared/types/models";

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Login: undefined;
  LoginMagic: { token?: string; inviteToken?: string } | undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  Imprint: undefined;
  OpenSourceLicenses: undefined;
  InvitationAccept: { token?: string } | undefined;
};

export type OverviewStackParamList = {
  OverviewHome: undefined;
  CreateGroup: undefined;
  GroupDetail: { id: number };
  GroupSettings: { id: number };
  GroupStatistics: { id: number };
  FriendDetail: { id: number };
  FriendSettings: { id: number };
  FriendStatistics: { id: number };
  AddExpense:
    | {
        contextType?: ContextType;
        contextId?: number;
        expenseId?: number;
        pendingMutationId?: string;
        resetKey?: number;
        returnToPrevious?: boolean;
      }
    | undefined;
  ExpenseDetail: { id: number };
  SettlementDetail: { id: number };
};

export type ActivityStackParamList = {
  ActivityHome: undefined;
  AddExpense:
    | {
        contextType?: ContextType;
        contextId?: number;
        expenseId?: number;
        pendingMutationId?: string;
        resetKey?: number;
        returnToPrevious?: boolean;
      }
    | undefined;
  ExpenseDetail: { id: number };
  SettlementDetail: { id: number };
};

export type AccountStackParamList = {
  AccountHome: undefined;
  ImportFromService: undefined;
  SplitwiseImport: undefined;
  SplitProImport: undefined;
  PaymentMethods: undefined;
};

export type AddStackParamList = {
  AddHome:
    | {
        contextType?: ContextType;
        contextId?: number;
        expenseId?: number;
        pendingMutationId?: string;
        resetKey?: number;
        returnToPrevious?: boolean;
      }
    | undefined;
};

export type TabParamList = {
  Overview: NavigatorScreenParams<OverviewStackParamList> | undefined;
  Add: NavigatorScreenParams<AddStackParamList> | undefined;
  Activity: NavigatorScreenParams<ActivityStackParamList> | undefined;
  Account: NavigatorScreenParams<AccountStackParamList> | undefined;
};
