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
const OPERATOR_PRECEDENCE: Record<CalculatorOperator, number> = {
  "+": 1,
  "-": 1,
  "×": 2,
  "÷": 2,
};

function isOperator(value: string | undefined): value is CalculatorOperator {
  return value !== undefined && OPERATORS.has(value as CalculatorOperator);
}

function isDigit(value: string): boolean {
  return value.length === 1 && value >= "0" && value <= "9";
}

function isDecimalLiteral(value: string, allowLeadingMinus = false): boolean {
  if (!value) return false;
  const unsigned = allowLeadingMinus && value.startsWith("-") ? value.slice(1) : value;
  if (!unsigned || unsigned === ".") return false;

  let decimalSeen = false;
  let digitSeen = false;
  for (const character of unsigned) {
    if (character === ".") {
      if (decimalSeen) return false;
      decimalSeen = true;
      continue;
    }
    if (!isDigit(character)) return false;
    digitSeen = true;
  }
  return digitSeen;
}

function numberTail(expression: string): string {
  const lastOperatorIndex = Math.max(
    expression.lastIndexOf("+"),
    expression.lastIndexOf("-"),
    expression.lastIndexOf("×"),
    expression.lastIndexOf("÷"),
  );
  return expression.slice(lastOperatorIndex + 1);
}

function isNumberTail(expression: string): boolean {
  return isDecimalLiteral(numberTail(expression));
}

function numberTailHasDecimal(expression: string): boolean {
  return numberTail(expression).includes(".");
}

function normalizeInitialValue(value: string): string {
  const normalized = value.trim().replace(",", ".");
  return isDecimalLiteral(normalized, true) ? normalized : "";
}

export function calculatorInitialState(value: string): CalculatorState {
  return { expression: normalizeInitialValue(value), justEvaluated: false };
}

/** Maps physical keyboard and numpad keys onto the calculator's button API. */
export function calculatorKeyboardAction(key: string): CalculatorAction | null {
  if (isDigit(key)) return { type: "digit", value: key };
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

type CalculatorToken =
  | { type: "operator"; value: CalculatorOperator }
  | { type: "value"; value: number };

function parseCalculatorToken(token: string): CalculatorToken | null {
  if (isOperator(token)) return { type: "operator", value: token };

  const rawValue = token.endsWith("%") ? token.slice(0, -1) : token;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null;

  return {
    type: "value",
    value: token.endsWith("%") ? value / 100 : value,
  };
}

function tokenizeExpression(expression: string): CalculatorToken[] | null {
  const normalizedExpression = expression.startsWith("-")
    ? `0${expression}`
    : expression;
  const rawTokens = normalizedExpression.match(/\d*\.?\d+%?|[+\-×÷]/g);
  if (rawTokens?.join("") !== normalizedExpression) return null;

  const tokens: CalculatorToken[] = [];
  for (const token of rawTokens) {
    const parsed = parseCalculatorToken(token);
    if (!parsed) return null;
    tokens.push(parsed);
  }
  return tokens;
}

function calculateBinary(
  left: number,
  right: number,
  operator: CalculatorOperator,
): number | null {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "×") return left * right;
  if (right === 0) return null;
  return left / right;
}

function applyTopOperator(
  values: number[],
  operators: CalculatorOperator[],
): boolean {
  const operator = operators.pop();
  const right = values.pop();
  const left = values.pop();
  if (operator === undefined || left === undefined || right === undefined) {
    return false;
  }

  const result = calculateBinary(left, right, operator);
  if (result === null) return false;
  values.push(result);
  return true;
}

/**
 * Evaluates calculator-owned input. The parser intentionally accepts only the
 * button vocabulary, keeping evaluation deterministic and free of `eval`.
 */
export function calculatorPreview(expression: string): number | null {
  if (!expression || isOperator(expression.at(-1))) return null;
  const tokens = tokenizeExpression(expression);
  if (!tokens) return null;

  const values: number[] = [];
  const operators: CalculatorOperator[] = [];
  let expectValue = true;

  for (const token of tokens) {
    if (token.type === "operator") {
      if (expectValue) return null;
      while (
        operators.length &&
        OPERATOR_PRECEDENCE[operators.at(-1)!] >=
          OPERATOR_PRECEDENCE[token.value]
      ) {
        if (!applyTopOperator(values, operators)) return null;
      }
      operators.push(token.value);
      expectValue = true;
      continue;
    }

    if (!expectValue) return null;
    values.push(token.value);
    expectValue = false;
  }

  while (operators.length) {
    if (!applyTopOperator(values, operators)) return null;
  }
  return values.length === 1 && Number.isFinite(values[0]) ? values[0] : null;
}

type CalculatorActionHandler<T extends CalculatorAction = CalculatorAction> = (
  state: CalculatorState,
  action: T,
) => CalculatorState;

const calculatorActionHandlers: {
  [Type in CalculatorAction["type"]]: CalculatorActionHandler<
    Extract<CalculatorAction, { type: Type }>
  >;
} = {
  clear: () => ({ expression: "", justEvaluated: false }),
  backspace: (state) => ({
    expression: state.expression.slice(0, -1),
    justEvaluated: false,
  }),
  evaluate: (state) => {
    const result = calculatorPreview(state.expression);
    return result === null
      ? state
      : { expression: formatCalculatorResult(result), justEvaluated: true };
  },
  digit: (state, action) => {
    const nextExpression =
      state.justEvaluated || state.expression === "0"
        ? action.value
        : `${state.expression}${action.value}`;
    return { expression: nextExpression, justEvaluated: false };
  },
  decimal: (state) => {
    if (state.justEvaluated) return { expression: "0.", justEvaluated: false };
    if (!state.expression || isOperator(state.expression.at(-1))) {
      return { expression: `${state.expression}0.`, justEvaluated: false };
    }
    if (
      numberTailHasDecimal(state.expression) ||
      state.expression.endsWith("%")
    ) {
      return state;
    }
    return { expression: `${state.expression}.`, justEvaluated: false };
  },
  percent: (state) =>
    isNumberTail(state.expression)
      ? { expression: `${state.expression}%`, justEvaluated: false }
      : state,
  operator: (state, action) => {
    if (!state.expression) {
      return action.value === "-"
        ? { expression: "-", justEvaluated: false }
        : state;
    }
    if (isOperator(state.expression.at(-1))) {
      return {
        expression: `${state.expression.slice(0, -1)}${action.value}`,
        justEvaluated: false,
      };
    }
    return {
      expression: `${state.expression}${action.value}`,
      justEvaluated: false,
    };
  },
};

export function calculatorReduce(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  return calculatorActionHandlers[action.type](state, action as never);
}
