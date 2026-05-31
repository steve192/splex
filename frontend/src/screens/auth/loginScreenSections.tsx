import { Platform, View } from "react-native";
import {
  Button,
  Divider,
  HelperText,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { GoogleLoginButton } from "../../shared/auth/GoogleLoginButton";
import { useI18n } from "../../shared/i18n/I18nContext";
import { styles } from "../../shared/ui/styles";

import { LoginMessage } from "./loginHelpers";

type LoginFormSectionProps = Readonly<{
  backendSettingsOpen: boolean;
  backendUrl: string;
  code: string;
  email: string;
  googleAndroidClientId: string | undefined;
  googleClientId: string | null;
  loading: boolean;
  loginRequested: boolean;
  message: LoginMessage | null;
  onBackendSettingsToggle: () => void;
  onBackendUrlChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onGoogleError: (message: string) => void;
  onRequestLink: () => void;
  onVerifyCode: () => void;
}>;

type DemoModeSectionProps = Readonly<{
  loading: boolean;
  onStartDemo: () => void;
}>;

export function LoginFormSection({
  backendSettingsOpen,
  backendUrl,
  code,
  email,
  googleAndroidClientId,
  googleClientId,
  loading,
  loginRequested,
  message,
  onBackendSettingsToggle,
  onBackendUrlChange,
  onCodeChange,
  onEmailChange,
  onGoogleError,
  onRequestLink,
  onVerifyCode,
}: LoginFormSectionProps) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <>
      <TextInput
        mode="outlined"
        label={t("auth.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={onEmailChange}
      />
      <Button mode="contained" loading={loading} disabled={!email || loading} onPress={onRequestLink}>
        {t("auth.request")}
      </Button>
      {loginRequested ? (
        <>
          <Divider />
          <TextInput
            mode="outlined"
            label={t("auth.code")}
            value={code}
            onChangeText={onCodeChange}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
          <Button mode="elevated" disabled={!email || !code || loading} onPress={onVerifyCode}>
            {t("auth.verify")}
          </Button>
        </>
      ) : null}
      {googleClientId ? (
        <GoogleLoginButton
          clientId={googleClientId}
          androidClientId={googleAndroidClientId}
          onError={onGoogleError}
        />
      ) : null}
      {Platform.OS === "android" ? (
        <>
          <Divider />
          <View style={styles.rowBetween}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("auth.backendUrl")}
            </Text>
            <IconButton icon="cog-outline" onPress={onBackendSettingsToggle} />
          </View>
          {backendSettingsOpen ? (
            <TextInput
              mode="outlined"
              label={t("auth.backendUrl")}
              autoCapitalize="none"
              autoCorrect={false}
              value={backendUrl}
              onChangeText={onBackendUrlChange}
            />
          ) : null}
        </>
      ) : null}
      {message ? <HelperText type={message.tone}>{message.text}</HelperText> : null}
    </>
  );
}

export function DemoModeSection({ loading, onStartDemo }: DemoModeSectionProps) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={styles.loginDemoSection}>
      <Divider />
      <Text variant="bodySmall" style={[styles.loginDemoHint, { color: theme.colors.onSurfaceVariant }]}>
        {t("auth.demoHint")}
      </Text>
      <Button mode="outlined" icon="play-circle-outline" loading={loading} disabled={loading} onPress={onStartDemo}>
        {t("auth.startDemo")}
      </Button>
    </View>
  );
}
