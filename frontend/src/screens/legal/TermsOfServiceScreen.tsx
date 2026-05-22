import { Platform } from "react-native";

import { TermsOfServiceScreen as TermsOfServiceScreenNative } from "./TermsOfServiceScreen.native";
import { TermsOfServiceScreen as TermsOfServiceScreenWeb } from "./TermsOfServiceScreen.web";

export const TermsOfServiceScreen =
  Platform.OS === "web" ? TermsOfServiceScreenWeb : TermsOfServiceScreenNative;