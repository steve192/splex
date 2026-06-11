import { useEffect, useRef, useState } from "react";
import { Image, ImageSourcePropType, Modal, Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../features/auth/AuthContext";
import { fetchMediaAttribution } from "../api/mediaAttribution";

type ImageViewerModalProps = {
  visible: boolean;
  title?: string;
  imageUrl?: string;
  imageSource?: ImageSourcePropType;
  onDismiss: () => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const WHEEL_ZOOM_STEP = 0.18;

/**
 * Full-screen image popup with pinch-to-zoom and pan. Used wherever we want
 * users to take a closer look at an image (avatars, group icons, etc.).
 *
 * - Image is centered and scaled to fit the screen at zoom 1.
 * - Pinch zooms in to 5×; pan moves the image while zoomed in.
 * - Close button floats top-right above the safe area so it's never clipped
 *   by the image, regardless of how big the image is.
 * - Title + attribution caption sit above the bottom safe area for the same
 *   reason.
 */
export function ImageViewerModal({
  visible,
  title,
  imageUrl,
  imageSource,
  onDismiss
}: Readonly<ImageViewerModalProps>) {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [attribution, setAttribution] = useState("");

  const stateRef = useRef({ zoom, tx, ty, startTx: 0, startTy: 0, startZoom: 1 });
  stateRef.current = { ...stateRef.current, zoom, tx, ty };

  useEffect(() => {
    if (visible) {
      setZoom(1);
      setTx(0);
      setTy(0);
    }
  }, [visible]);

  // Fetch attribution on open from the dedicated endpoint so we don't have to
  // inline the field in every list/detail response that includes an avatar.
  useEffect(() => {
    if (!visible) {
      setAttribution("");
      return;
    }
    let cancelled = false;
    fetchMediaAttribution(api, imageUrl).then((value) => {
      if (!cancelled) setAttribution(value);
    });
    return () => { cancelled = true; };
  }, [visible, imageUrl, api]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      stateRef.current.startTx = stateRef.current.tx;
      stateRef.current.startTy = stateRef.current.ty;
    })
    .onUpdate((event) => {
      setTx(stateRef.current.startTx + event.translationX);
      setTy(stateRef.current.startTy + event.translationY);
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

  const source = imageUrl ? { uri: imageUrl } : imageSource;
  const hasCaption = Boolean(title || attribution);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)" }}>
        {Platform.OS === "web" ? (
          <WebPannableImage source={source} zoom={zoom} tx={tx} ty={ty} stateRef={stateRef} onPan={(x, y) => { setTx(x); setTy(y); }} onZoom={setZoom} />
        ) : (
          <GestureDetector gesture={composedGesture}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              {source ? (
                <Image
                  source={source}
                  resizeMode="contain"
                  style={{
                    width: "100%",
                    height: "100%",
                    transform: [{ translateX: tx }, { translateY: ty }, { scale: zoom }]
                  }}
                />
              ) : null}
            </View>
          </GestureDetector>
        )}
        <IconButton
          icon="close"
          mode="contained"
          size={28}
          containerColor="rgba(0,0,0,0.55)"
          iconColor="#fff"
          onPress={onDismiss}
          style={{ position: "absolute", top: insets.top + 8, right: 8 }}
        />
        {hasCaption ? (
          <View
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: insets.bottom + 16,
              gap: 4,
              padding: 12,
              borderRadius: 12,
              backgroundColor: "rgba(0,0,0,0.55)"
            }}
          >
            {title ? (
              <Text variant="titleMedium" style={{ color: "#fff" }}>{title}</Text>
            ) : null}
            {attribution ? (
              <Text variant="bodySmall" style={{ color: "#fff" }}>{attribution}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

type WebPannableImageProps = {
  source: { uri: string } | ImageSourcePropType | undefined;
  zoom: number;
  tx: number;
  ty: number;
  stateRef: React.RefObject<{
    zoom: number;
    tx: number;
    ty: number;
    startTx: number;
    startTy: number;
    startZoom: number;
  }>;
  onPan: (x: number, y: number) => void;
  onZoom: (zoom: number | ((current: number) => number)) => void;
};

function WebPannableImage({ source, zoom, tx, ty, stateRef, onPan, onZoom }: Readonly<WebPannableImageProps>) {
  const pointers = useRef({
    map: new Map<number, { x: number; y: number }>(),
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    startDistance: 0,
    startZoom: 1
  });
  const uri = source && "uri" in (source as { uri?: string }) ? (source as { uri: string }).uri : undefined;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        touchAction: "none",
        userSelect: "none",
        height: "100%",
        width: "100%"
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const { map } = pointers.current;
        map.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (map.size === 1) {
          pointers.current.startX = event.clientX;
          pointers.current.startY = event.clientY;
          pointers.current.startTx = stateRef.current.tx;
          pointers.current.startTy = stateRef.current.ty;
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
          const d = pointerDistance(map);
          if (pointers.current.startDistance > 0) {
            onZoom(clamp(pointers.current.startZoom * (d / pointers.current.startDistance), MIN_ZOOM, MAX_ZOOM));
          }
          return;
        }
        onPan(
          pointers.current.startTx + (event.clientX - pointers.current.startX),
          pointers.current.startTy + (event.clientY - pointers.current.startY)
        );
      }}
      onPointerUp={(event) => { pointers.current.map.delete(event.pointerId); }}
      onPointerCancel={(event) => { pointers.current.map.delete(event.pointerId); }}
      onWheel={(event) => {
        const direction = event.deltaY > 0 ? -1 : 1;
        onZoom((current) => clamp(current + direction * WHEEL_ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
      }}
    >
      {uri ? (
        <img
          alt=""
          draggable={false}
          src={uri}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            pointerEvents: "none",
            transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
            transformOrigin: "center"
          }}
        />
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pointerDistance(pointers: Map<number, { x: number; y: number }>): number {
  const points = Array.from(pointers.values());
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}
