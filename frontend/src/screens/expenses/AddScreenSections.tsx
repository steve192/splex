import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  HelperText,
  List,
  Switch,
  Text,
} from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import type { ContextOption, Receipt } from "../../shared/types/models";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import { ExpenseOptionsCard } from "./ExpenseOptionsCard";
import { ReceiptsCard } from "./ReceiptsCard";
import type { ActiveSheet } from "./addScreenTypes";

export function EditExpensePlaceholder({
  editing,
  viewState,
  onCancel,
}: Readonly<{
  editing: boolean;
  viewState: "loading" | "error";
  onCancel: () => void;
}>) {
  const { t } = useI18n();

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.rowBetween}>
          <Text variant="headlineSmall">
            {editing ? t("expense.edit") : t("expense.add")}
          </Text>
          {editing ? (
            <Button mode="text" onPress={onCancel}>
              {t("common.cancel")}
            </Button>
          ) : null}
        </View>
        <View style={styles.emptyStateContent}>
          {viewState === "loading" ? (
            <ActivityIndicator />
          ) : (
            <Text variant="bodyMedium">{t("common.error")}</Text>
          )}
        </View>
      </Screen>
    </View>
  );
}

export function ExpenseFormHeader({
  editing,
  selectedContext,
  contextArchived,
  onCancel,
  onChangeContext,
}: Readonly<{
  editing: boolean;
  selectedContext?: ContextOption;
  contextArchived: boolean;
  onCancel: () => void;
  onChangeContext: () => void;
}>) {
  const { t } = useI18n();

  return (
    <View style={styles.rowBetween}>
      <View style={[styles.flex, styles.inline]}>
        {selectedContext ? (
          <PersonAvatar
            name={selectedContext.name}
            imageUrl={selectedContext.image_url}
          />
        ) : null}
        <View>
          <Text variant="headlineSmall">
            {editing ? t("expense.edit") : t("expense.add")}
          </Text>
          {selectedContext ? (
            <Text variant="bodyMedium">{selectedContext.name}</Text>
          ) : null}
        </View>
      </View>
      <ExpenseFormHeaderAction
        editing={editing}
        hasContext={Boolean(selectedContext)}
        contextArchived={contextArchived}
        onCancel={onCancel}
        onChangeContext={onChangeContext}
      />
    </View>
  );
}

function ExpenseFormHeaderAction({
  editing,
  hasContext,
  contextArchived,
  onCancel,
  onChangeContext,
}: Readonly<{
  editing: boolean;
  hasContext: boolean;
  contextArchived: boolean;
  onCancel: () => void;
  onChangeContext: () => void;
}>) {
  const { t } = useI18n();

  if (editing) {
    return (
      <Button mode="text" onPress={onCancel}>
        {t("common.cancel")}
      </Button>
    );
  }
  if (!hasContext) return null;

  return (
    <Button
      mode="text"
      icon="swap-horizontal"
      disabled={contextArchived}
      onPress={onChangeContext}
    >
      {t("expense.changeContext")}
    </Button>
  );
}

