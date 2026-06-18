import { useNetInfo } from "@react-native-community/netinfo";
import { useState } from "react";
import { Alert } from "react-native";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { pickReceipt, uploadReceipt } from "../../shared/receipts/receiptService";
import { ContextType, Receipt } from "../../shared/types/models";

type Options = {
  expenseId?: number;
  pendingMutationId?: string;
  contextType: ContextType;
  contextId: number | null;
  draftClientId: string;
  /** Called when a receipt is picked before any context/expense exists to attach it to. */
  onMissingContext: () => void;
};

/**
 * Receipt list state and upload handling for the expense form. Receipts need a
 * live connection: a draft upload talks to the backend immediately, and a
 * pending-sync mutation has no server-side expense to attach against yet.
 */
export function useReceiptUpload({
  expenseId,
  pendingMutationId,
  contextType,
  contextId,
  draftClientId,
  onMissingContext
}: Options) {
  const { api } = useAuth();
  const { t } = useI18n();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [uploading, setUploading] = useState(false);

  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false && netInfo.isInternetReachable !== false;
  const canUpload = isOnline && !pendingMutationId;

  async function add() {
    if (uploading) return;
    const asset = await pickReceipt();
    if (!asset) return;
    if (!expenseId && !contextId) {
      onMissingContext();
      return;
    }
    setUploading(true);
    try {
      const ctx = expenseId
        ? { expenseId }
        : {
            clientId: draftClientId,
            groupId: contextType === "group" ? contextId ?? undefined : undefined,
            friendshipId: contextType === "friendship" ? contextId ?? undefined : undefined
          };
      const uploaded = await uploadReceipt(api, asset, ctx);
      setReceipts((current) => [...current, uploaded]);
    } catch (error) {
      Alert.alert(error instanceof Error ? error.message : t("receipts.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function remove(receiptId: number) {
    setReceipts((current) => current.filter((receipt) => receipt.id !== receiptId));
  }

  return { receipts, setReceipts, uploading, canUpload, add, remove };
}
