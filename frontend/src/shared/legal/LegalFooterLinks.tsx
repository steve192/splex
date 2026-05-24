import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { RootStackParamList } from "../../application/navigationTypes";
import { useI18n } from "../i18n/I18nContext";
import { LegalDocumentKind, openLegalDocument } from "./openTermsOfService";

const ENTRIES: { kind: LegalDocumentKind; route: keyof RootStackParamList; labelKey: `legal.${LegalDocumentKind}.title` }[] = [
  { kind: "tos", route: "TermsOfService", labelKey: "legal.tos.title" },
  { kind: "privacy", route: "PrivacyPolicy", labelKey: "legal.privacy.title" },
  { kind: "imprint", route: "Imprint", labelKey: "legal.imprint.title" }
];

export function LegalFooterLinks() {
  const { t } = useI18n();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const linkColor = theme.colors.onSurfaceVariant;

  return (
    <View style={styles.row}>
      {ENTRIES.map((entry, index) => (
        <View key={entry.kind} style={styles.item}>
          {index > 0 && <Text variant="bodySmall" style={[styles.separator, { color: linkColor }]}>·</Text>}
          <Text
            variant="bodySmall"
            onPress={() => openLegalDocument(entry.kind, () => navigation.navigate(entry.route))}
            style={{ color: linkColor }}
          >
            {t(entry.labelKey)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingVertical: 6
  },
  item: {
    alignItems: "center",
    flexDirection: "row"
  },
  separator: {
    marginHorizontal: 8
  }
});
