/**
 * Run best-effort async steps strictly one after another.
 *
 * This is used for OS permission prompts: Android can only present one runtime
 * permission dialog at a time, and a second request fired while another dialog
 * is open can be silently denied.
 */
export async function runBestEffortSequentially(
  steps: Array<() => Promise<unknown>>
): Promise<void> {
  for (const step of steps) {
    await step().catch(() => undefined);
  }
}
