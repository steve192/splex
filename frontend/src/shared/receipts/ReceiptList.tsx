import { useState } from "react";
import { Alert, View } from "react-native";
import { ActivityIndicator, IconButton, List, Text, useTheme } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { apiWriteErrorMessage } from "../lib/apiErrors";
import type { Receipt } from "../types/models";
import { negativeColor } from "../ui/colors";
import { styles } from "../ui/styles";
import { deleteReceipt, openReceipt } from "./receiptService";

type ReceiptListProps = {
  receipts: Receipt[];
  /** When true, each row gets a delete button. */
  allowRemove?: boolean;
  /** Called after a successful delete so the parent can refresh. */
  onRemoved?: (receiptId: number) => void;
};

function iconFor(contentType: string): string {
  if (contentType === "application/pdf") return "file-pdf-box";
  return "image";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReceiptList({ receipts, allowRemove, onRemoved }: Readonly<ReceiptListProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const theme = useTheme();
  const [busyId, setBusyId] = useState<number | null>(null);

  if (!receipts.length) {
    return <Text variant="bodySmall">{t("receipts.empty")}</Text>;
  }

  async function handleOpen(receipt: Receipt) {
    setBusyId(receipt.id);
    try {
      await openReceipt(api, receipt);
    } catch {
      Alert.alert(t("receipts.openFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(receipt: Receipt) {
    setBusyId(receipt.id);
    try {
      await deleteReceipt(api, receipt.id);
      onRemoved?.(receipt.id);
    } catch (error) {
      Alert.alert(apiWriteErrorMessage(error, t));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View>
      {receipts.map((receipt) => (
        <List.Item
          key={receipt.id}
          title={receipt.original_filename}
          description={formatBytes(receipt.size_bytes)}
          left={(props) => <List.Icon {...props} icon={iconFor(receipt.content_type)} />}
          onPress={() => handleOpen(receipt)}
          right={() => {
            if (busyId === receipt.id) {
              return <ActivityIndicator style={styles.selfCenter} />;
            }
            if (allowRemove) {
              return (
                <IconButton
                  icon="close"
                  iconColor={negativeColor(theme)}
                  onPress={() => handleRemove(receipt)}
                  accessibilityLabel={t("receipts.remove")}
                />
              );
            }
            return <IconButton icon="download" onPress={() => handleOpen(receipt)} />;
          }}
        />
      ))}
    </View>
  );
}
