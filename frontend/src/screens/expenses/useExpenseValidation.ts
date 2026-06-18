import { useMemo } from "react";

import { Participant, SplitMethod } from "../../shared/types/models";
import { computeExpenseValidation, ExpenseValidation } from "./expenseFormLogic";

type Input = {
  amount: string;
  splitMethod: SplitMethod;
  selectedParticipantIds: number[];
  splitValues: Record<number, string>;
  multiPayer: boolean;
  participants: Participant[];
  paymentValues: Record<number, string>;
};

/** Memoized {@link computeExpenseValidation} for the expense form. */
export function useExpenseValidation(input: Input): ExpenseValidation {
  const { amount, splitMethod, selectedParticipantIds, splitValues, multiPayer, participants, paymentValues } = input;
  return useMemo(
    () => computeExpenseValidation(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [amount, splitMethod, selectedParticipantIds, splitValues, multiPayer, participants, paymentValues]
  );
}
