import { getPathFromState, getStateFromPath } from "@react-navigation/core";
import { describe, expect, it } from "vitest";

import { appLinkingScreens } from "./linkingConfig";
import type { RootStackParamList } from "./navigationTypes";

const linkingOptions = { screens: appLinkingScreens };

function focusedRoute(state: any): any {
  let route = state.routes[state.index ?? state.routes.length - 1];
  while (route.state) {
    const child = route.state;
    route = child.routes[child.index ?? child.routes.length - 1];
  }
  return route;
}

function parseFocusedRoute(path: string): any {
  const state = getStateFromPath<RootStackParamList>(path, linkingOptions);
  expect(state).toBeTruthy();
  return focusedRoute(state);
}

describe("appLinkingScreens", () => {
  it("opens the legacy AddExpense URL with typed edit params", () => {
    const route = parseFocusedRoute(
      "/AddExpense?expenseId=398&contextType=group&contextId=16&resetKey=1781945846165&returnToPrevious=true",
    );

    expect(route).toMatchObject({
      name: "AddExpense",
      params: {
        expenseId: 398,
        contextType: "group",
        contextId: 16,
        resetKey: 1781945846165,
        returnToPrevious: true,
      },
    });
  });

  it.each([
    ["/login", "Login", undefined],
    ["/login/magic?token=magic&inviteToken=invite", "LoginMagic", { token: "magic", inviteToken: "invite" }],
    ["/tos", "TermsOfService", undefined],
    ["/privacy", "PrivacyPolicy", undefined],
    ["/imprint", "Imprint", undefined],
    ["/open-source", "OpenSourceLicenses", undefined],
    ["/OpenSourceLicenses", "OpenSourceLicenses", undefined],
    ["/invite/invite-token", "InvitationAccept", { token: "invite-token" }],
    ["/currency-converter", "CurrencyConverter", undefined],
    ["/groups/new", "CreateGroup", undefined],
    ["/groups/16", "GroupDetail", { id: 16 }],
    ["/groups/16/settings", "GroupSettings", { id: 16 }],
    ["/groups/16/statistics", "GroupStatistics", { id: 16 }],
    ["/GroupStatistics?id=16", "GroupStatistics", { id: 16 }],
    ["/friends/7", "FriendDetail", { id: 7 }],
    ["/friends/7/settings", "FriendSettings", { id: 7 }],
    ["/friends/7/statistics", "FriendStatistics", { id: 7 }],
    ["/FriendStatistics?id=7", "FriendStatistics", { id: 7 }],
    ["/expenses/398", "ExpenseDetail", { id: 398 }],
    ["/settlements/9", "SettlementDetail", { id: 9 }],
    ["/add?contextType=friendship&contextId=7", "AddHome", { contextType: "friendship", contextId: 7 }],
    ["/activity", "ActivityHome", undefined],
    ["/activity/AddExpense?pendingMutationId=pending-1&returnToPrevious=true", "AddExpense", {
      pendingMutationId: "pending-1",
      returnToPrevious: true,
    }],
    ["/activity/expenses/398", "ExpenseDetail", { id: 398 }],
    ["/activity/settlements/9", "SettlementDetail", { id: 9 }],
    ["/account", "AccountHome", undefined],
    ["/account/import", "ImportFromService", undefined],
    ["/account/ImportFromService", "ImportFromService", undefined],
    ["/account/import/splitwise", "SplitwiseImport", undefined],
    ["/account/SplitwiseImport", "SplitwiseImport", undefined],
    ["/account/import/split-pro", "SplitProImport", undefined],
    ["/account/SplitProImport", "SplitProImport", undefined],
    ["/account/payment-methods", "PaymentMethods", undefined],
    ["/account/PaymentMethods", "PaymentMethods", undefined],
  ])("maps %s to %s", (path, screenName, params) => {
    const route = parseFocusedRoute(path);

    expect(route.name).toBe(screenName);
    if (params) {
      expect(route.params).toMatchObject(params);
    }
  });

  it("generates a browsable AddExpense path", () => {
    const path = getPathFromState<RootStackParamList>(
      {
        routes: [
          {
            name: "Main",
            state: {
              routes: [
                {
                  name: "Overview",
                  state: {
                    routes: [
                      {
                        name: "AddExpense",
                        params: {
                          expenseId: 398,
                          contextType: "group",
                          contextId: 16,
                          resetKey: 1781945846165,
                          returnToPrevious: true,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
      linkingOptions,
    );

    expect(parseFocusedRoute(`/${path}`).name).toBe("AddExpense");
  });
});
