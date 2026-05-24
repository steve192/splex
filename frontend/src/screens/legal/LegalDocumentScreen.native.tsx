import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Linking, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";
import { WebView, WebViewNavigation } from "react-native-webview";

import { RootStackParamList } from "../../application/navigationTypes";
import { useI18n } from "../../shared/i18n/I18nContext";
import { LegalDocumentKind } from "../../shared/legal/openTermsOfService";
import { styles } from "../../shared/ui/styles";
import { useLegalDocumentHtml } from "./useTermsOfServiceHtml";

type Props = {
  kind: LegalDocumentKind;
};

const INTERNAL_ROUTES: Record<string, keyof RootStackParamList> = {
  "/tos": "TermsOfService",
  "/privacy": "PrivacyPolicy",
  "/imprint": "Imprint"
};

export function LegalDocumentScreen({ kind }: Props) {
  const { t } = useI18n();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { html, loading, error, reload } = useLegalDocumentHtml(kind);
  const loadingKey = `legal.${kind}.loading` as const;
  const failedKey = `legal.${kind}.loadFailed` as const;

  if (loading) {
    return (
      <View style={[styles.flex, styles.emptyStateContent, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
        <Text>{t(loadingKey)}</Text>
      </View>
    );
  }

  if (error || !html) {
    return (
      <View style={[styles.flex, styles.emptyStateContent, { backgroundColor: theme.colors.background }]}>
        <Text>{t(failedKey)}</Text>
        <Button mode="contained" onPress={reload}>{t("legal.retry")}</Button>
      </View>
    );
  }

  const handleShouldStartLoad = (request: WebViewNavigation) => {
    const url = request.url ?? "";
    // Allow the initial HTML payload itself.
    if (!url || url === "about:blank" || url.startsWith("about:")) {
      return true;
    }
    if (url.startsWith("mailto:") || url.startsWith("tel:")) {
      Linking.openURL(url).catch(() => undefined);
      return false;
    }
    // Map known internal paths to in-app navigation.
    const path = pathFromUrl(url);
    const targetRoute = path ? INTERNAL_ROUTES[path] : undefined;
    if (targetRoute) {
      if (targetRoute !== routeForKind(kind)) {
        navigation.replace(targetRoute);
      }
      return false;
    }
    // Any other absolute URL: open in the system browser.
    if (/^https?:\/\//i.test(url)) {
      Linking.openURL(url).catch(() => undefined);
      return false;
    }
    return false;
  };

  return (
    <WebView
      source={{ html }}
      style={styles.flex}
      originWhitelist={["*"]}
      onShouldStartLoadWithRequest={handleShouldStartLoad}
    />
  );
}

function pathFromUrl(raw: string): string | undefined {
  try {
    const parsed = new URL(raw);
    return parsed.pathname.replace(/\/$/, "") || "/";
  } catch {
    if (raw.startsWith("/")) {
      const [pathOnly] = raw.split(/[?#]/);
      return pathOnly.replace(/\/$/, "") || "/";
    }
    return undefined;
  }
}

function routeForKind(kind: LegalDocumentKind): keyof RootStackParamList {
  switch (kind) {
    case "privacy":
      return "PrivacyPolicy";
    case "imprint":
      return "Imprint";
    case "tos":
    default:
      return "TermsOfService";
  }
}
