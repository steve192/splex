import { View } from "react-native";
import { Button, Text } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { openLocationInMaps } from "../location/mapsIntegration";
import { LocationsMap } from "./LocationsMap";
import { locationMapPoint } from "./locationsMapModel";
import { styles } from "./styles";

export interface LocationMapProps {
  readonly latitude: number;
  readonly longitude: number;
  readonly height?: number;
}

export function LocationMap({ latitude, longitude, height = 250 }: Readonly<LocationMapProps>) {
  const { t } = useI18n();

  return (
    <>
      <LocationsMap points={[locationMapPoint(latitude, longitude)]} height={height} />
      <View style={styles.mapMeta}>
        <Text variant="bodySmall">
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </Text>
      </View>
      <Button mode="contained" onPress={() => openLocationInMaps(latitude, longitude)}>
        {t("map.openInMaps")}
      </Button>
    </>
  );
}
