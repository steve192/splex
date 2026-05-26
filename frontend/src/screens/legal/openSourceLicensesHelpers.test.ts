import { describe, expect, it } from "vitest";

import { componentSummary, visibleSections } from "./openSourceLicensesHelpers";


describe("openSourceLicensesHelpers", () => {
  it("filters empty sections", () => {
    expect(visibleSections([
      { id: "frontend", title: "Frontend", components: [{ source: "frontend", name: "react", license: "MIT" }] },
      { id: "backend", title: "Backend", components: [] }
    ])).toEqual([
      { id: "frontend", title: "Frontend", components: [{ source: "frontend", name: "react", license: "MIT" }] }
    ]);
  });

  it("formats component summary", () => {
    expect(componentSummary({ source: "backend", name: "Django", license: "BSD-3-Clause" })).toBe("BSD-3-Clause");
  });
});