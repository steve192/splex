import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Button, Divider } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { startGoogleOAuthRedirect } from "./googleOAuthWeb";

// Closes the in-app browser tab after the OAuth flow on native.
WebBrowser.maybeCompleteAuthSession();

interface GoogleLoginButtonProps {
  /** Web OAuth client ID — must be defined; parent only renders this when available. */
  clientId: string;
  /** Android native client ID; only used on Android when a dedicated client exists. */
  androidClientId?: string;
  onError(message: string): void;
}

/**
 * "Sign in with Google" button.
 *
 * Web uses a full-page redirect; LoginScreen consumes the OAuth response on
 * mount.  Native Android uses `expo-auth-session`'s popup/in-app-browser flow.
 */
export function GoogleLoginButton(props: GoogleLoginButtonProps) {
  if (Platform.OS === "web") {
    return <GoogleLoginButtonWeb {...props} />;
  }
  return <GoogleLoginButtonNative {...props} />;
}

function GoogleLoginButtonWeb({ clientId }: GoogleLoginButtonProps) {
  const { t } = useI18n();
  return (
    <>
      <Divider />
      <Button mode="outlined" icon="google" onPress={() => startGoogleOAuthRedirect(clientId)}>
        {t("auth.googleLogin")}
      </Button>
    </>
  );
}

function GoogleLoginButtonNative({ clientId, androidClientId, onError }: GoogleLoginButtonProps) {
  const { t } = useI18n();
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId,
    androidClientId,
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params.id_token;
    if (!idToken) {
      onError(t("auth.googleFailed"));
      return;
    }
    setBusy(true);
    loginWithGoogle(idToken)
      .catch(() => onError(t("auth.googleFailed")))
      .finally(() => setBusy(false));
  }, [response]);

  return (
    <>
      <Divider />
      <Button
        mode="outlined"
        icon="google"
        disabled={!request || busy}
        loading={busy}
        onPress={() => promptAsync()}
      >
        {t("auth.googleLogin")}
      </Button>
    </>
  );
}
