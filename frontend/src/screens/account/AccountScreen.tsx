import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, HelperText, List, Switch, Text, TextInput } from "react-native-paper";

import { usePreferences } from "../../application/PreferencesContext";
import { useAuth } from "../../features/auth/AuthContext";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { CURRENCIES } from "../../shared/lib/currencies";
import {
  DevicePushState,
  getLocalPushPreference,
  setDevicePushEnabled
} from "../../shared/notifications/registration";
import { ThemeMode } from "../../shared/types/models";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { ImageUploadField } from "../../shared/ui/ImageUploadField";
import { Screen } from "../../shared/ui/Screen";
import { SelectionOption, SelectionSheet } from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";

export function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { themeMode, setThemeMode } = usePreferences();
  const { api, refreshUser, user, logout } = useAuth();
  const { showSuccess } = useFeedback();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [currency, setCurrency] = useState(user?.default_currency ?? "EUR");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [avatarImage, setAvatarImage] = useState("");
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<DevicePushState["lastStatus"]>("idle");
  const [pushError, setPushError] = useState<string | undefined>(undefined);
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

  async function save() {
    await api.patch("/api/me/", {
      display_name: displayName,
      default_currency: currency,
      locale,
      ...(avatarImage ? { avatar_image: avatarImage } : {})
    });
    await refreshUser();
    showSuccess({ icon: "check" });
  }

  async function togglePush(next: boolean) {
    setPushBusy(true);
    const result = await setDevicePushEnabled(api, next);
    setPushOn(result.preference === "on");
    setPushStatus(result.lastStatus);
    setPushError(result.lastError);
    setPushBusy(false);
  }

  function handleLocaleSelect(next: "de" | "en") {
    setLocale(next);
    api.patch("/api/me/", { locale: next }).catch(() => undefined);
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
          <TextInput mode="outlined" label={t("account.displayName")} value={displayName} onChangeText={setDisplayName} />
          <ImageUploadField
            label={t("account.profileImage")}
            name={displayName || user?.email || ""}
            imageUrl={avatarUrl}
            onChange={(image) => {
              setAvatarImage(image.dataUrl);
              setAvatarUrl(image.previewUrl);
            }}
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
          <Button mode="contained" onPress={save}>{t("common.save")}</Button>
          <Button mode="text" onPress={logout}>{t("account.logout")}</Button>
        </Card.Content>
      </Card>
      <SelectionSheet
        visible={currencySheetOpen}
        title={t("account.defaultCurrency")}
        options={currencyOptions}
        value={currency}
        onSelect={setCurrency}
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
    </Screen>
  );
}
