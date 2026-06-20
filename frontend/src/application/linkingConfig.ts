import { RootStackParamList } from "./navigationTypes";

type ScreenConfig = NonNullable<
  NonNullable<import("@react-navigation/native").LinkingOptions<RootStackParamList>["config"]>["screens"]
>;

const numberParam = (value: string) => Number(value);
const booleanParam = (value: string) => value === "true";

const detailParams = { id: numberParam };
const expenseFormParams = {
  contextId: numberParam,
  expenseId: numberParam,
  resetKey: numberParam,
  returnToPrevious: booleanParam,
};

export const appLinkingScreens = {
  Login: "login",
  LoginMagic: "login/magic",
  TermsOfService: "tos",
  PrivacyPolicy: "privacy",
  Imprint: "imprint",
  OpenSourceLicenses: {
    path: "open-source",
    alias: ["OpenSourceLicenses"],
  },
  InvitationAccept: "invite/:token",
  Main: {
    screens: {
      Overview: {
        screens: {
          OverviewHome: "",
          CreateGroup: "groups/new",
          GroupDetail: { path: "groups/:id", parse: detailParams },
          GroupSettings: { path: "groups/:id/settings", parse: detailParams },
          GroupStatistics: {
            path: "groups/:id/statistics",
            alias: [{ path: "GroupStatistics", parse: detailParams }],
            parse: detailParams,
          },
          FriendDetail: { path: "friends/:id", parse: detailParams },
          FriendSettings: { path: "friends/:id/settings", parse: detailParams },
          FriendStatistics: {
            path: "friends/:id/statistics",
            alias: [{ path: "FriendStatistics", parse: detailParams }],
            parse: detailParams,
          },
          AddExpense: { path: "AddExpense", parse: expenseFormParams },
          ExpenseDetail: { path: "expenses/:id", parse: detailParams },
          SettlementDetail: { path: "settlements/:id", parse: detailParams },
        },
      },
      Add: {
        screens: {
          AddHome: { path: "add", parse: expenseFormParams },
        },
      },
      Activity: {
        path: "activity",
        screens: {
          ActivityHome: "",
          AddExpense: { path: "AddExpense", parse: expenseFormParams },
          ExpenseDetail: { path: "expenses/:id", parse: detailParams },
          SettlementDetail: { path: "settlements/:id", parse: detailParams },
        },
      },
      Account: {
        path: "account",
        screens: {
          AccountHome: "",
          ImportFromService: {
            path: "import",
            alias: ["ImportFromService"],
          },
          SplitwiseImport: {
            path: "import/splitwise",
            alias: ["SplitwiseImport"],
          },
          SplitProImport: {
            path: "import/split-pro",
            alias: ["SplitProImport"],
          },
          PaymentMethods: {
            path: "payment-methods",
            alias: ["PaymentMethods"],
          },
        },
      },
    },
  },
} satisfies ScreenConfig;
