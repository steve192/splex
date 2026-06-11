import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { ImageCropDialog } from "./ImageCropDialog";
import { ImageSearchSheet, OpenverseImage, buildAttributionText } from "./ImageSearchSheet";
import { PersonAvatar } from "./PersonAvatar";
import { styles } from "./styles";

type SelectedImage = {
  dataUrl: string;
  previewUrl: string;
  /** Filled when the image came from Openverse, blank otherwise. The caller
   *  forwards this to the backend so it can be stored alongside the image. */
  attribution?: string;
};

type ImageUploadFieldProps = {
  label: string;
  name: string;
  imageUrl?: string;
  /** Prefilled into the Openverse search box. Pass a group name here when
   *  editing a group, or leave empty for the account screen. */
  searchQuery?: string;
  onChange: (image: SelectedImage) => void;
};

/**
 * Routing per platform / source:
 *   - Native + local pick: expo-image-picker with `allowsEditing: true` so the
 *     user gets the OS-native crop UI for free.
 *   - Native + Openverse pick: shared {@link ImageCropDialog} (OS native crop
 *     can only operate on picker assets, not arbitrary downloads).
 *   - Web + local pick: shared {@link ImageCropDialog} (no native crop UI on
 *     web, and the dialog already implements the rich web cropper).
 *   - Web + Openverse pick: shared {@link ImageCropDialog}.
 *
 * So `ImageCropDialog` is the single non-OS cropper in the app - used for
 * everything except the one case where the OS picker gives us crop for free.
 */
export function ImageUploadField({ label, name, imageUrl, searchQuery, onChange }: Readonly<ImageUploadFieldProps>) {
  const { t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState(imageUrl ?? "");
  const [error, setError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cropSource, setCropSource] = useState("");
  // Attribution to attach when the active crop session completes. Cleared on
  // each new pick so a local upload after an Openverse pick doesn't reuse it.
  const [pendingAttribution, setPendingAttribution] = useState("");

  useEffect(() => {
    setPreviewUrl((prev) => (prev === "" ? (imageUrl ?? "") : prev));
  }, [imageUrl]);

  async function pickLocalImage() {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t("image.permissionDenied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      // Native: rely on the OS crop UI. Web: we handle cropping ourselves.
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
      setPendingAttribution("");
      setCropSource(dataUrl);
      return;
    }
    // Native - OS cropper already ran during the pick; commit directly.
    setPreviewUrl(asset.uri);
    onChange({ dataUrl, previewUrl: asset.uri });
  }

  async function handleOpenverseSelection(image: OpenverseImage) {
    setSearchOpen(false);
    setError("");
    try {
      const response = await fetch(image.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // arrayBuffer() avoids a Blob+FileReader path that broke in SDK 56 when
      // expo/fetch became the default global fetch: its Response.blob() returns
      // a Blob type that React Native's FileReader polyfill cannot read.
      const buffer = await response.arrayBuffer();
      const mime = response.headers.get("content-type") ?? "image/jpeg";
      const dataUrl = `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
      setPendingAttribution(buildAttributionText(image));
      setCropSource(dataUrl);
    } catch {
      setError(t("imageSearch.downloadFailed"));
    }
  }

  function applyCrop(croppedDataUrl: string) {
    setPreviewUrl(croppedDataUrl);
    onChange({
      dataUrl: croppedDataUrl,
      previewUrl: croppedDataUrl,
      attribution: pendingAttribution || undefined
    });
    setCropSource("");
    setPendingAttribution("");
  }

  return (
    <>
      <View style={styles.gap}>
        <Text variant="titleMedium">{label}</Text>
        <View style={styles.inline}>
          <PersonAvatar name={name} imageUrl={previewUrl} size={72} />
          <View style={styles.gap}>
            <Button mode="elevated" icon="image-edit-outline" onPress={pickLocalImage}>
              {t("image.uploadCrop")}
            </Button>
            <Button mode="elevated" icon="magnify" onPress={() => setSearchOpen(true)}>
              {t("imageSearch.action")}
            </Button>
          </View>
        </View>
        <Text variant="bodySmall">{t("image.roundPreview")}</Text>
        {error ? <HelperText type="error">{error}</HelperText> : null}
      </View>
      <ImageSearchSheet
        visible={searchOpen}
        initialQuery={searchQuery ?? ""}
        onDismiss={() => setSearchOpen(false)}
        onPick={handleOpenverseSelection}
      />
      <ImageCropDialog
        visible={!!cropSource}
        source={cropSource}
        onDismiss={() => {
          setCropSource("");
          setPendingAttribution("");
        }}
        onComplete={applyCrop}
      />
    </>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    // Bytes are 0-255, so code point and char code coincide; fromCodePoint
    // satisfies the linter and is equivalent for this binary data.
    binary += String.fromCodePoint(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
