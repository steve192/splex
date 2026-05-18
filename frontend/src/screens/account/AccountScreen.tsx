import { useState } from "react";
import { Platform, View } from "react-native";
import { Button, Card, HelperText, List, Switch, Text, TextInput } from "react-native-paper";

import { usePreferences } from "../../application/PreferencesContext";
import { useAuth } from "../../features/auth/AuthContext";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { CURRENCIES } from "../../shared/lib/currencies";
import { urlBase64ToArrayBuffer } from "../../shared/lib/webPush";
import { ThemeMode } from "../../shared/types/models";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { ImageUploadField } from "../../shared/ui/ImageUploadField";
import { Screen } from "../../shared/ui/Screen";
import { SelectionOption, SelectionSheet } from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";

declare const require: (moduleName: string) => unknown;

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
  const [pushEnabled, setPushEnabled] = useState(user?.push_enabled ?? true);
  const [notificationMessage, setNotificationMessage] = useState("");
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

  async function save() {
    await api.patch("/api/me/", {
      display_name: displayName,
      default_currency: currency,
      ...(avatarImage ? { avatar_image: avatarImage } : {}),
      push_enabled: pushEnabled
    });
    await refreshUser();
    showSuccess({ icon: "check" });
  }

  async function registerPushNotifications() {
    const config = await api.get<{ vapid_public_key: string; push_enabled: boolean }>(
      "/api/notifications/config/"
    );
    if (Platform.OS === "android") {
      const Notifications = require("expo-notifications") as typeof import("expo-notifications");
      const Constants = require("expo-constants") as typeof import("expo-constants");
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setNotificationMessage(t("notifications.permissionDenied"));
        return;
      }
      const projectId =
        Constants.default?.easConfig?.projectId ||
        Constants.default?.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      await api.post("/api/notifications/device-tokens/", {
        token: token.data,
        platform: "android"
      });
      setNotificationMessage(t("notifications.registered"));
      return;
    }
    if (Platform.OS === "web") {
      if (!config.vapid_public_key || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setNotificationMessage(t("notifications.webUnavailable"));
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationMessage(t("notifications.permissionDenied"));
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(config.vapid_public_key)
      });
      await api.post("/api/notifications/web-push-subscriptions/", subscription.toJSON());
      setNotificationMessage(t("notifications.registered"));
      return;
    }
    setNotificationMessage(t("notifications.unsupported"));
  }

  return (
    <Screen>
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
            title={pushEnabled ? t("notifications.enabled") : t("notifications.disabled")}
            right={() => <Switch value={pushEnabled} onValueChange={setPushEnabled} />}
          />
          <Button mode="elevated" icon="bell" onPress={registerPushNotifications}>
            {t("notifications.register")}
          </Button>
          {notificationMessage ? <HelperText type="info">{notificationMessage}</HelperText> : null}
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
        onSelect={setLocale}
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
