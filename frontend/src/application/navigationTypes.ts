import { ContextType } from "../shared/types/models";

export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  InvitationAccept: { token?: string } | undefined;
};

export type OverviewStackParamList = {
  OverviewHome: undefined;
  CreateGroup: undefined;
  GroupDetail: { id: number };
  GroupSettings: { id: number };
  FriendDetail: { id: number };
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
