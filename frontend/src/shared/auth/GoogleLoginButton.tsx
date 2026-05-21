import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Button, Divider } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";

// Required so the browser tab that handled the OAuth redirect closes itself
// and hands control back to the app.
WebBrowser.maybeCompleteAuthSession();

interface GoogleLoginButtonProps {
  /** Web OAuth client ID - must be defined; parent only renders this when available. */
  clientId: string;
  /** Android native client ID; optional, only needed for native Android builds. */
  androidClientId?: string;
  onError(message: string): void;
}

/**
 * "Sign in with Google" button.
 *
 * Rendered only when the parent has received a non-empty clientId from the
 * backend, so `useIdTokenAuthRequest` is always called with a valid client ID.
 */
export function GoogleLoginButton({ clientId, androidClientId, onError }: GoogleLoginButtonProps) {
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
