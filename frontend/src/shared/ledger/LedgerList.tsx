import { Button } from "react-native-paper";

import { appImages } from "../assets/images";
import { useI18n } from "../i18n/I18nContext";
import { LedgerItem } from "../types/models";
import { EmptyState } from "../ui/EmptyState";
import { ExpenseLedgerRow } from "../ui/ExpenseLedgerRow";
import { ledgerEmptyStateKey } from "./ledgerListState";
import { SettlementLedgerRow } from "./SettlementLedgerRow";

type LedgerListProps = {
  items: LedgerItem[];
  currentParticipantId?: number;
  onOpenExpense: (id: number) => void;
  onOpenSettlement: (id: number) => void;
  /** Whether a search term is active, to pick the right empty-state copy. */
  searching: boolean;
  /** Whether pending drafts are shown above; suppresses the empty state if so. */
  hasPending: boolean;
  nextOffset: number | null;
  loadingInitial: boolean;
  loadingMore: boolean;
  onLoadMore: (offset: number) => void;
};

/** The expenses/settlements list shared by the group and friend ledgers. */
export function LedgerList({
  items,
  currentParticipantId,
  onOpenExpense,
  onOpenSettlement,
  searching,
  hasPending,
  nextOffset,
  loadingInitial,
  loadingMore,
  onLoadMore
}: Readonly<LedgerListProps>) {
  const { t } = useI18n();
  const emptyStateKey = ledgerEmptyStateKey({
    hasPending,
    itemCount: items.length,
    loadingInitial,
    searching
  });

  return (
    <>
      {items.map((item, index) =>
        item.type === "expense" ? (
          <ExpenseLedgerRow
            key={`expense-${item.expense.id}`}
            expense={item.expense}
            currentParticipantId={currentParticipantId}
            onPress={() => onOpenExpense(item.expense.id)}
          />
        ) : (
          <SettlementLedgerRow
            key={`settlement-${item.settlement.id || index}`}
            settlement={item.settlement}
            onPress={() => onOpenSettlement(item.settlement.id)}
          />
        )
      )}
      {emptyStateKey ? <EmptyState image={appImages.emptyExpenses} text={t(emptyStateKey)} /> : null}
      {nextOffset !== null && items.length > 0 && (
        <Button mode="text" loading={loadingMore} onPress={() => onLoadMore(nextOffset)}>
          {t("activity.loadMore")}
        </Button>
      )}
    </>
  );
}
