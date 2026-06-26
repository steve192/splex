export type CalculatorOperator = "+" | "-" | "×" | "÷";

export type CalculatorState = {
  expression: string;
  justEvaluated: boolean;
};

export type CalculatorAction =
  | { type: "digit"; value: string }
  | { type: "decimal" }
  | { type: "operator"; value: CalculatorOperator }
  | { type: "percent" }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "evaluate" };

const OPERATORS = new Set<CalculatorOperator>(["+", "-", "×", "÷"]);
const MAX_DECIMAL_DIGITS = 10;

function isOperator(value: string | undefined): value is CalculatorOperator {
  return value !== undefined && OPERATORS.has(value as CalculatorOperator);
}

function isNumberTail(expression: string): boolean {
  return /(?:^|[+\-×÷])\d*\.?\d+$/.test(expression);
}

function numberTailHasDecimal(expression: string): boolean {
  const tail = expression.split(/[+\-×÷]/).at(-1) ?? "";
  return tail.includes(".");
}

function normalizeInitialValue(value: string): string {
  const normalized = value.trim().replace(",", ".");
  return /^-?\d*\.?\d+$/.test(normalized) ? normalized : "";
}

export function calculatorInitialState(value: string): CalculatorState {
  return { expression: normalizeInitialValue(value), justEvaluated: false };
}

/** Maps physical keyboard and numpad keys onto the calculator's button API. */
export function calculatorKeyboardAction(key: string): CalculatorAction | null {
  if (/^\d$/.test(key)) return { type: "digit", value: key };
  if (key === "." || key === ",") return { type: "decimal" };
  if (key === "+") return { type: "operator", value: "+" };
  if (key === "-") return { type: "operator", value: "-" };
  if (key === "*" || key === "x" || key === "X") return { type: "operator", value: "×" };
  if (key === "/") return { type: "operator", value: "÷" };
  if (key === "%") return { type: "percent" };
  if (key === "Enter" || key === "=") return { type: "evaluate" };
  if (key === "Backspace") return { type: "backspace" };
  if (key === "Delete") return { type: "clear" };
  return null;
}

export function formatCalculatorResult(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toFixed(MAX_DECIMAL_DIGITS));
  return String(rounded);
}

/**
 * Evaluates calculator-owned input. The parser intentionally accepts only the
 * button vocabulary, keeping evaluation deterministic and free of `eval`.
 */
export function calculatorPreview(expression: string): number | null {
  if (!expression || isOperator(expression.at(-1))) return null;
  const normalizedExpression = expression.startsWith("-") ? `0${expression}` : expression;
  const tokens = normalizedExpression.match(/\d*\.?\d+%?|[+\-×÷]/g);
  if (!tokens || tokens.join("") !== normalizedExpression) return null;

  const values: number[] = [];
  const operators: CalculatorOperator[] = [];
  let expectValue = true;

  function applyTopOperator(): boolean {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (operator === undefined || left === undefined || right === undefined) return false;
    if (operator === "+") values.push(left + right);
    if (operator === "-") values.push(left - right);
    if (operator === "×") values.push(left * right);
    if (operator === "÷") {
      if (right === 0) return false;
      values.push(left / right);
    }
    return true;
  }

  function precedence(operator: CalculatorOperator): number {
    return operator === "×" || operator === "÷" ? 2 : 1;
  }

  for (const token of tokens) {
    if (isOperator(token)) {
      if (expectValue) return null;
      while (operators.length && precedence(operators.at(-1)!) >= precedence(token)) {
        if (!applyTopOperator()) return null;
      }
      operators.push(token);
      expectValue = true;
      continue;
    }

    if (!expectValue) return null;
    const isPercent = token.endsWith("%");
    const value = Number(isPercent ? token.slice(0, -1) : token);
    if (!Number.isFinite(value)) return null;
    values.push(isPercent ? value / 100 : value);
    expectValue = false;
  }

  while (operators.length) {
    if (!applyTopOperator()) return null;
  }
  return values.length === 1 && Number.isFinite(values[0]) ? values[0] : null;
}

export function calculatorReduce(state: CalculatorState, action: CalculatorAction): CalculatorState {
  const { expression } = state;
  if (action.type === "clear") return { expression: "", justEvaluated: false };
  if (action.type === "backspace") {
    return { expression: expression.slice(0, -1), justEvaluated: false };
  }
  if (action.type === "evaluate") {
    const result = calculatorPreview(expression);
    return result === null
      ? state
      : { expression: formatCalculatorResult(result), justEvaluated: true };
  }
  if (action.type === "digit") {
    const nextExpression = state.justEvaluated || expression === "0" ? action.value : `${expression}${action.value}`;
    return { expression: nextExpression, justEvaluated: false };
  }
  if (action.type === "decimal") {
    if (state.justEvaluated) return { expression: "0.", justEvaluated: false };
    if (!expression || isOperator(expression.at(-1))) return { expression: `${expression}0.`, justEvaluated: false };
    return numberTailHasDecimal(expression) || expression.endsWith("%")
      ? state
      : { expression: `${expression}.`, justEvaluated: false };
  }
  if (action.type === "percent") {
    return isNumberTail(expression) ? { expression: `${expression}%`, justEvaluated: false } : state;
  }

  if (!expression) {
    return action.value === "-" ? { expression: "-", justEvaluated: false } : state;
  }
  if (isOperator(expression.at(-1))) {
    return { expression: `${expression.slice(0, -1)}${action.value}`, justEvaluated: false };
  }
  return { expression: `${expression}${action.value}`, justEvaluated: false };
}
