import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Button,
  Card,
  Dialog,
  HelperText,
  IconButton,
  List,
  Portal,
  RadioButton,
  Text,
  TextInput,
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useSnackbar } from "../../shared/feedback/SnackbarContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import {
  apiErrorMessage,
  apiWriteErrorMessage,
} from "../../shared/lib/apiErrors";
import { usePendingAction } from "../../shared/lib/usePendingAction";
import { PaymentMethod } from "../../shared/types/models";
import { KeyboardAvoidingDialog } from "../../shared/ui/KeyboardAvoidingDialog";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type AddState = {
  visible: boolean;
  input: string;
  busy: boolean;
  error: string;
};

const EMPTY_ADD_STATE: AddState = {
  visible: false,
  input: "",
  busy: false,
  error: "",
};

export function PaymentMethodsScreen() {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { hasPending, isPending, runPendingAction } = usePendingAction();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [add, setAdd] = useState<AddState>(EMPTY_ADD_STATE);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.get<PaymentMethod[]>("/api/me/payment-methods/");
      setMethods(rows);
    } catch (error) {
      showSnackbar(apiErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  }, [api, showSnackbar, t]);

  useFocusEffect(
    useCallback(() => {
      reload().catch(() => undefined);
    }, [reload]),
  );

  async function setPreferred(method: PaymentMethod) {
    if (method.is_preferred) return;
    await runPendingAction(`preferred:${method.id}`, async () => {
      try {
        await api.patch(`/api/me/payment-methods/${method.id}/`, {
          is_preferred: true,
        });
        await reload();
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
      }
    });
  }

  async function remove(method: PaymentMethod) {
    await runPendingAction(`remove:${method.id}`, async () => {
      try {
        await api.delete(`/api/me/payment-methods/${method.id}/`);
        await reload();
        showSnackbar(t("paymentMethods.removed"));
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
      }
    });
  }

  async function submitNew() {
    if (!add.input.trim() || add.busy) return;
    setAdd((prev) => ({ ...prev, busy: true, error: "" }));
    try {
      await api.post("/api/me/payment-methods/", { paypal: add.input.trim() });
      setAdd(EMPTY_ADD_STATE);
      await reload();
      showSnackbar(t("paymentMethods.added"));
    } catch (error) {
      setAdd((prev) => ({
        ...prev,
        busy: false,
        error: apiWriteErrorMessage(error, t),
      }));
    }
  }

  return (
    <Screen>
      <Text variant="headlineSmall">{t("paymentMethods.title")}</Text>
      <Text variant="bodyMedium">{t("paymentMethods.intro")}</Text>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          {methods.length === 0 ? (
            <Text variant="bodyMedium">
              {loading
                ? t("paymentMethods.loading")
                : t("paymentMethods.empty")}
            </Text>
          ) : (
            <RadioButton.Group
              value={methods.find((m) => m.is_preferred)?.id?.toString() ?? ""}
              onValueChange={(value) => {
                const target = methods.find((m) => m.id.toString() === value);
                if (target) setPreferred(target);
              }}
            >
              {methods.map((method) => (
                <View key={method.id} style={styles.rowBetween}>
                  <RadioButton.Item
                    label={method.display}
                    value={method.id.toString()}
                    position="leading"
                    style={styles.flex}
                    disabled={hasPending}
                  />
                  <IconButton
                    icon="trash-can-outline"
                    onPress={() => remove(method)}
                    loading={isPending(`remove:${method.id}`)}
                    disabled={hasPending}
                    accessibilityLabel={t("paymentMethods.removeLabel")}
                  />
                </View>
              ))}
            </RadioButton.Group>
          )}
          <Button
            mode="contained"
            icon="plus"
            onPress={() => setAdd({ ...EMPTY_ADD_STATE, visible: true })}
            disabled={hasPending}
          >
            {t("paymentMethods.addPaypal")}
          </Button>
        </Card.Content>
      </Card>
      <HelperText type="info">{t("paymentMethods.preferredHint")}</HelperText>
      <Portal>
        <KeyboardAvoidingDialog
          visible={add.visible}
          onDismiss={() => setAdd(EMPTY_ADD_STATE)}
        >
          <Dialog.Title>{t("paymentMethods.addPaypal")}</Dialog.Title>
          <Dialog.Content style={styles.gap}>
            <Text variant="bodyMedium">
              {t("paymentMethods.addPaypalHelp")}
            </Text>
            <List.Item
              left={(props) => <List.Icon {...props} icon="link-variant" />}
              title={t("paymentMethods.formatHandle")}
              description="paypal.me/your-name"
            />
            <List.Item
              left={(props) => <List.Icon {...props} icon="at" />}
              title={t("paymentMethods.formatEmail")}
              description="you@example.com"
            />
            <TextInput
              mode="outlined"
              label={t("paymentMethods.inputLabel")}
              value={add.input}
              onChangeText={(value) =>
                setAdd((prev) => ({ ...prev, input: value, error: "" }))
              }
              autoCapitalize="none"
              autoCorrect={false}
              disabled={add.busy}
            />
            {add.error ? (
              <HelperText type="error">{add.error}</HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAdd(EMPTY_ADD_STATE)} disabled={add.busy}>
              {t("common.cancel")}
            </Button>
            <Button
              mode="contained"
              onPress={submitNew}
              loading={add.busy}
              disabled={add.busy || !add.input.trim()}
            >
              {t("common.save")}
            </Button>
          </Dialog.Actions>
        </KeyboardAvoidingDialog>
      </Portal>
    </Screen>
  );
}