export function ExpenseRevealSection({
  canRevealOptions,
  selectedContext,
  date,
  payerLabel,
  splitLabel,
  contextEditable,
  contextArchived,
  showContextInfo,
  locationTrackingEnabled,
  locationDescription,
  includeLocation,
  receipts,
  canUploadReceipts,
  uploadingReceipt,
  saving,
  valid,
  pendingMutationId,
  deletingPendingExpense,
  deleteColor,
  onOpen,
  onShowContextInfo,
  onToggleLocation,
  onSetIncludeLocation,
  onAddReceipt,
  onRemoveReceipt,
  onSave,
  onDeletePendingExpense,
}: Readonly<{
  canRevealOptions: boolean;
  selectedContext?: ContextOption;
  date: string;
  payerLabel: string;
  splitLabel: string;
  contextEditable: boolean;
  contextArchived: boolean;
  showContextInfo: boolean;
  locationTrackingEnabled: boolean;
  locationDescription: string;
  includeLocation: boolean;
  receipts: Receipt[];
  canUploadReceipts: boolean;
  uploadingReceipt: boolean;
  saving: boolean;
  valid: boolean;
  pendingMutationId?: string;
  deletingPendingExpense: boolean;
  deleteColor: string;
  onOpen: (sheet: ActiveSheet) => void;
  onShowContextInfo: () => void;
  onToggleLocation: () => void;
  onSetIncludeLocation: (enabled: boolean) => void;
  onAddReceipt: () => void;
  onRemoveReceipt: (id: number) => void;
  onSave: () => void;
  onDeletePendingExpense: () => void;
}>) {
  const { t } = useI18n();

  if (!canRevealOptions) {
    return <HelperText type="info">{t("expense.fastEntryHint")}</HelperText>;
  }

  return (
    <>
      <ExpenseOptionsCard
        contextName={selectedContext?.name}
        hasContext={Boolean(selectedContext)}
        date={date}
        payerLabel={payerLabel}
        splitLabel={splitLabel}
        onOpen={onOpen}
        contextEditable={contextEditable}
        showContextInfo={showContextInfo}
        onShowContextInfo={onShowContextInfo}
        disabled={contextArchived}
      />
      <LocationTrackingCard
        visible={locationTrackingEnabled}
        description={locationDescription}
        includeLocation={includeLocation}
        disabled={contextArchived}
        onToggle={onToggleLocation}
        onValueChange={onSetIncludeLocation}
      />
      {selectedContext ? (
        <ReceiptsCard
          receipts={receipts}
          canUpload={canUploadReceipts}
          uploading={uploadingReceipt}
          onAdd={onAddReceipt}
          onRemove={onRemoveReceipt}
          disabled={contextArchived}
        />
      ) : null}
      <ExpenseSaveButtons
        saving={saving}
        valid={valid}
        contextArchived={contextArchived}
        pendingMutationId={pendingMutationId}
        deletingPendingExpense={deletingPendingExpense}
        deleteColor={deleteColor}
        onSave={onSave}
        onDeletePendingExpense={onDeletePendingExpense}
      />
    </>
  );
}

function LocationTrackingCard({
  visible,
  description,
  includeLocation,
  disabled,
  onToggle,
  onValueChange,
}: Readonly<{
  visible: boolean;
  description: string;
  includeLocation: boolean;
  disabled: boolean;
  onToggle: () => void;
  onValueChange: (enabled: boolean) => void;
}>) {
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <Card mode="elevated" style={styles.card}>
      <List.Item
        title={t("expense.location")}
        description={description}
        onPress={disabled ? undefined : onToggle}
        left={(props) => <List.Icon {...props} icon="map-marker-outline" />}
        right={() => (
          <Switch
            value={includeLocation}
            disabled={disabled}
            onValueChange={onValueChange}
          />
        )}
      />
    </Card>
  );
}

function ExpenseSaveButtons({
  saving,
  valid,
  contextArchived,
  pendingMutationId,
  deletingPendingExpense,
  deleteColor,
  onSave,
  onDeletePendingExpense,
}: Readonly<{
  saving: boolean;
  valid: boolean;
  contextArchived: boolean;
  pendingMutationId?: string;
  deletingPendingExpense: boolean;
  deleteColor: string;
  onSave: () => void;
  onDeletePendingExpense: () => void;
}>) {
  const { t } = useI18n();

  return (
    <>
      <Button
        mode="contained"
        icon="check"
        loading={saving}
        disabled={!valid || saving || contextArchived}
        onPress={onSave}
      >
        {t("expense.save")}
      </Button>
      {pendingMutationId ? (
        <Button
          mode="text"
          icon="delete-outline"
          textColor={deleteColor}
          loading={deletingPendingExpense}
          disabled={saving || deletingPendingExpense}
          onPress={onDeletePendingExpense}
        >
          {t("expense.deletePending")}
        </Button>
      ) : null}
    </>
  );
}

export function ExpenseFormMessages({
  contextArchived,
  message,
  messageColor,
}: Readonly<{
  contextArchived: boolean;
  message: string;
  messageColor: string;
}>) {
  const { t } = useI18n();

  return (
    <>
      {contextArchived ? (
        <HelperText type="info">{t("group.archivedReadOnly")}</HelperText>
      ) : null}
      {message ? (
        <Text style={{ color: messageColor }}>{message}</Text>
      ) : null}
    </>
  );
}
