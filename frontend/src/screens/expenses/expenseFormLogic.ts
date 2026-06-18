import { Participant, SplitMethod } from "../../shared/types/models";
import { asNumber, formatMoney, moneyValue } from "../../shared/lib/money";

export const SPLIT_TOLERANCE = 0.005;
export type SplitTab = "equal" | "exact" | "percentage" | "adjusted_equal";

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

export function normalizeExpenseAmountInput(value: string): string {
  const filtered = value.replaceAll(/[^0-9.,]/g, "");
  const normalized = filtered.replaceAll(",", ".");
  const parts = normalized.split(".");
  return parts.length <= 2 ? normalized : parts[0] + "." + parts.slice(1).join("");
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

export function splitTabValue(splitMethod: SplitMethod): SplitTab {
  return splitMethod === "equal_all" || splitMethod === "equal_selected" ? "equal" : splitMethod;
}

type HydratedSplit = {
  selectedParticipantIds: number[];
  splitValues: Record<number, string>;
};

type ShareItem = { participant_id: number; amount?: number | string; percentage?: number | string };

type SplitStrategy = {
  buildPayload(args: {
    selectedParticipantIds: number[];
    splitValues: Record<number, string>;
  }): Record<string, unknown> | undefined;
  hydrate(payload: Record<string, unknown> | undefined): Partial<HydratedSplit>;
  perMemberShare(args: {
    participantId: number;
    selectedParticipantIds: number[];
    selectedEqualShares: Record<number, number>;
    splitValues: Record<number, string>;
    totalAmount: number;
  }): number;
};

const equalShare = ({ participantId, selectedEqualShares }: { participantId: number; selectedEqualShares: Record<number, number> }) =>
  selectedEqualShares[participantId] ?? 0;

const equalStrategy: SplitStrategy = {
  buildPayload: () => undefined,
  hydrate: () => ({}),
  perMemberShare: equalShare
};

const equalSelectedStrategy: SplitStrategy = {
  buildPayload: ({ selectedParticipantIds }) => ({ participant_ids: selectedParticipantIds }),
  hydrate: (payload) => {
    const participantIds = ((payload?.participant_ids as number[] | undefined) ?? []).filter(Boolean);
    return participantIds.length ? { selectedParticipantIds: participantIds } : {};
  },
  perMemberShare: equalShare
};

const exactStrategy: SplitStrategy = {
  buildPayload: ({ selectedParticipantIds, splitValues }) => ({
    shares: selectedParticipantIds.map((participantId) => ({
      participant_id: participantId,
      amount: moneyValue(splitValues[participantId] ?? "0")
    }))
  }),
  hydrate: (payload) => {
    const shares = ((payload?.shares as ShareItem[] | undefined) ?? []);
    return {
      selectedParticipantIds: shares.map((share) => share.participant_id),
      splitValues: Object.fromEntries(shares.map((share) => [share.participant_id, String(share.amount ?? "")]))
    };
  },
  perMemberShare: ({ participantId, selectedParticipantIds, splitValues }) =>
    selectedParticipantIds.includes(participantId) ? asNumber(splitValues[participantId]) : 0
};

const percentageStrategy: SplitStrategy = {
  buildPayload: ({ selectedParticipantIds, splitValues }) => ({
    shares: selectedParticipantIds.map((participantId) => ({
      participant_id: participantId,
      percentage: moneyValue(splitValues[participantId] ?? "0")
    }))
  }),
  hydrate: (payload) => {
    const shares = ((payload?.shares as ShareItem[] | undefined) ?? []);
    return {
      selectedParticipantIds: shares.map((share) => share.participant_id),
      splitValues: Object.fromEntries(shares.map((share) => [share.participant_id, String(share.percentage ?? "")]))
    };
  },
  perMemberShare: ({ participantId, selectedParticipantIds, splitValues, totalAmount }) => {
    const percentage = selectedParticipantIds.includes(participantId) ? asNumber(splitValues[participantId]) : 0;
    return (totalAmount * percentage) / 100;
  }
};

const adjustedEqualStrategy: SplitStrategy = {
  buildPayload: ({ selectedParticipantIds, splitValues }) => ({
    participant_ids: selectedParticipantIds,
    adjustments: selectedParticipantIds
      .filter((participantId) => splitValues[participantId])
      .map((participantId) => ({
        participant_id: participantId,
        amount: moneyValue(splitValues[participantId])
      }))
  }),
  hydrate: (payload) => {
    const adjustments = ((payload?.adjustments as ShareItem[] | undefined) ?? []);
    return {
      splitValues: Object.fromEntries(
        adjustments.map((share) => [share.participant_id, String(share.amount ?? "")])
      )
    };
  },
  perMemberShare: ({ participantId, selectedParticipantIds, splitValues, totalAmount }) => {
    if (!selectedParticipantIds.includes(participantId)) return 0;
    const sumAdjustments = selectedParticipantIds.reduce(
      (sum, id) => sum + asNumber(splitValues[id]),
      0
    );
    const baseShares = splitEvenly(totalAmount - sumAdjustments, selectedParticipantIds);
    return (baseShares[participantId] ?? 0) + asNumber(splitValues[participantId]);
  }
};

export const splitStrategies: Record<SplitMethod, SplitStrategy> = {
  equal_all: equalStrategy,
  equal_selected: equalSelectedStrategy,
  exact: exactStrategy,
  percentage: percentageStrategy,
  adjusted_equal: adjustedEqualStrategy
};

export function buildSplitPayload({
  method,
  selectedParticipantIds,
  splitValues
}: {
  method: SplitMethod;
  selectedParticipantIds: number[];
  splitValues: Record<number, string>;
}) {
  return splitStrategies[method].buildPayload({ selectedParticipantIds, splitValues });
}

export function hydrateSplit(
  method: SplitMethod,
  payload: Record<string, unknown> | undefined
): Partial<HydratedSplit> {
  return splitStrategies[method].hydrate(payload);
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
  tabValue: SplitTab;
  selectedParticipantIds: number[];
  selectedEqualShares: Record<number, number>;
  splitValues: Record<number, string>;
  totalAmount: number;
}): number {
  const method: SplitMethod = tabValue === "equal" ? "equal_all" : tabValue;
  return splitStrategies[method].perMemberShare({
    participantId,
    selectedParticipantIds,
    selectedEqualShares,
    splitValues,
    totalAmount
  });
}

