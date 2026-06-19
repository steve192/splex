import { View } from "react-native";
import { ActivityIndicator, Card, HelperText, IconButton, Text } from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { ReceiptList } from "../../shared/receipts/ReceiptList";
import { Receipt } from "../../shared/types/models";
import { styles } from "../../shared/ui/styles";

type ReceiptsCardProps = {
  receipts: Receipt[];
  canUpload: boolean;
  uploading: boolean;
  onAdd: () => void;
  onRemove: (id: number) => void;
  disabled?: boolean;
};

/** Receipt attachments section of the expense form. Hidden when there is
 * nothing to show and nothing can be uploaded (e.g. offline). */
export function ReceiptsCard({
  receipts,
  canUpload,
  uploading,
  onAdd,
  onRemove,
  disabled = false,
}: Readonly<ReceiptsCardProps>) {
  const { t } = useI18n();
  if (!canUpload && receipts.length === 0) return null;
  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content style={styles.gap}>
        <View style={styles.rowBetween}>
          <Text variant="titleMedium">{t("receipts.section")}</Text>
          {canUpload && uploading && <ActivityIndicator />}
          {canUpload && !uploading && !disabled && (
            <IconButton
              icon="paperclip"
              onPress={onAdd}
              accessibilityLabel={t("receipts.addAction")}
            />
          )}
        </View>
        {!canUpload && <HelperText type="info">{t("receipts.offlineHint")}</HelperText>}
        <ReceiptList
          receipts={receipts}
          allowRemove={canUpload && !disabled}
          onRemoved={onRemove}
        />
      </Card.Content>
    </Card>
  );
}
