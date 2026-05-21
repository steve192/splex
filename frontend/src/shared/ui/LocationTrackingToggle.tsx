import { useEffect, useState } from "react";
import { View } from "react-native";
import { List, Switch, Text, useTheme } from "react-native-paper";
import { useI18n } from "../i18n/I18nContext";
import { requestLocationPermission } from "../location/locationService";
import { styles } from "./styles";
import { negativeColor } from "./colors";

interface LocationTrackingToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

type PermissionStatus = "granted" | "denied" | "undetermined";

export function LocationTrackingToggle({ enabled, onChange }: LocationTrackingToggleProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const dangerColor = negativeColor(theme);

  async function handleToggle(newValue: boolean) {
    if (!newValue) {
      // Disabling doesn't need permission
      onChange(false);
      return;
    }

    // Enabling - request permission
    setRequestingPermission(true);
    try {
      const status = await requestLocationPermission();
      setPermissionStatus(status);
      if (status === "granted") {
        onChange(true);
      }
    } finally {
      setRequestingPermission(false);
    }
  }

  let statusText = "";
  let statusColor = theme.colors.onSurface;

  if (permissionStatus === "denied") {
    statusText = t("location.permissionDenied");
    statusColor = dangerColor;
  } else if (enabled && permissionStatus === "granted") {
    statusText = t("location.enabled");
    statusColor = theme.colors.primary;
  } else if (enabled) {
    statusText = t("location.requesting");
  } else {
    statusText = t("location.disabled");
  }

  return (
    <View style={styles.gap}>
      <List.Item
        title={t("location.title")}
        description={t("location.description")}
        right={() => (
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            disabled={requestingPermission}
          />
        )}
      />
      {statusText && (
        <Text variant="bodySmall" style={{ color: statusColor, marginLeft: 16 }}>
          {statusText}
        </Text>
      )}
    </View>
  );
}
