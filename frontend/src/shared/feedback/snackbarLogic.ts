const DEFAULT_SNACKBAR_DURATION_MS = 6000;

export type SnackbarState = {
  duration: number;
  message: string;
};

export function snackbarStateForMessage(
  message: string,
  options: { duration?: number } = {},
): SnackbarState {
  return {
    duration: options.duration ?? DEFAULT_SNACKBAR_DURATION_MS,
    message,
  };
}

export function defaultSnackbarDuration(): number {
  return DEFAULT_SNACKBAR_DURATION_MS;
}
