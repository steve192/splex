import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import { Image, Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Button, Dialog, IconButton, Portal, Text } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { styles } from "./styles";

type ImageCropDialogProps = {
  visible: boolean;
  /** Source image as a data URL (preferred) or local file URI. */
  source: string;
  onDismiss: () => void;
  onComplete: (croppedDataUrl: string) => void;
};

const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const WHEEL_ZOOM_STEP = 0.12;

/**
 * Single cross-platform interactive square cropper. Output is always a
 * 512×512 JPEG data URL produced by expo-image-manipulator.
 *
 * Input handling differs by platform but writes into the same pan/zoom state
 * so the crop output is identical:
 *   - Native: react-native-gesture-handler Pan + Pinch + zoom buttons.
 *   - Web:    DOM pointer events on a literal <div> (drag + pinch + wheel)
 *             + zoom buttons. RNGH's web build doesn't pick up mouse drag in
 *             this layout, so the input layer is bespoke.
 */
export function ImageCropDialog({ visible, source, onDismiss, onComplete }: Readonly<ImageCropDialogProps>) {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(1);
  // Pan expressed as 0-100% so 0 = leftmost/topmost edge of the source visible
  // in the viewport and 100 = rightmost/bottommost.
  const [panX, setPanX] = useState(50);
  const [panY, setPanY] = useState(50);
  const [viewportSize, setViewportSize] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Gesture/event handlers need synchronous access to the latest values
  // without re-binding on every render.
  const stateRef = useRef({
    zoom,
    panX,
    panY,
    viewportSize,
    startPanX: 50,
    startPanY: 50,
    startZoom: 1
  });
  stateRef.current = { ...stateRef.current, zoom, panX, panY, viewportSize };

  useEffect(() => {
    if (!visible) return;
    setZoom(1);
    setPanX(50);
    setPanY(50);
    setError("");
  }, [visible, source]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      stateRef.current.startPanX = stateRef.current.panX;
      stateRef.current.startPanY = stateRef.current.panY;
    })
    .onUpdate((event) => {
      const { viewportSize: vs, zoom: z, startPanX, startPanY } = stateRef.current;
      if (!vs) return;
      setPanX(clamp(startPanX - (event.translationX / vs) * (100 / z), 0, 100));
      setPanY(clamp(startPanY - (event.translationY / vs) * (100 / z), 0, 100));
    })
    .runOnJS(true);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      stateRef.current.startZoom = stateRef.current.zoom;
    })
    .onUpdate((event) => {
      setZoom(clamp(stateRef.current.startZoom * event.scale, MIN_ZOOM, MAX_ZOOM));
    })
    .runOnJS(true);

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  async function apply() {
    setBusy(true);
    setError("");
    try {
      const cropped = await cropSquare(source, zoom, panX, panY);
      onComplete(cropped);
    } catch {
      setError(t("image.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={busy ? undefined : onDismiss}>
        <Dialog.Title>{t("image.crop")}</Dialog.Title>
        <Dialog.Content>
          <View style={styles.gap}>
            {Platform.OS === "web" ? (
              <WebCropViewport
                source={source}
                viewportSize={viewportSize}
                zoom={zoom}
                panX={panX}
                panY={panY}
                stateRef={stateRef}
                onViewportSize={setViewportSize}
                onPan={(x, y) => { setPanX(x); setPanY(y); }}
                onZoom={setZoom}
              />
            ) : (
              <GestureDetector gesture={composedGesture}>
                <View
                  style={styles.cropPreview}
                  onLayout={(event) => setViewportSize(event.nativeEvent.layout.width)}
                >
                  {source ? (
                    <CropImageLayer
                      source={source}
                      viewportSize={viewportSize}
                      zoom={zoom}
                      panX={panX}
                      panY={panY}
                    />
                  ) : null}
                </View>
              </GestureDetector>
            )}
            <Text variant="bodySmall">{t("image.dragHelp")}</Text>
            <View style={styles.inline}>
              <Text variant="labelMedium">{t("image.zoom")}</Text>
              <IconButton
                icon="minus"
                size={20}
                disabled={zoom <= MIN_ZOOM}
                onPress={() => setZoom((z) => clamp(z - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
              />
              <Text variant="bodyMedium">{zoom.toFixed(2)}×</Text>
              <IconButton
                icon="plus"
                size={20}
                disabled={zoom >= MAX_ZOOM}
                onPress={() => setZoom((z) => clamp(z + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
              />
            </View>
            {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={busy}>{t("common.cancel")}</Button>
          <Button onPress={apply} loading={busy} disabled={busy}>{t("common.done")}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

type WebCropViewportProps = {
  source: string;
  viewportSize: number;
  zoom: number;
  panX: number;
  panY: number;
  stateRef: React.RefObject<{
    zoom: number;
    panX: number;
    panY: number;
    viewportSize: number;
    startPanX: number;
    startPanY: number;
    startZoom: number;
  }>;
  onViewportSize: (size: number) => void;
  onPan: (x: number, y: number) => void;
  onZoom: (zoom: number | ((current: number) => number)) => void;
};

/** Web-only viewport. Uses a literal <div> with React DOM event handlers
 *  because react-native-gesture-handler's web build doesn't reliably pick up
 *  mouse drag through this nested layout. */
function WebCropViewport({
  source,
  viewportSize,
  zoom,
  panX,
  panY,
  stateRef,
  onViewportSize,
  onPan,
  onZoom
}: Readonly<WebCropViewportProps>) {
  const pointers = useRef({
    map: new Map<number, { x: number; y: number }>(),
    startX: 0,
    startY: 0,
    startPanX: 50,
    startPanY: 50,
    startDistance: 0,
    startZoom: 1
  });

  return (
    <div
      ref={(node) => {
        if (node) onViewportSize(node.getBoundingClientRect().width);
      }}
      style={WEB_VIEWPORT_STYLE}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const { map } = pointers.current;
        map.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (map.size === 1) {
          pointers.current.startX = event.clientX;
          pointers.current.startY = event.clientY;
          pointers.current.startPanX = stateRef.current.panX;
          pointers.current.startPanY = stateRef.current.panY;
          return;
        }
        if (map.size === 2) {
          pointers.current.startDistance = pointerDistance(map);
          pointers.current.startZoom = stateRef.current.zoom;
        }
      }}
      onPointerMove={(event) => {
        const { map } = pointers.current;
        if (!map.has(event.pointerId)) return;
        map.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (map.size >= 2) {
          const distance = pointerDistance(map);
          if (pointers.current.startDistance > 0) {
            onZoom(clamp(
              pointers.current.startZoom * (distance / pointers.current.startDistance),
              MIN_ZOOM,
              MAX_ZOOM
            ));
          }
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const z = stateRef.current.zoom;
        const dx = event.clientX - pointers.current.startX;
        const dy = event.clientY - pointers.current.startY;
        onPan(
          clamp(pointers.current.startPanX - (dx / rect.width) * (100 / z), 0, 100),
          clamp(pointers.current.startPanY - (dy / rect.height) * (100 / z), 0, 100)
        );
      }}
      onPointerUp={(event) => {
        pointers.current.map.delete(event.pointerId);
      }}
      onPointerCancel={(event) => {
        pointers.current.map.delete(event.pointerId);
      }}
      onWheel={(event) => {
        const direction = event.deltaY > 0 ? -1 : 1;
        onZoom((current) => clamp(current + direction * WHEEL_ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
      }}
    >
      {source ? (
        <CropImageLayer
          source={source}
          viewportSize={viewportSize}
          zoom={zoom}
          panX={panX}
          panY={panY}
        />
      ) : null}
    </div>
  );
}

const WEB_VIEWPORT_STYLE = {
  alignSelf: "center" as const,
  background: "#111",
  border: "3px solid #fff",
  borderRadius: 128,
  cursor: "grab" as const,
  height: 256,
  overflow: "hidden" as const,
  position: "relative" as const,
  touchAction: "none" as const,
  userSelect: "none" as const,
  width: 256
};

type CropImageLayerProps = {
  source: string;
  viewportSize: number;
  zoom: number;
  panX: number;
  panY: number;
};

/** Decorative image layer. Wrapped in a pointer-events-blocked View so it
 *  never steals input from the parent viewport's gesture target. */
function CropImageLayer({ source, viewportSize, zoom, panX, panY }: Readonly<CropImageLayerProps>) {
  return (
    <View
      pointerEvents="none"
      style={{
        width: "100%",
        height: "100%",
        transform: [{ scale: zoom }],
        ...(Platform.OS === "web" ? { userSelect: "none" as const } : {}),
        ...(viewportSize
          ? {
              marginLeft: pixelOffset(viewportSize, zoom, panX),
              marginTop: pixelOffset(viewportSize, zoom, panY)
            }
          : {})
      }}
    >
      <Image
        source={{ uri: source }}
        resizeMode="cover"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pixelOffset(viewportSize: number, zoom: number, panPercent: number): number {
  const range = (viewportSize * (zoom - 1)) / 2;
  return range - (panPercent / 100) * range * 2;
}

function pointerDistance(pointers: Map<number, { x: number; y: number }>): number {
  const points = Array.from(pointers.values());
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

async function cropSquare(
  source: string,
  zoom: number,
  panX: number,
  panY: number
): Promise<string> {
  const { width, height } = await getImageSize(source);
  const baseScale = Math.max(OUTPUT_SIZE / width, OUTPUT_SIZE / height);
  const scale = baseScale * zoom;
  const cropSize = OUTPUT_SIZE / scale;
  const maxOriginX = Math.max(0, width - cropSize);
  const maxOriginY = Math.max(0, height - cropSize);
  const originX = maxOriginX * (panX / 100);
  const originY = maxOriginY * (panY / 100);
  const context = ImageManipulator.ImageManipulator.manipulate(source)
    .crop({ originX, originY, width: cropSize, height: cropSize })
    .resize({ width: OUTPUT_SIZE, height: OUTPUT_SIZE });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true
  });
  context.release();
  image.release();
  if (!result.base64) throw new Error("crop produced no base64 output");
  return `data:image/jpeg;base64,${result.base64}`;
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}
