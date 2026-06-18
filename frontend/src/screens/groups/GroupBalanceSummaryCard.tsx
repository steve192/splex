import { asNumber } from "../../shared/lib/money";
import { BalanceLine, BalanceSummaryCard } from "../../shared/ui/BalanceSummaryCard";
import { GroupBalanceSummary } from "./groupBalanceSummary";

type GroupBalanceSummaryCardProps = {
  summary: GroupBalanceSummary;
};

export function GroupBalanceSummaryCard({ summary }: Readonly<GroupBalanceSummaryCardProps>) {
  return (
    <BalanceSummaryCard
      total={summary.total}
      currency={summary.currency}
      detailLines={
        <>
          {summary.incoming.map((detail) => (
            <BalanceLine
              key={`incoming-${detail.from_participant_id}-${detail.to_participant_id}`}
              variant="incoming"
              person={detail.from_display_name}
              amount={String(asNumber(detail.amount))}
              currency={detail.currency}
            />
          ))}
          {summary.outgoing.map((detail) => (
            <BalanceLine
              key={`outgoing-${detail.from_participant_id}-${detail.to_participant_id}`}
              variant="outgoing"
              person={detail.to_display_name}
              amount={String(asNumber(detail.amount))}
              currency={detail.currency}
            />
          ))}
        </>
      }
    />
  );
}
