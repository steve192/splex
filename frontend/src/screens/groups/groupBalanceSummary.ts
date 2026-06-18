import { asNumber } from "../../shared/lib/money";
import { BalanceDetail, GroupBalance } from "../../shared/types/models";

export type GroupBalanceSummary = {
  currency: string;
  incoming: BalanceDetail[];
  outgoing: BalanceDetail[];
  total: number;
};

export function buildBalanceSummary(
  balances: GroupBalance[],
  currentParticipantId: number | undefined,
  fallbackCurrency: string | undefined
): GroupBalanceSummary {
  const currentRow = balances.find((row) => row.participant_id === currentParticipantId);
  const details = currentRow?.details ?? [];
  const incoming = details.filter((detail) => detail.to_participant_id === currentParticipantId);
  const outgoing = details.filter((detail) => detail.from_participant_id === currentParticipantId);
  const incomingTotal = incoming.reduce((sum, detail) => sum + asNumber(detail.amount), 0);
  const outgoingTotal = outgoing.reduce((sum, detail) => sum + asNumber(detail.amount), 0);
  return {
    currency: currentRow?.currency ?? fallbackCurrency ?? "EUR",
    incoming,
    outgoing,
    total: incomingTotal - outgoingTotal
  };
}
