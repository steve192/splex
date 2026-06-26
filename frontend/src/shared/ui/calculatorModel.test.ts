import { describe, expect, it } from "vitest";

import {
  calculatorInitialState,
  calculatorKeyboardAction,
  calculatorPreview,
  calculatorReduce,
  formatCalculatorResult
} from "./calculatorModel";

describe("calculatorPreview", () => {
  it("evaluates basic operations with multiplication and division precedence", () => {
    expect(calculatorPreview("2+3×4÷2-1")).toBe(7);
  });

  it("treats percent as a postfix hundredth", () => {
    expect(calculatorPreview("120×15%")).toBe(18);
  });

  it("evaluates negative initial operands", () => {
    expect(calculatorPreview("-5+2")).toBe(-3);
  });

  it("rejects incomplete and invalid calculations", () => {
    expect(calculatorPreview("12÷0")).toBeNull();
    expect(calculatorPreview("12+")).toBeNull();
  });
});

describe("calculatorReduce", () => {
  it("continues from the saved result after equals", () => {
    let state = calculatorInitialState("2");
    state = calculatorReduce(state, { type: "operator", value: "+" });
    state = calculatorReduce(state, { type: "digit", value: "3" });
    state = calculatorReduce(state, { type: "evaluate" });
    state = calculatorReduce(state, { type: "operator", value: "×" });
    state = calculatorReduce(state, { type: "digit", value: "4" });

    expect(state.expression).toBe("5×4");
    expect(calculatorPreview(state.expression)).toBe(20);
  });

  it("keeps only one decimal separator per number", () => {
    let state = calculatorInitialState("");
    state = calculatorReduce(state, { type: "decimal" });
    state = calculatorReduce(state, { type: "digit", value: "5" });
    state = calculatorReduce(state, { type: "decimal" });

    expect(state.expression).toBe("0.5");
  });

  it("preserves a negative initial field value", () => {
    expect(calculatorInitialState("-12,5").expression).toBe("-12.5");
  });

  it("formats floating point results for money input", () => {
    expect(formatCalculatorResult(0.1 + 0.2)).toBe("0.3");
  });
});

describe("calculatorKeyboardAction", () => {
  it("maps numpad-compatible keys to calculator actions", () => {
    expect(calculatorKeyboardAction("7")).toEqual({ type: "digit", value: "7" });
    expect(calculatorKeyboardAction("/")).toEqual({ type: "operator", value: "÷" });
    expect(calculatorKeyboardAction(",")).toEqual({ type: "decimal" });
    expect(calculatorKeyboardAction("Enter")).toEqual({ type: "evaluate" });
  });
});
