import { ComponentProps, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, useWindowDimensions, View } from "react-native";
import { Button, MD3Theme, Modal, Portal, Text, TextInput, TouchableRipple, useTheme } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { useKeyboardHeight } from "../lib/useKeyboardHeight";
import { calculatorKeySize, isCalculatorFullscreen } from "./calculatorLayout";
import { shouldRestoreKeyboard } from "./keyboardRestorePolicy";
import { styles } from "./styles";
import {
  CalculatorAction,
  CalculatorOperator,
  CalculatorState,
  calculatorInitialState,
  calculatorKeyboardAction,
  calculatorPreview,
  calculatorReduce,
  formatCalculatorResult
} from "./calculatorModel";

type MoneyAmountInputProps = Omit<ComponentProps<typeof TextInput>, "keyboardType" | "right" | "inputMode">;
type MoneyAmountInputRef = { focus?: () => void; isFocused?: () => boolean };

function isMoneyAmountInputRef(value: unknown): value is MoneyAmountInputRef {
  return typeof value === "object" && value !== null && "focus" in value && "isFocused" in value;
}

export function MoneyAmountInput({ value = "", ...props }: Readonly<MoneyAmountInputProps>) {
  const { t } = useI18n();
  const keyboardHeight = useKeyboardHeight();
  const inputRef = useRef<MoneyAmountInputRef | null>(null);
  const restoreKeyboardRef = useRef(false);
  const [calculatorVisible, setCalculatorVisible] = useState(false);
  const setInputRef = (instance: unknown) => {
    inputRef.current = isMoneyAmountInputRef(instance) ? instance : null;
  };

  function openCalculator() {
    restoreKeyboardRef.current = shouldRestoreKeyboard(keyboardHeight);
    Keyboard.dismiss();
    setCalculatorVisible(true);
  }

  function closeCalculator() {
    setCalculatorVisible(false);
    if (!restoreKeyboardRef.current) return;
    restoreKeyboardRef.current = false;
    requestAnimationFrame(() => inputRef.current?.focus?.());
  }

  return (
    <>
      <TextInput
        {...props}
        ref={setInputRef}
        value={value}
        keyboardType="decimal-pad"
        inputMode="decimal"
        right={
          <TextInput.Icon
            icon="calculator-variant-outline"
            accessibilityLabel={t("calculator.open")}
            onPress={openCalculator}
          />
        }
      />
      <CalculatorDialog
        visible={calculatorVisible}
        initialValue={value}
        onDismiss={closeCalculator}
        onApply={(result) => {
          props.onChangeText?.(result);
          closeCalculator();
        }}
      />
    </>
  );
}

type CalculatorDialogProps = {
  visible: boolean;
  initialValue: string;
  onDismiss: () => void;
  onApply: (result: string) => void;
};

function CalculatorDialog({ visible, initialValue, onDismiss, onApply }: Readonly<CalculatorDialogProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const { height, width } = useWindowDimensions();
  const [state, setState] = useState<CalculatorState>(() => calculatorInitialState(initialValue));
  const fullScreen = isCalculatorFullscreen(width);
  const keySize = calculatorKeySize(width, height, fullScreen);
  const preview = calculatorPreview(state.expression);

  useEffect(() => {
    if (visible) setState(calculatorInitialState(initialValue));
  }, [visible, initialValue]);

  function dispatch(action: CalculatorAction) {
    setState((current) => calculatorReduce(current, action));
  }

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = calculatorKeyboardAction(event.key);
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible]);

  function apply() {
    if (preview === null) return;
    onApply(formatCalculatorResult(preview));
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          fullScreen ? styles.calculatorFullscreen : styles.calculatorPopup,
          { backgroundColor: theme.colors.surface }
        ]}
        style={fullScreen ? styles.calculatorFullscreenWrapper : styles.calculatorPopupWrapper}
      >
        <View style={styles.calculatorHeader}>
          <Text variant="titleLarge">{t("calculator.title")}</Text>
          <Button onPress={onDismiss}>{t("common.cancel")}</Button>
        </View>
        <View
          accessible
          accessibilityLabel={t("calculator.preview")}
          style={[
            styles.calculatorDisplay,
            fullScreen ? styles.calculatorDisplayFullscreen : undefined,
            { backgroundColor: theme.colors.surfaceVariant }
          ]}
        >
          <Text numberOfLines={1} variant={fullScreen ? "displaySmall" : "headlineMedium"} style={styles.calculatorExpression}>
            {state.expression || "0"}
          </Text>
          <Text
            numberOfLines={1}
            variant={fullScreen ? "headlineLarge" : "titleLarge"}
            style={[styles.calculatorResult, { color: theme.colors.onSurfaceVariant }]}
          >
            {preview === null ? "—" : formatCalculatorResult(preview)}
          </Text>
        </View>
        <CalculatorKeypad dispatch={dispatch} keySize={keySize} />
        <Button mode="contained" disabled={preview === null} onPress={apply} style={styles.calculatorApply}>
          {t("calculator.apply")}
        </Button>
      </Modal>
    </Portal>
  );
}

