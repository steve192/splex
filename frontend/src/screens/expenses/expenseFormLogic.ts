import { Participant, SplitMethod } from "../../shared/types/models";
import { asNumber, formatMoney, moneyValue } from "../../shared/lib/money";

export const SPLIT_TOLERANCE = 0.005;

export function splitEvenly(total: number, ids: number[]): Record<number, number> {
  const result: Record<number, number> = {};
  if (!ids.length) return result;
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / ids.length);
  let remainder = cents - base * ids.length;
  ids.forEach((id) => {
    const add = remainder > 0 ? 1 : 0;
    remainder -= add;
    result[id] = (base + add) / 100;
  });
  return result;
}

export function currencyAmount(value: number, currency: string): string {
  return `${formatMoney(value)} ${currency}`;
}

export function effectiveSplitMethod(
  splitMethod: SplitMethod,
  selectedAllParticipants: boolean
): SplitMethod {
  if (splitMethod === "equal_all" || splitMethod === "equal_selected") {
    return selectedAllParticipants ? "equal_all" : "equal_selected";
  }
  return splitMethod;
}

export function splitTabValue(splitMethod: SplitMethod): "equal" | "exact" | "percentage" | "adjusted_equal" {
  return splitMethod === "equal_all" || splitMethod === "equal_selected" ? "equal" : splitMethod;
}

export function perMemberShare({
  participantId,
  tabValue,
  selectedParticipantIds,
  selectedEqualShares,
  splitValues,
  totalAmount
}: {
  participantId: number;
  tabValue: "equal" | "exact" | "percentage" | "adjusted_equal";
  selectedParticipantIds: number[];
  selectedEqualShares: Record<number, number>;
  splitValues: Record<number, string>;
  totalAmount: number;
}): number {
  if (tabValue === "equal") {
    return selectedEqualShares[participantId] ?? 0;
  }
  if (tabValue === "exact") {
    return selectedParticipantIds.includes(participantId) ? asNumber(splitValues[participantId]) : 0;
  }
  if (tabValue === "percentage") {
    const percentage = selectedParticipantIds.includes(participantId) ? asNumber(splitValues[participantId]) : 0;
    return (totalAmount * percentage) / 100;
  }
  if (!selectedParticipantIds.includes(participantId)) return 0;
  const base = selectedEqualShares[participantId] ?? 0;
  return base + asNumber(splitValues[participantId]);
}

export function buildSplitPayload({
  method,
  selectedParticipantIds,
  splitValues
}: {
  method: SplitMethod;
  selectedParticipantIds: number[];
  splitValues: Record<number, string>;
}) {
  if (method === "equal_all") return undefined;
  if (method === "equal_selected") {
    return { participant_ids: selectedParticipantIds };
  }
  if (method === "exact") {
    return {
      shares: selectedParticipantIds.map((participantId) => ({
        participant_id: participantId,
        amount: moneyValue(splitValues[participantId] ?? "0")
      }))
    };
  }
  if (method === "percentage") {
    return {
      shares: selectedParticipantIds.map((participantId) => ({
        participant_id: participantId,
        percentage: moneyValue(splitValues[participantId] ?? "0")
      }))
    };
  }
  return {
    participant_ids: selectedParticipantIds,
    adjustments: selectedParticipantIds
      .filter((participantId) => splitValues[participantId])
      .map((participantId) => ({
        participant_id: participantId,
        amount: moneyValue(splitValues[participantId])
      }))
  };
}

export function buildPayments({
  multiPayer,
  participants,
  paymentValues,
  payerId,
  amount
}: {
  multiPayer: boolean;
  participants: Participant[];
  paymentValues: Record<number, string>;
  payerId: number | null;
  amount: string;
}) {
  if (multiPayer) {
    return participants
      .filter((participant) => paymentValues[participant.id])
      .map((participant) => ({
        participant_id: participant.id,
        amount: moneyValue(paymentValues[participant.id])
      }));
  }
  return payerId
    ? [
        {
          participant_id: payerId,
          amount: moneyValue(amount)
        }
      ]
    : undefined;
}
