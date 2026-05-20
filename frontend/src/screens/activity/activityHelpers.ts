import { TranslateFn } from "../../shared/i18n/I18nContext";
import { ActivityFeedEvent } from "../../shared/types/models";

/**
 * Build the secondary text shown under an activity entry.
 *
 * Expenses: "<description> - <amount> <currency>"
 * Settlements: localized "<from> paid <to> <amount>" line
 * Group/member events: live subject_name (with legacy snapshot fallback)
 * Otherwise: amount + currency, or empty.
 */
export function activityDescription(item: ActivityFeedEvent, t: TranslateFn): string {
  const payload = item.payload ?? {};
  if (payload.description && payload.amount && payload.currency) {
    return `${payload.description} - ${payload.amount} ${payload.currency}`;
  }
  if (payload.description) return String(payload.description);
  if (item.event_type.startsWith("settlement.") && payload.fromName && payload.toName) {
    return t("settlement.line", {
      from: String(payload.fromName),
      to: String(payload.toName),
      amount: `${payload.amount ?? ""} ${payload.currency ?? ""}`.trim()
    });
  }
  const subject = item.subject_name || payload.participantName || payload.friendName;
  if (subject) return String(subject);
  if (payload.amount && payload.currency) return `${payload.amount} ${payload.currency}`;
  return "";
}

/** Localized context label, e.g. "Group: Trip" or "Friend: Bob". */
export function activityContext(item: ActivityFeedEvent, t: TranslateFn): string {
  if (!item.context_name) return "";
  if (item.context_type === "group") {
    return `${t("group.title")}: ${item.context_name}`;
  }
  if (item.context_type === "friend") {
    return `${t("friend.title")}: ${item.context_name}`;
  }
  return item.context_name;
}

export function activityIcon(eventType: string): string {
  if (eventType.startsWith("expense.")) return "receipt";
  if (eventType.startsWith("settlement.")) return "cash-check";
  if (eventType.startsWith("friend.")) return "account";
  if (eventType.startsWith("group.")) return "account-group";
  return "history";
}
