import { useState } from "react";
import { Platform, View } from "react-native";
import { Button, Card, HelperText, List, Switch, Text, TextInput } from "react-native-paper";

import { usePreferences } from "../../application/PreferencesContext";
import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { urlBase64ToUint8Array } from "../../shared/lib/webPush";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { ImageUploadField } from "../../shared/ui/ImageUploadField";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

declare const require: (moduleName: string) => unknown;

export function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { themeMode, toggleTheme } = usePreferences();
  const { api, refreshUser, user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [currency, setCurrency] = useState(user?.default_currency ?? "EUR");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [avatarImage, setAvatarImage] = useState("");
  const [pushEnabled, setPushEnabled] = useState(user?.push_enabled ?? true);
  const [notificationMessage, setNotificationMessage] = useState("");

  async function save() {
    await api.patch("/api/me/", {
      display_name: displayName,
      default_currency: currency,
      ...(avatarImage ? { avatar_image: avatarImage } : {}),
      push_enabled: pushEnabled
    });
    await refreshUser();
  }

  async function registerPushNotifications() {
    const config = await api.get<{ vapid_public_key: string; push_enabled: boolean }>(
      "/api/notifications/config/"
    );
    if (Platform.OS === "android") {
      const Notifications = require("expo-notifications") as typeof import("expo-notifications");
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setNotificationMessage(t("notifications.permissionDenied"));
        return;
      }
      const token = await Notifications.getDevicePushTokenAsync();
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
        applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key)
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
          <TextInput mode="outlined" label={t("account.defaultCurrency")} value={currency} onChangeText={setCurrency} />
          <List.Item
            title={t("account.darkMode")}
            right={() => <Switch value={themeMode === "dark"} onValueChange={toggleTheme} />}
          />
          <List.Item
            title={pushEnabled ? t("notifications.enabled") : t("notifications.disabled")}
            right={() => <Switch value={pushEnabled} onValueChange={setPushEnabled} />}
          />
          <Button mode="elevated" icon="bell" onPress={registerPushNotifications}>
            {t("notifications.register")}
          </Button>
          {notificationMessage ? <HelperText type="info">{notificationMessage}</HelperText> : null}
          <Button mode="contained" onPress={save}>{t("common.save")}</Button>
          <Button
            mode="elevated"
            onPress={() => setLocale(locale === "de" ? "en" : "de")}
          >
            {locale === "de" ? t("account.languageEnglish") : t("account.languageGerman")}
          </Button>
          <Button mode="text" onPress={logout}>{t("account.logout")}</Button>
        </Card.Content>
      </Card>
    </Screen>
  );
}
