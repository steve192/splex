/**
 * Run OS-permission-prompting startup tasks strictly one after another.
 *
 * Android can only present one runtime-permission dialog at a time: a second
 * request fired while a dialog is already open is silently denied (no prompt).
 * The login bootstrap needs both notification and location permission - and
 * `location_tracking_enabled` defaults to true for new accounts - so firing
 * them concurrently makes the second prompt vanish. Sequencing keeps each
 * dialog separate.
 *
 * Every step is best-effort: a rejecting step is swallowed so it can't block
 * the ones after it.
 */
export async function runPermissionBootstraps(
  steps: Array<() => Promise<unknown>>
): Promise<void> {
  for (const step of steps) {
    await step().catch(() => undefined);
  }
}
