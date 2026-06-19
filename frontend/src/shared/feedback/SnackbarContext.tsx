import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Snackbar } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import {
  defaultSnackbarDuration,
  SnackbarState,
  snackbarStateForMessage,
} from "./snackbarLogic";

type SnackbarContextValue = {
  showSnackbar(message: string, options?: { duration?: number }): void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { t } = useI18n();
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);

  const showSnackbar = useCallback(
    (message: string, options: { duration?: number } = {}) => {
      setSnackbar(snackbarStateForMessage(message, options));
    },
    [],
  );

  const contextValue = useMemo(() => ({ showSnackbar }), [showSnackbar]);

  return (
    <SnackbarContext.Provider value={contextValue}>
      {children}
      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar(null)}
        duration={snackbar?.duration ?? defaultSnackbarDuration()}
        action={{
          label: t("common.dismiss"),
          onPress: () => setSnackbar(null),
        }}
      >
        {snackbar?.message ?? ""}
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const value = useContext(SnackbarContext);
  if (!value) {
    throw new Error("useSnackbar must be used inside SnackbarProvider.");
  }
  return value;
}
