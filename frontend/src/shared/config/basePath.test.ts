import { describe, expect, it } from "vitest";

import { addBasePath, BASE_PATH, restoreBasePathInState, stripBasePath } from "./basePath";

// Walk a navigation state to its focused leaf route (mirrors React Navigation's
// internal findFocusedRoute, which it uses to read route.path for the URL).
function focusedRoute(state: any): any {
  let route = state.routes[state.index ?? state.routes.length - 1];
  while (route.state) {
    const child = route.state;
    route = child.routes[child.index ?? child.routes.length - 1];
  }
  return route;
}

// BASE_PATH is a fixed constant mirroring expo.experiments.baseUrl and the
// backend's APP_BASE_PATH.
describe("basePath", () => {
  it("is the fixed /app prefix", () => {
    expect(BASE_PATH).toBe("/app");
  });

  describe("stripBasePath", () => {
    it("removes the prefix from a nested path", () => {
      expect(stripBasePath("/app/invite/abc")).toBe("/invite/abc");
    });

    it("maps the bare base path to root", () => {
      expect(stripBasePath("/app")).toBe("/");
    });

    it("keeps the query string when stripping", () => {
      expect(stripBasePath("/app/login/magic?token=x")).toBe("/login/magic?token=x");
    });

    it("handles the base path immediately followed by a query", () => {
      expect(stripBasePath("/app?foo=1")).toBe("/?foo=1");
    });

    it("leaves unrelated paths untouched (e.g. custom-scheme deep links)", () => {
      expect(stripBasePath("/invite/abc")).toBe("/invite/abc");
      expect(stripBasePath("/application")).toBe("/application");
    });
  });

  describe("addBasePath", () => {
    it("prepends the prefix to a root-relative path", () => {
      expect(addBasePath("/groups/1")).toBe("/app/groups/1");
    });

    it("normalizes a path without a leading slash", () => {
      expect(addBasePath("account")).toBe("/app/account");
    });
  });

  it("round-trips strip -> add for app paths", () => {
    const original = "/app/groups/42";
    expect(addBasePath(stripBasePath(original))).toBe(original);
  });

  describe("restoreBasePathInState", () => {
    it("re-adds the prefix to a flat focused route's path", () => {
      const state = { index: 0, routes: [{ name: "Login", path: "/login" }] };
      expect(focusedRoute(restoreBasePathInState(state)).path).toBe("/app/login");
    });

    it("re-adds the prefix to a nested focused route's path", () => {
      const state = {
        index: 0,
        routes: [
          {
            name: "Main",
            state: { index: 0, routes: [{ name: "OverviewHome", path: "/groups/5" }] }
          }
        ]
      };
      expect(focusedRoute(restoreBasePathInState(state)).path).toBe("/app/groups/5");
    });

    it("preserves the query string on the focused route", () => {
      const state = { index: 0, routes: [{ name: "LoginMagic", path: "/login/magic?token=x" }] };
      expect(focusedRoute(restoreBasePathInState(state)).path).toBe("/app/login/magic?token=x");
    });
  });

});
