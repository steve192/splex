import { Button, Dialog, Portal, Text, TextInput } from "react-native-paper";
import { useI18n } from "../i18n/I18nContext";

type ManualCopyDialogProps = {
  visible: boolean;
  title: string;
  description: string;
  value: string;
  label: string;
  onDismiss: () => void;
};

export function ManualCopyDialog({
  visible,
  title,
  description,
  value,
  label,
  onDismiss
}: Readonly<ManualCopyDialogProps>) {
  const { t } = useI18n();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text>{description}</Text>
          <TextInput
            mode="outlined"
            label={label}
            value={value}
            multiline
            editable={false}
            selectTextOnFocus
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t("common.ok")}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}