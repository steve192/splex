import { View } from "react-native";
import {
  Button,
  Card,
  List,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { usePendingAction } from "../lib/usePendingAction";
import { apiErrorDescriptorMessage } from "../lib/apiErrors";
import { PendingMutation } from "../sync/queue";
import { negativeColor } from "../ui/colors";
import { styles } from "../ui/styles";

type PendingExpenseListProps = {
  mutations: PendingMutation[];
  fallbackCurrency?: string;
  onOpen: (mutationId: string) => void;
  onRetry: () => Promise<void> | void;
  onDelete: (mutationId: string) => Promise<void> | void;
  mutationsDisabled?: boolean;
};

export function PendingExpenseList({
  mutations,
  fallbackCurrency,
  onOpen,
  onRetry,
  onDelete,
  mutationsDisabled = false,
}: Readonly<PendingExpenseListProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const dangerColor = negativeColor(theme);
  const { hasPending, isPending, runPendingAction } = usePendingAction();

  return (
    <>
      {mutations.map((mutation) => {
        const payload = mutation.payload as {
          expense?: {
            description?: string;
            amount?: string;
            currency?: string;
          };
        };
        const expense = payload?.expense ?? {};
        return (
          <Card
            key={`pending-${mutation.id}`}
            mode="elevated"
            style={styles.card}
          >
            <TouchableRipple
              style={styles.clickable}
              disabled={mutationsDisabled}
              onPress={
                mutationsDisabled ? undefined : () => onOpen(mutation.id)
              }
            >
              <Card.Content>
                <List.Item
                  style={styles.listTile}
                  title={expense.description || t("expense.add")}
                  description={`${t("expense.pendingSync")} - ${
                    mutation.lastError
                      ? apiErrorDescriptorMessage(mutation.lastError, t, { write: true })
                      : mutation.status
                  }`}
                  right={() => (
                    <View style={styles.listTileRight}>
                      <Text>{`${expense.amount ?? ""} ${expense.currency ?? fallbackCurrency ?? ""}`}</Text>
                      <View style={styles.rowActions}>
                        <Button
                          compact
                          mode="text"
                          loading={isPending("retry")}
                          disabled={hasPending || mutationsDisabled}
                          onPress={() => runPendingAction("retry", onRetry)}
                        >
                          {t("expense.retrySync")}
                        </Button>
                        <Button
                          compact
                          mode="text"
                          textColor={dangerColor}
                          loading={isPending(`delete:${mutation.id}`)}
                          disabled={hasPending}
                          onPress={() =>
                            runPendingAction(`delete:${mutation.id}`, () =>
                              onDelete(mutation.id),
                            )
                          }
                        >
                          {t("common.delete")}
                        </Button>
                      </View>
                    </View>
                  )}
                />
              </Card.Content>
            </TouchableRipple>
          </Card>
        );
      })}
    </>
  );
}
