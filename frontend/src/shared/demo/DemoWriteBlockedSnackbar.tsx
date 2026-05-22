import { useEffect, useState } from "react";
import { Snackbar } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { onDemoWriteBlocked } from "./demoMode";

export function DemoWriteBlockedSnackbar() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => onDemoWriteBlocked(() => setVisible(true)), []);

  return (
    <Snackbar visible={visible} onDismiss={() => setVisible(false)} duration={3000}>
      {t("demo.writeBlocked")}
    </Snackbar>
  );
}
