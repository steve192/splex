import { ContextType } from "../shared/types/models";

export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  LoginMagic: { token?: string } | undefined;
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
  Overview: undefined;
  Add: undefined;
  Activity: undefined;
  Account: undefined;
};
