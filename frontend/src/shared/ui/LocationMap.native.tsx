import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import MapView, { Marker } from "react-native-maps";
import { openLocationInMaps } from "../location/mapsIntegration";
import { styles } from "./styles";

export interface LocationMapProps {
  readonly latitude: number;
  readonly longitude: number;
  readonly height?: number;
}

export function LocationMap({ latitude, longitude, height = 200 }: Readonly<LocationMapProps>) {
  const region = {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <Pressable onPress={() => openLocationInMaps(latitude, longitude)}>
      <View style={[styles.gap, { height }]}>
        <MapView style={{ flex: 1 }} region={region} scrollEnabled={false} zoomEnabled={false}>
          <Marker coordinate={{ latitude, longitude }} />
        </MapView>
        <View style={[styles.flex, { alignItems: "center" }]}>
          <Text variant="bodySmall">
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
