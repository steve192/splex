import { describe, expect, it, vi } from "vitest";

import type { Participant } from "../../shared/types/models";
import {
  applyPaymentsToForm,
  buildPayments,
  buildSplitPayload,
  currencyAmount,
  effectiveSplitMethod,
  hydrateSplit,
  perMemberShare,
  splitEvenly,
  splitTabValue
} from "./expenseFormLogic";

describe("expense form logic", () => {
  it("splits evenly with cent remainder", () => {
    const shares = splitEvenly(10, [1, 2, 3]);
    expect(shares[1] + shares[2] + shares[3]).toBe(10);
    expect(Object.values(shares).sort()).toEqual([3.33, 3.33, 3.34]);
  });

  it("maps equal split mode depending on selected participants", () => {
    expect(effectiveSplitMethod("equal_all", true)).toBe("equal_all");
    expect(effectiveSplitMethod("equal_all", false)).toBe("equal_selected");
    expect(effectiveSplitMethod("exact", true)).toBe("exact");
  });

  it("maps split tab value correctly", () => {
    expect(splitTabValue("equal_all")).toBe("equal");
    expect(splitTabValue("equal_selected")).toBe("equal");
    expect(splitTabValue("exact")).toBe("exact");
  });

  it("computes per-member shares for exact and percentage", () => {
    expect(
      perMemberShare({
        participantId: 1,
        tabValue: "exact",
        selectedParticipantIds: [1, 2],
        selectedEqualShares: {},
        splitValues: { 1: "3.5", 2: "1.5" },
        totalAmount: 5
      })
    ).toBe(3.5);
    expect(
      perMemberShare({
        participantId: 2,
        tabValue: "percentage",
        selectedParticipantIds: [1, 2],
        selectedEqualShares: {},
        splitValues: { 1: "60", 2: "40" },
        totalAmount: 10
      })
    ).toBe(4);
  });

  it("adjusted_equal splits the rest equally after subtracting adjustments", () => {
    // 5€ split with 2 people, +1€ adjustment on person 1
    // → base = (5 - 1) / 2 = 2, person 1 = 3, person 2 = 2 (sum = 5)
    const args = {
      tabValue: "adjusted_equal" as const,
      selectedParticipantIds: [1, 2],
      selectedEqualShares: {},
      splitValues: { 1: "1" },
      totalAmount: 5
    };
    expect(perMemberShare({ ...args, participantId: 1 })).toBeCloseTo(3, 2);
    expect(perMemberShare({ ...args, participantId: 2 })).toBeCloseTo(2, 2);
  });

  it("adjusted_equal supports adjustments on multiple participants", () => {
    // 12€ split with 3 people; +2 on p1, -1 on p3
    // → base = (12 - 1) / 3 = 3.67, 3.67, 3.66 (cent rounding)
    //   p1 = base + 2, p2 = base, p3 = base - 1, total still 12
    const args = {
      tabValue: "adjusted_equal" as const,
      selectedParticipantIds: [1, 2, 3],
      selectedEqualShares: {},
      splitValues: { 1: "2", 3: "-1" },
      totalAmount: 12
    };
    const shares = [1, 2, 3].map((id) =>
      perMemberShare({ ...args, participantId: id })
    );
    expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(12, 2);
    expect(shares[0]).toBeGreaterThan(shares[1]);
    expect(shares[1]).toBeGreaterThan(shares[2]);
  });

  it("builds split payloads by split method", () => {
    expect(buildSplitPayload({ method: "equal_all", selectedParticipantIds: [1], splitValues: {} })).toBeUndefined();
    expect(
      buildSplitPayload({
        method: "equal_selected",
        selectedParticipantIds: [1, 2],
        splitValues: {}
      })
    ).toEqual({ participant_ids: [1, 2] });
    expect(
      buildSplitPayload({
        method: "exact",
        selectedParticipantIds: [1],
        splitValues: { 1: "10,5" }
      })
    ).toEqual({
      shares: [{ participant_id: 1, amount: "10.5" }]
    });
  });

  it("builds single and multi-payer payment payloads", () => {
    const participants: Participant[] = [
      { id: 1, display_name: "A", kind: "registered", user_id: 1 },
      { id: 2, display_name: "B", kind: "registered", user_id: 2 }
    ];
    expect(
      buildPayments({
        multiPayer: false,
        participants,
        paymentValues: {},
        payerId: 2,
        amount: "12,25"
      })
    ).toEqual([{ participant_id: 2, amount: "12.25" }]);
    expect(
      buildPayments({
        multiPayer: true,
        participants,
        paymentValues: { 1: "7", 2: "3.5" },
        payerId: null,
        amount: "10.5"
      })
    ).toEqual([
      { participant_id: 1, amount: "7" },
      { participant_id: 2, amount: "3.5" }
    ]);
  });

  it("buildPayments returns undefined when single-payer has no payer", () => {
    expect(
      buildPayments({
        multiPayer: false,
        participants: [],
        paymentValues: {},
        payerId: null,
        amount: "5"
      })
    ).toBeUndefined();
  });

  it("currencyAmount formats absolute amount with currency", () => {
    expect(currencyAmount(12.5, "EUR")).toBe("12.50 EUR");
    expect(currencyAmount(-3, "USD")).toBe("3.00 USD");
  });

  it("splitEvenly returns nothing for an empty participant list", () => {
    expect(splitEvenly(10, [])).toEqual({});
  });

  it("perMemberShare uses precomputed equal shares for the equal tab", () => {
    expect(
      perMemberShare({
        participantId: 2,
        tabValue: "equal",
        selectedParticipantIds: [1, 2],
        selectedEqualShares: { 1: 5, 2: 5 },
        splitValues: {},
        totalAmount: 10
      })
    ).toBe(5);
    // unknown participant falls back to 0
    expect(
      perMemberShare({
        participantId: 99,
        tabValue: "equal",
        selectedParticipantIds: [1, 2],
        selectedEqualShares: { 1: 5, 2: 5 },
        splitValues: {},
        totalAmount: 10
      })
    ).toBe(0);
  });

  it("perMemberShare returns 0 for unselected participants in exact/percentage", () => {
    const base = {
      participantId: 3,
      selectedParticipantIds: [1, 2],
      selectedEqualShares: {},
      splitValues: { 3: "5" },
      totalAmount: 10
    };
    expect(perMemberShare({ ...base, tabValue: "exact" })).toBe(0);
    expect(perMemberShare({ ...base, tabValue: "percentage" })).toBe(0);
  });

  it("builds percentage and adjusted_equal split payloads", () => {
    expect(
      buildSplitPayload({
        method: "percentage",
        selectedParticipantIds: [1, 2],
        splitValues: { 1: "60", 2: "40" }
      })
    ).toEqual({
      shares: [
        { participant_id: 1, percentage: "60" },
        { participant_id: 2, percentage: "40" }
      ]
    });

    expect(
      buildSplitPayload({
        method: "adjusted_equal",
        selectedParticipantIds: [1, 2],
        splitValues: { 1: "2,5" }
      })
    ).toEqual({
      participant_ids: [1, 2],
      adjustments: [{ participant_id: 1, amount: "2.5" }]
    });
  });

  describe("hydrateSplit", () => {
    it("equal_all hydrates to no overrides", () => {
      expect(hydrateSplit("equal_all", undefined)).toEqual({});
    });

    it("equal_selected hydrates the selected participant ids", () => {
      expect(hydrateSplit("equal_selected", { participant_ids: [1, 2] })).toEqual({
        selectedParticipantIds: [1, 2]
      });
      // empty / missing yields no override
      expect(hydrateSplit("equal_selected", {})).toEqual({});
    });

    it("exact hydrates selected ids and string amounts", () => {
      expect(
        hydrateSplit("exact", { shares: [{ participant_id: 1, amount: 4.5 }] })
      ).toEqual({
        selectedParticipantIds: [1],
        splitValues: { 1: "4.5" }
      });
    });

    it("percentage hydrates selected ids and string percentages", () => {
      expect(
        hydrateSplit("percentage", { shares: [{ participant_id: 2, percentage: 40 }] })
      ).toEqual({
        selectedParticipantIds: [2],
        splitValues: { 2: "40" }
      });
    });

    it("adjusted_equal hydrates adjustment amounts", () => {
      expect(
        hydrateSplit("adjusted_equal", { adjustments: [{ participant_id: 3, amount: 2 }] })
      ).toEqual({
        splitValues: { 3: "2" }
      });
    });
  });

  describe("applyPaymentsToForm", () => {
    function setters() {
      return {
        setMultiPayer: vi.fn(),
        setPaymentValues: vi.fn(),
        setPayerId: vi.fn()
      };
    }

    it("enables multi-payer mode for more than one payment", () => {
      const s = setters();
      applyPaymentsToForm(
        [
          { participant_id: 1, amount: "6" },
          { participant_id: 2, amount: "4" }
        ],
        s
      );
      expect(s.setMultiPayer).toHaveBeenCalledWith(true);
      expect(s.setPaymentValues).toHaveBeenCalledWith({ 1: "6", 2: "4" });
      expect(s.setPayerId).not.toHaveBeenCalled();
    });

    it("uses single-payer mode for one payment", () => {
      const s = setters();
      applyPaymentsToForm([{ participant_id: 7, amount: "10" }], s);
      expect(s.setMultiPayer).toHaveBeenCalledWith(false);
      expect(s.setPayerId).toHaveBeenCalledWith(7);
    });

    it("clears the payer when there are no payments", () => {
      const s = setters();
      applyPaymentsToForm(undefined, s);
      expect(s.setMultiPayer).toHaveBeenCalledWith(false);
      expect(s.setPayerId).toHaveBeenCalledWith(null);
    });
  });
});
