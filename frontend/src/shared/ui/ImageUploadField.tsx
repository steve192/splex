import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Button, Dialog, HelperText, Portal, Text } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { PersonAvatar } from "./PersonAvatar";
import { styles } from "./styles";

type SelectedImage = {
  dataUrl: string;
  previewUrl: string;
};

type ImageUploadFieldProps = {
  label: string;
  name: string;
  imageUrl?: string;
  onChange: (image: SelectedImage) => void;
};

export function ImageUploadField({ label, name, imageUrl, onChange }: ImageUploadFieldProps) {
  const { t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState(imageUrl ?? "");
  const [error, setError] = useState("");
  const [cropSource, setCropSource] = useState("");
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const pointerState = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    startX: 0,
    startY: 0,
    startCropX: 50,
    startCropY: 50,
    startDistance: 0,
    startZoom: 1
  });

  async function pickImage() {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t("image.permissionDenied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: Platform.OS !== "web",
      aspect: [1, 1],
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setError(t("image.failed"));
      return;
    }
    const mimeType = asset.mimeType ?? "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${asset.base64}`;
    if (Platform.OS === "web") {
      setCropSource(dataUrl);
      setCropZoom(1);
      setCropX(50);
      setCropY(50);
      return;
    }
    setPreviewUrl(asset.uri);
    onChange({ dataUrl, previewUrl: asset.uri });
  }

  async function applyWebCrop() {
    try {
      const cropped = await cropSquareDataUrl(cropSource, cropZoom, cropX, cropY);
      setPreviewUrl(cropped);
      onChange({ dataUrl: cropped, previewUrl: cropped });
      setCropSource("");
    } catch {
      setError(t("image.failed"));
    }
  }

  function beginCropMove(event: any) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerState.current.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });
    if (pointerState.current.pointers.size === 1) {
      pointerState.current.startX = event.clientX;
      pointerState.current.startY = event.clientY;
      pointerState.current.startCropX = cropX;
      pointerState.current.startCropY = cropY;
      return;
    }
    if (pointerState.current.pointers.size === 2) {
      pointerState.current.startDistance = pointerDistance(pointerState.current.pointers);
      pointerState.current.startZoom = cropZoom;
    }
  }

  function moveCrop(event: any) {
    if (!pointerState.current.pointers.has(event.pointerId)) return;
    pointerState.current.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });
    if (pointerState.current.pointers.size >= 2) {
      const distance = pointerDistance(pointerState.current.pointers);
      if (pointerState.current.startDistance > 0) {
        setCropZoom(clamp(pointerState.current.startZoom * (distance / pointerState.current.startDistance), 1, 4));
      }
      return;
    }
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const deltaX = event.clientX - pointerState.current.startX;
    const deltaY = event.clientY - pointerState.current.startY;
    setCropX(clamp(pointerState.current.startCropX - (deltaX / rect.width) * (100 / cropZoom), 0, 100));
    setCropY(clamp(pointerState.current.startCropY - (deltaY / rect.height) * (100 / cropZoom), 0, 100));
  }

  function endCropMove(event: any) {
    pointerState.current.pointers.delete(event.pointerId);
    if (pointerState.current.pointers.size === 1) {
      const remaining = Array.from(pointerState.current.pointers.values())[0];
      pointerState.current.startX = remaining.x;
      pointerState.current.startY = remaining.y;
      pointerState.current.startCropX = cropX;
      pointerState.current.startCropY = cropY;
    }
  }

  function zoomCrop(event: any) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    setCropZoom((current) => clamp(current + direction * 0.12, 1, 4));
  }

  const RangeInput = "input" as any;

  return (
    <>
      <View style={styles.gap}>
        <Text variant="titleMedium">{label}</Text>
        <View style={styles.inline}>
          <PersonAvatar name={name} imageUrl={previewUrl} size={72} />
          <Button mode="elevated" icon="image-edit-outline" onPress={pickImage}>
            {t("image.uploadCrop")}
          </Button>
        </View>
        <Text variant="bodySmall">{t("image.roundPreview")}</Text>
        {error ? <HelperText type="error">{error}</HelperText> : null}
      </View>
      <Portal>
        <Dialog visible={!!cropSource} onDismiss={() => setCropSource("")}>
          <Dialog.Title>{t("image.crop")}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.gap}>
              <View style={styles.cropPreview}>
                <img
                  alt=""
                  draggable={false}
                  onPointerDown={beginCropMove}
                  onPointerMove={moveCrop}
                  onPointerUp={endCropMove}
                  onPointerCancel={endCropMove}
                  onWheel={zoomCrop}
                  src={cropSource}
                  style={{
                    cursor: "grab",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: `${cropX}% ${cropY}%`,
                    touchAction: "none",
                    transform: `scale(${cropZoom})`,
                    transformOrigin: `${cropX}% ${cropY}%`,
                    userSelect: "none",
                    width: "100%"
                  }}
                />
              </View>
              <Text variant="bodySmall">{t("image.dragHelp")}</Text>
              <Text variant="labelMedium">{t("image.zoom")}</Text>
              <RangeInput
                type="range"
                min="1"
                max="4"
                step="0.05"
                value={cropZoom}
                onChange={(event: any) => setCropZoom(Number(event.target.value))}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCropSource("")}>{t("common.cancel")}</Button>
            <Button onPress={applyWebCrop}>{t("common.done")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pointerDistance(pointers: Map<number, { x: number; y: number }>): number {
  const [first, second] = Array.from(pointers.values());
  if (!first || !second) return 0;
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function cropSquareDataUrl(
  dataUrl: string,
  zoom: number,
  positionX: number,
  positionY: number
): Promise<string> {
  const image = await loadImage(dataUrl);
  const outputSize = 512;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable.");

  const baseScale = Math.max(outputSize / image.width, outputSize / image.height);
  const scale = baseScale * zoom;
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  const maxOffsetX = Math.max(0, drawnWidth - outputSize);
  const maxOffsetY = Math.max(0, drawnHeight - outputSize);
  const offsetX = -maxOffsetX * (positionX / 100);
  const offsetY = -maxOffsetY * (positionY / 100);

  context.fillStyle = "#fff";
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(image, offsetX, offsetY, drawnWidth, drawnHeight);
  return canvas.toDataURL("image/jpeg", 0.9);
}
