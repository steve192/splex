import { useNavigation } from "@react-navigation/native";
import { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, Dialog, HelperText, List, Portal, Snackbar, Switch, Text, TextInput, useTheme } from "react-native-paper";

import { usePreferences } from "../../application/PreferencesContext";
import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { openTermsOfService } from "../../shared/legal/openTermsOfService";
import { CURRENCIES } from "../../shared/lib/currencies";
import {
  DevicePushState,
  getLocalPushPreference,
  setDevicePushEnabled
} from "../../shared/notifications/registration";
import { ThemeMode } from "../../shared/types/models";
import { LocationTrackingToggle } from "../../shared/ui/LocationTrackingToggle";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { ImageUploadField } from "../../shared/ui/ImageUploadField";
import { Screen } from "../../shared/ui/Screen";
import { SelectionOption, SelectionSheet } from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";

export function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { themeMode, setThemeMode } = usePreferences();
  const { api, refreshUser, user, logout } = useAuth();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const theme = useTheme();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [currency, setCurrency] = useState(user?.default_currency ?? "EUR");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<DevicePushState["lastStatus"]>("idle");
  const [pushError, setPushError] = useState<string | undefined>(undefined);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(user?.location_tracking_enabled ?? true);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const deleteKeyword = t("account.deleteAccountKeyword");
  const deleteEnabled = deleteConfirm.trim().toUpperCase() === deleteKeyword.toUpperCase();
  const currencyOptions: SelectionOption<string>[] = CURRENCIES.map((code) => ({ value: code, label: code }));
  const languageOptions: SelectionOption<"de" | "en">[] = [
    { value: "de", label: t("account.languageGerman") },
    { value: "en", label: t("account.languageEnglish") }
  ];
  const themeOptions: SelectionOption<ThemeMode>[] = [
    { value: "system", label: t("account.themeSystem") },
    { value: "light", label: t("account.themeLight") },
    { value: "dark", label: t("account.themeDark") }
  ];
  const selectedThemeLabel =
    themeOptions.find((option) => option.value === themeMode)?.label ?? t("account.themeSystem");

  useEffect(() => {
    getLocalPushPreference().then((pref) => setPushOn(pref === "on"));
  }, []);

  // Single autosave entry point: patch /api/me/ then refresh local user state.
  // Failures surface to the user via a Snackbar so they don't silently lose
  // the change they thought they just made.
  const saveFields = useCallback(
    async (patch: Record<string, unknown>) => {
      try {
        await api.patch("/api/me/", patch);
        await refreshUser();
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : t("common.error");
        setErrorMessage(message);
      }
    },
    [api, refreshUser, t]
  );

  async function togglePush(next: boolean) {
    setPushBusy(true);
    const result = await setDevicePushEnabled(api, next);
    setPushOn(result.preference === "on");
    setPushStatus(result.lastStatus);
    setPushError(result.lastError);
    setPushBusy(false);
  }

  async function handleLocationTrackingToggle(enabled: boolean) {
    setLocationTrackingEnabled(enabled);
    await saveFields({ location_tracking_enabled: enabled });
  }

  function handleDisplayNameBlur() {
    const trimmed = displayName.trim();
    if (trimmed === (user?.display_name ?? "")) return;
    saveFields({ display_name: trimmed });
  }

  function handleCurrencySelect(next: string) {
    setCurrency(next);
    saveFields({ default_currency: next });
  }

  function handleLocaleSelect(next: "de" | "en") {
    setLocale(next);
    saveFields({ locale: next });
  }

  function handleAvatarChange(image: { dataUrl: string; previewUrl: string }) {
    setAvatarUrl(image.previewUrl);
    saveFields({ avatar_image: image.dataUrl });
  }

  async function handleDeleteAccount() {
    if (!deleteEnabled) return;
    await api.delete("/api/me/delete/");
    setDeleteDialogVisible(false);
    logout();
  }

  const pushHelper = (() => {
    if (pushStatus === "permission_denied") return t("notifications.permissionDenied");
    if (pushStatus === "unsupported") return t("notifications.unsupported");
    if (pushStatus === "registered") return t("notifications.registered");
    if (!pushOn) return t("notifications.disabled");
    return "";
  })();

  return (
    <Screen topInset>
      <Text variant="headlineSmall">{t("account.title")}</Text>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <View style={styles.rowBetween}>
            <View>
              <Text variant="titleMedium">{displayName || user?.email}</Text>
              <Text variant="bodyMedium">{user?.email}</Text>
            </View>
            <PersonAvatar name={displayName || user?.email} imageUrl={avatarUrl} size={52} />
          </View>
          <TextInput
            mode="outlined"
            label={t("account.displayName")}
            value={displayName}
            onChangeText={setDisplayName}
            onBlur={handleDisplayNameBlur}
          />
          <ImageUploadField
            label={t("account.profileImage")}
            name={displayName || user?.email || ""}
            imageUrl={avatarUrl}
            onChange={handleAvatarChange}
          />
          <Button mode="elevated" onPress={() => setCurrencySheetOpen(true)}>
            {t("account.defaultCurrency")}: {currency}
          </Button>
          <Button mode="elevated" onPress={() => setLanguageSheetOpen(true)}>
            {t("account.language")}: {locale === "de" ? t("account.languageGerman") : t("account.languageEnglish")}
          </Button>
          <Button mode="elevated" onPress={() => setThemeSheetOpen(true)}>
            {t("account.theme")}: {selectedThemeLabel}
          </Button>
          <List.Item
            title={t("notifications.deviceToggle")}
            right={() => (
              <Switch value={pushOn} onValueChange={togglePush} disabled={pushBusy} />
            )}
          />
          {pushHelper ? <HelperText type="info">{pushHelper}</HelperText> : null}
          {pushStatus === "error" && pushError ? (
            <HelperText type="error">{pushError}</HelperText>
          ) : null}
          {pushStatus === "error" || pushStatus === "permission_denied" ? (
            <Button mode="text" icon="refresh" onPress={() => togglePush(true)} disabled={pushBusy}>
              {t("notifications.retry")}
            </Button>
          ) : null}
          <LocationTrackingToggle enabled={locationTrackingEnabled} onChange={handleLocationTrackingToggle} />
          <Button mode="text" onPress={logout}>{t("account.logout")}</Button>
          <Button
            mode="text"
            textColor={theme.colors.error}
            onPress={() => {
              setDeleteConfirm("");
              setDeleteDialogVisible(true);
            }}
          >
            {t("account.deleteAccount")}
          </Button>
        </Card.Content>
      </Card>
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
        >
          <Dialog.Title>{t("account.deleteAccount")}</Dialog.Title>
          <Dialog.Content style={styles.gap}>
            <Text>{t("account.deleteAccountConfirm")}</Text>
            <Text>{t("account.deleteAccountType")}</Text>
            <TextInput
              mode="outlined"
              label={t("account.deleteAccountTypeLabel")}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              autoCapitalize="characters"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>{t("common.cancel")}</Button>
            <Button
              textColor={theme.colors.error}
              disabled={!deleteEnabled}
              onPress={handleDeleteAccount}
            >
              {t("common.delete")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Text
        variant="bodySmall"
        onPress={() => openTermsOfService(() => navigation.navigate("TermsOfService"))}
        style={[styles.subtleFooterLink, { color: theme.colors.onSurfaceVariant }]}
      >
        {t("tos.title")}
      </Text>
      <SelectionSheet
        visible={currencySheetOpen}
        title={t("account.defaultCurrency")}
        options={currencyOptions}
        value={currency}
        onSelect={handleCurrencySelect}
        onDismiss={() => setCurrencySheetOpen(false)}
      />
      <SelectionSheet
        visible={languageSheetOpen}
        title={t("account.language")}
        options={languageOptions}
        value={locale}
        onSelect={handleLocaleSelect}
        onDismiss={() => setLanguageSheetOpen(false)}
      />
      <SelectionSheet
        visible={themeSheetOpen}
        title={t("account.theme")}
        options={themeOptions}
        value={themeMode}
        onSelect={setThemeMode}
        onDismiss={() => setThemeSheetOpen(false)}
      />
      <Snackbar
        visible={!!errorMessage}
        onDismiss={() => setErrorMessage("")}
        duration={6000}
        action={{ label: t("common.dismiss"), onPress: () => setErrorMessage("") }}
      >
        {errorMessage}
      </Snackbar>
    </Screen>
  );
}
