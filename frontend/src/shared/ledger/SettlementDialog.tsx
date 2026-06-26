import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import {
  Button,
  Dialog,
  List,
  Text,
  useTheme,
} from "react-native-paper";

import { KeyboardAvoidingDialog } from "../ui/KeyboardAvoidingDialog";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { payUrlWithAmount } from "../lib/paypal";
import { PaymentMethod } from "../types/models";
import { ClickableAvatar } from "../ui/ClickableAvatar";
import { CurrencySelectionSheet } from "../ui/CurrencySelectionSheet";
import { MoneyAmountInput } from "../ui/MoneyAmountInput";
import { styles } from "../ui/styles";

export type SettlementDialogTarget = {
  payer_participant_id: number;
  payer_display_name: string;
  payer_avatar_url?: string;
  receiver_participant_id: number;
  receiver_display_name: string;
  receiver_avatar_url?: string;
  amount: string;
  currency: string;
};

type SettlementDialogProps = {
  visible: boolean;
  target: SettlementDialogTarget | null;
  amount: string;
  currency: string;
  onAmountChange: (amount: string) => void;
  onCurrencyChange: (currency: string) => void;
  onDismiss: () => void;
  onSave: () => void;
  saving?: boolean;
};

export function SettlementDialog({
  visible,
  target,
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  onDismiss,
  onSave,
  saving = false,
}: Readonly<SettlementDialogProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [preferredMethod, setPreferredMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [copiedHint, setCopiedHint] = useState(false);

  useEffect(() => {
    if (!visible) setCurrencySheetOpen(false);
  }, [visible]);

  // Fetch the receiver's preferred payment method whenever the dialog opens
  // on a new target.  The endpoint returns 204 when there's nothing to show
  // (unregistered receiver, no preferred method, or no shared context); we
  // surface that as ``null`` so the UI just hides the section.
  useEffect(() => {
    if (!visible || !target) {
      setPreferredMethod(null);
      return;
    }
    let cancelled = false;
    api
      .get<PaymentMethod | null>(
        `/api/participants/${target.receiver_participant_id}/preferred-payment-method/`,
      )
      .then((value) => {
        if (!cancelled) setPreferredMethod(value ?? null);
      })
      .catch(() => {
        if (!cancelled) setPreferredMethod(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api, visible, target]);

  useEffect(() => {
    if (!copiedHint) return;
    const timeout = setTimeout(() => setCopiedHint(false), 2500);
    return () => clearTimeout(timeout);
  }, [copiedHint]);

  async function openPaypal() {
    if (!preferredMethod) return;
    const url = payUrlWithAmount(preferredMethod, amount, currency);
    try {
      await Linking.openURL(url);
    } catch {
      // Best-effort: openURL throws on web when the URL scheme isn't allowed,
      // but our targets are https:// so this rarely fires.  Fall through.
    }
  }

  async function copyEmail() {
    if (!preferredMethod) return;
    await Clipboard.setStringAsync(preferredMethod.display);
    setCopiedHint(true);
  }

  return (
    <>
      <KeyboardAvoidingDialog
        visible={visible}
        onDismiss={saving ? () => undefined : onDismiss}
      >
        <Dialog.Title>{t("settlement.title")}</Dialog.Title>
        <Dialog.Content>
          {target ? (
            <View style={styles.settlementPreview}>
              <View style={styles.settlementPerson}>
                <ClickableAvatar
                  name={target.payer_display_name}
                  imageUrl={target.payer_avatar_url}
                />
                <Text variant="bodyMedium">{target.payer_display_name}</Text>
              </View>
              <List.Icon icon="arrow-right" />
              <View style={styles.settlementPerson}>
                <ClickableAvatar
                  name={target.receiver_display_name}
                  imageUrl={target.receiver_avatar_url}
                />
                <Text variant="bodyMedium">{target.receiver_display_name}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.formRow}>
            <MoneyAmountInput
              mode="outlined"
              label={t("expense.amount")}
              value={amount}
              onChangeText={onAmountChange}
              style={styles.flex}
            />
            <Button
              mode="elevated"
              onPress={() => setCurrencySheetOpen(true)}
              style={styles.selfCenter}
            >
              {currency}
            </Button>
          </View>
          {preferredMethod && target ? (
            <PaypalSection
              method={preferredMethod}
              receiverName={target.receiver_display_name}
              onOpen={openPaypal}
              onCopy={copyEmail}
              copiedHint={copiedHint}
            />
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button disabled={saving} onPress={onDismiss}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={saving}
            disabled={saving || !amount || !target}
            onPress={onSave}
          >
            {t("settlement.save")}
          </Button>
        </Dialog.Actions>
      </KeyboardAvoidingDialog>
      <CurrencySelectionSheet
        visible={visible && currencySheetOpen}
        title={t("expense.currency")}
        value={currency}
        onSelect={onCurrencyChange}
        onDismiss={() => setCurrencySheetOpen(false)}
      />
    </>
  );
}

type PaypalSectionProps = {
  method: PaymentMethod;
  receiverName: string;
  onOpen: () => void;
  onCopy: () => void;
  copiedHint: boolean;
};

/** Flat (non-Card) PayPal block for the settle dialog.
 *
 * Visual layout: a small label, the identifier shown prominently, the
 * primary "Open" action with the identifier baked into the label, and an
 * inline copy affordance for the email case where the URL cannot pre-fill
 * the recipient.  No leading icon - MaterialCommunityIcons (our default
 * icon set) doesn't ship a PayPal glyph, and a placeholder "?" looks
 * worse than no icon at all.
 */
function PaypalSection({
  method,
  receiverName,
  onOpen,
  onCopy,
  copiedHint,
}: Readonly<PaypalSectionProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const surface = {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
    gap: 10,
    marginTop: 16,
    padding: 12,
  } as const;
  return (
    <View style={surface}>
      <Text variant="labelMedium" style={muted}>
        {t("settlement.paypalSectionLabel", { person: receiverName })}
      </Text>
      <Text variant="titleSmall" selectable>
        {method.display}
      </Text>
      {method.pre_fills_recipient ? (
        <Button mode="contained" icon="open-in-new" onPress={onOpen}>
          {t("settlement.openPaypal")}
        </Button>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            mode="contained-tonal"
            icon="content-copy"
            onPress={onCopy}
            style={styles.flex}
          >
            {t("settlement.copyEmail")}
          </Button>
          <Button
            mode="contained"
            icon="open-in-new"
            onPress={onOpen}
            style={styles.flex}
          >
            {t("settlement.openPaypal")}
          </Button>
        </View>
      )}
      {copiedHint ? (
        <Text variant="bodySmall" style={muted}>
          {t("settlement.emailCopied")}
        </Text>
      ) : null}
      <Text variant="bodySmall" style={muted}>
        {t("settlement.paypalDisclaimer")}
      </Text>
    </View>
  );
}
