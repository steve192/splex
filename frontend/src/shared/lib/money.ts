import { Friend, Participant } from "../types/models";

type MoneyInput = string | number | undefined;

export function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function asNumber(value: MoneyInput): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: MoneyInput): string {
  return Math.abs(asNumber(value)).toFixed(2);
}

export function moneyValue(value: string): string {
  return value.trim().replace(",", ".");
}

export function balanceText(t: (key: string) => string, amount: string, currency: string): string {
  const numeric = asNumber(amount);
  if (numeric === 0) {
    return t("balance.settled");
  }
  const label = numeric > 0 ? t("balance.owedToYou") : t("balance.youOwe");
  return `${label} ${formatMoney(numeric)} ${currency}`;
}

/** Just the absolute amount and the currency, no "you owe / are owed" framing. */
export function plainAmountText(amount: MoneyInput, currency: string): string {
  return `${formatMoney(amount)} ${currency}`;
}

export function buildParticipantsForFriend(friend: Friend | null): Participant[] {
  if (!friend?.current_participant_id) return [];
  return [
    {
      id: friend.current_participant_id,
      display_name: "You",
      kind: "registered",
      user_id: null
    },
    {
      id: friend.participant_id,
      display_name: friend.display_name,
      avatar_url: friend.avatar_url,
      kind: "registered",
      user_id: null
    }
  ];
}
