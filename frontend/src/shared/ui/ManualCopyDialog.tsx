import { Button, Dialog, Portal, Text, TextInput } from "react-native-paper";

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
}: ManualCopyDialogProps) {
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
          <Button onPress={onDismiss}>OK</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}