function CalculatorKeypad({
  dispatch,
  keySize
}: Readonly<{ dispatch: (action: CalculatorAction) => void; keySize: number }>) {
  const { t } = useI18n();
  const rows: Array<Array<CalculatorKeyDefinition | null>> = [
    [
      { label: "C", action: { type: "clear" }, accessibilityLabel: t("calculator.clear"), tone: "operation" },
      { label: "%", action: { type: "percent" }, accessibilityLabel: t("calculator.percent"), tone: "operation" },
      { label: "⌫", action: { type: "backspace" }, accessibilityLabel: t("calculator.backspace"), tone: "operation" },
      { label: "÷", action: { type: "operator", value: "÷" }, accessibilityLabel: t("calculator.divide"), tone: "operation" }
    ],
    ["7", "8", "9"].map(digitKey).concat(operatorKey("×", t("calculator.multiply"))),
    ["4", "5", "6"].map(digitKey).concat(operatorKey("-", t("calculator.subtract"))),
    ["1", "2", "3"].map(digitKey).concat(operatorKey("+", t("calculator.add"))),
    [
      { label: "0", action: { type: "digit", value: "0" } },
      { label: ".", action: { type: "decimal" }, accessibilityLabel: t("calculator.decimal") },
      { label: "=", action: { type: "evaluate" }, accessibilityLabel: t("calculator.equals"), tone: "equals" },
      null
    ]
  ];

  return (
    <View style={styles.calculatorKeypad}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.calculatorKeyRow}>
          {row.map((key, keyIndex) =>
            key ? (
              <CalculatorKey
                key={key.label}
                keyDefinition={key}
                size={keySize}
                onPress={() => dispatch(key.action)}
              />
            ) : (
              <View key={`placeholder-${keyIndex}`} style={[styles.calculatorKeyPlaceholder, { height: keySize, width: keySize }]} />
            )
          )}
        </View>
      ))}
    </View>
  );
}

type CalculatorKeyProps = {
  keyDefinition: CalculatorKeyDefinition;
  size: number;
  onPress: () => void;
};

type CalculatorKeyTone = "operation" | "equals";

type CalculatorKeyDefinition = {
  label: string;
  action: CalculatorAction;
  accessibilityLabel?: string;
  tone?: CalculatorKeyTone;
};

function CalculatorKey({ keyDefinition, size, onPress }: Readonly<CalculatorKeyProps>) {
  const theme = useTheme();
  const colors = calculatorKeyColors(theme, keyDefinition.tone);
  return (
    <TouchableRipple
      accessibilityLabel={keyDefinition.accessibilityLabel ?? keyDefinition.label}
      accessibilityRole="button"
      borderless={false}
      onPress={onPress}
      style={[
        styles.calculatorKey,
        { backgroundColor: colors.background, height: size, width: size }
      ]}
    >
      <Text variant="titleLarge" style={[styles.calculatorKeyLabel, { color: colors.text }]}>
        {keyDefinition.label}
      </Text>
    </TouchableRipple>
  );
}

function calculatorKeyColors(theme: MD3Theme, tone: CalculatorKeyTone | undefined) {
  if (tone === "equals") return { background: theme.colors.primary, text: theme.colors.onPrimary };
  if (tone === "operation") {
    return { background: theme.colors.secondaryContainer, text: theme.colors.onSecondaryContainer };
  }
  return { background: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant };
}

function digitKey(value: string): { label: string; action: CalculatorAction } {
  return { label: value, action: { type: "digit", value } };
}

function operatorKey(
  value: CalculatorOperator,
  accessibilityLabel: string
): CalculatorKeyDefinition {
  return { label: value, action: { type: "operator", value }, accessibilityLabel, tone: "operation" };
}