export type ExpenseValidation = {
  totalAmount: number;
  tabValue: SplitTab;
  selectedEqualShares: Record<number, number>;
  exactLeft: number;
  percentageLeft: number;
  adjustedHasNegativeShare: boolean;
  /** True when the chosen split does not add up and the expense cannot be saved. */
  splitConfigInvalid: boolean;
  paymentLeft: number;
  /** True when multiple payers are set but their amounts do not sum to the total. */
  paymentConfigInvalid: boolean;
};

/**
 * Derives every split/payment figure and validity flag the expense form needs
 * from the raw form values. Pure so it can be unit-tested and memoized.
 */
export function computeExpenseValidation({
  amount,
  splitMethod,
  selectedParticipantIds,
  splitValues,
  multiPayer,
  participants,
  paymentValues
}: {
  amount: string;
  splitMethod: SplitMethod;
  selectedParticipantIds: number[];
  splitValues: Record<number, string>;
  multiPayer: boolean;
  participants: Participant[];
  paymentValues: Record<number, string>;
}): ExpenseValidation {
  const totalAmount = asNumber(amount);
  const tabValue = splitTabValue(splitMethod);
  const selectedEqualShares = splitEvenly(totalAmount, selectedParticipantIds);

  const distributedSplit = selectedParticipantIds.reduce((sum, id) => sum + asNumber(splitValues[id]), 0);
  const exactLeft = totalAmount - distributedSplit;
  const percentageLeft = 100 - distributedSplit;

  const adjustedHasNegativeShare =
    tabValue === "adjusted_equal" &&
    selectedParticipantIds.some(
      (id) =>
        perMemberShare({
          participantId: id,
          tabValue,
          selectedParticipantIds,
          selectedEqualShares,
          splitValues,
          totalAmount
        }) < -SPLIT_TOLERANCE
    );

  let splitConfigInvalid: boolean;
  if (!selectedParticipantIds.length) splitConfigInvalid = true;
  else if (tabValue === "equal") splitConfigInvalid = false;
  else if (tabValue === "exact") splitConfigInvalid = Math.abs(exactLeft) > SPLIT_TOLERANCE;
  else if (tabValue === "percentage") splitConfigInvalid = Math.abs(percentageLeft) > SPLIT_TOLERANCE;
  else splitConfigInvalid = adjustedHasNegativeShare;

  const distributedPayments = participants.reduce((sum, participant) => sum + asNumber(paymentValues[participant.id]), 0);
  const paymentLeft = multiPayer ? totalAmount - distributedPayments : 0;
  const paymentConfigInvalid = multiPayer ? Math.abs(paymentLeft) > SPLIT_TOLERANCE : false;

  return {
    totalAmount,
    tabValue,
    selectedEqualShares,
    exactLeft,
    percentageLeft,
    adjustedHasNegativeShare,
    splitConfigInvalid,
    paymentLeft,
    paymentConfigInvalid
  };
}

type PaymentApplier = {
  setMultiPayer: (value: boolean) => void;
  setPaymentValues: (values: Record<number, string>) => void;
  setPayerId: (id: number | null) => void;
};

export function applyPaymentsToForm(
  payments: Array<{ participant_id: number; amount: string }> | undefined,
  setters: PaymentApplier
) {
  const list = payments ?? [];
  if (list.length > 1) {
    setters.setMultiPayer(true);
    setters.setPaymentValues(Object.fromEntries(list.map((share) => [share.participant_id, share.amount])));
    return;
  }
  setters.setMultiPayer(false);
  setters.setPayerId(list[0]?.participant_id ?? null);
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
