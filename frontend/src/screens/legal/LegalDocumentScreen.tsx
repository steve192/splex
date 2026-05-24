import { Platform } from "react-native";

import { LegalDocumentScreen as LegalDocumentScreenNative } from "./LegalDocumentScreen.native";
import { LegalDocumentScreen as LegalDocumentScreenWeb } from "./LegalDocumentScreen.web";

export const LegalDocumentScreen =
  Platform.OS === "web" ? LegalDocumentScreenWeb : LegalDocumentScreenNative;
