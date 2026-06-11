import { View } from "react-native";
import { Button, Card, List, Text, TouchableRipple, useTheme } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { asNumber, formatMoney } from "../lib/money";
import { BalanceDetail, GroupBalance } from "../types/models";
import { negativeColor, positiveColor } from "./colors";
import { PersonAvatar } from "./PersonAvatar";
import { styles } from "./styles";

/** Split an i18n template on a single placeholder so the value can be
 * rendered as a child Text node (allowing it to take a different colour).
 * Returns ``[before, after]``; if the placeholder is missing the whole
 * template ends up in ``before`` and ``after`` is empty.
 */
function splitTemplate(template: string, placeholder: string): [string, string] {
  const index = template.indexOf(placeholder);
  if (index < 0) return [template, ""];
  return [template.slice(0, index), template.slice(index + placeholder.length)];
}

type BalanceMemberCardProps = {
  row: GroupBalance;
  expanded: boolean;
  onToggle: () => void;
  onSettle: (detail: BalanceDetail) => void;
  /** Invoked when the user taps the card-level "Remind to settle" button.
   * The reminder targets ``row`` (the card owner) and is only available
   * when the row owner has net debt, is a registered user, and isn't the
   * currently signed-in user. */
  onRemindSettle?: (row: GroupBalance) => void;
  /** Splex participant id of the currently signed-in user.  Used to hide
   * the Remind button when the card belongs to the current user. */
  currentParticipantId?: number;
};

/** One participant's net balance for a group, expandable to show the
 * underlying who-owes-whom rows.  Each detail row has a "Settle" action
 * pinned to the right.  When the card owner has net debt, the card itself
 * exposes a "Remind to settle" action below the expansion content so it
 * stays visible in both the collapsed and expanded states.
 */
export function BalanceMemberCard({
  row,
  expanded,
  onToggle,
  onSettle,
  onRemindSettle,
  currentParticipantId
}: Readonly<BalanceMemberCardProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const total = asNumber(row.amount);
  let totalColor: string;
  let headerKey: string;
  if (total === 0) {
    totalColor = theme.colors.onSurfaceVariant;
    headerKey = "balance.personSettled";
  } else if (total > 0) {
    totalColor = positiveColor(theme);
    headerKey = "balance.isOwedAmount";
  } else {
    totalColor = negativeColor(theme);
    headerKey = "balance.owesAmount";
  }
  const headerTemplate = t(headerKey);
  const [headerBefore, headerAfter] = total === 0
    ? [headerTemplate, ""]
    : splitTemplate(headerTemplate, "{amount}");
  const ownerIsCurrentUser =
    currentParticipantId !== undefined && row.participant_id === currentParticipantId;
  const ownerUserId = row.user_id ?? null;
  // We can only push the owner of the card if they're a registered user with
  // net debt, and only when they're not the user looking at the screen.
  const canRemindOwner =
    Boolean(onRemindSettle) &&
    ownerUserId !== null &&
    !ownerIsCurrentUser &&
    total < 0;

  let expandedContent: React.ReactNode = null;
  if (expanded) {
    expandedContent = row.details.length ? (
      <View style={styles.balanceDetailList}>
        {row.details.map((detail) => (
          <BalanceDetailRow
            key={`${detail.from_participant_id}-${detail.to_participant_id}`}
            detail={detail}
            ownerParticipantId={row.participant_id}
            ownerDisplayName={row.display_name}
            currentParticipantId={currentParticipantId}
            onSettle={() => onSettle(detail)}
          />
        ))}
      </View>
    ) : (
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {t("balance.personSettled")}
      </Text>
    );
  }

  return (
    <Card mode="elevated" style={styles.balanceCard}>
      <TouchableRipple style={styles.clickable} onPress={onToggle} borderless>
        <Card.Content style={styles.balanceCardContent}>
          <View style={styles.balanceCardHeader}>
            <PersonAvatar name={row.display_name} imageUrl={row.avatar_url} size={40} />
            <View style={styles.flex}>
              <Text variant="titleMedium">{row.display_name}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {headerBefore}
                {total !== 0 && (
                  <Text variant="bodyMedium" style={[{ color: totalColor }, styles.bold]}>
                    {formatMoney(total)} {row.currency}
                  </Text>
                )}
                {headerAfter}
              </Text>
            </View>
            <List.Icon icon={expanded ? "chevron-up" : "chevron-down"} />
          </View>
          {expandedContent}
        </Card.Content>
      </TouchableRipple>
      {/* Card-level Remind action sits OUTSIDE the TouchableRipple so taps
          on the button don't also toggle the expansion.  Rendered in both
          collapsed and expanded states so the user can nudge the owner of
          the card without having to expand it first. */}
      {canRemindOwner ? (
        <Card.Actions>
          <Button
            mode="elevated"
            icon="bell-outline"
            onPress={() => onRemindSettle?.(row)}
          >
            {t("settlement.remindPerson", { person: row.display_name })}
          </Button>
        </Card.Actions>
      ) : null}
    </Card>
  );
}

type BalanceDetailRowProps = {
  detail: BalanceDetail;
  /** Participant id of the card owner this row is rendered inside.  Used to
   * decide whether the counterparty is the debtor or the creditor on this
   * row. */
  ownerParticipantId: number;
  /** Display name of the card owner.  Used by the third-party phrasing
   * (``"{owner} owes {person} {amount}"``) so the reader can see *who*
   * inside the row, instead of a confusing "you". */
  ownerDisplayName: string;
  /** Splex participant id of the currently signed-in user.  Only when the
   * card owner matches this id do we use "you" phrasing - otherwise we
   * fall back to third-person so the reader isn't told they themselves
   * owe money when they don't. */
  currentParticipantId?: number;
  onSettle: () => void;
};

function BalanceDetailRow({
  detail,
  ownerParticipantId,
  ownerDisplayName,
  currentParticipantId,
  onSettle
}: Readonly<BalanceDetailRowProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const counterpartyIsCreditor = detail.from_participant_id === ownerParticipantId;
  const counterpartyId = counterpartyIsCreditor
    ? detail.to_participant_id
    : detail.from_participant_id;
  const counterpartyName = counterpartyIsCreditor
    ? detail.to_display_name
    : detail.from_display_name;
  // Card owner pays → red.  Card owner receives → green.
  const color = counterpartyIsCreditor ? negativeColor(theme) : positiveColor(theme);
  const ownerIsCurrentUser =
    currentParticipantId !== undefined && ownerParticipantId === currentParticipantId;
  // Pick the phrasing that doesn't lie to the reader:
  //   - card owner is the current user → "you" forms ("You owe X", "X owes you")
  //   - otherwise → neutral third-person ("{owner} owes {person}",
  //     "{person} owes {owner}").
  let template: string;
  if (ownerIsCurrentUser) {
    template = t(
      counterpartyIsCreditor ? "balance.youOwePerson" : "balance.personOwesYou",
      { person: counterpartyName },
    );
  } else if (counterpartyIsCreditor) {
    template = t("balance.owesLine", {
      from: ownerDisplayName,
      to: counterpartyName,
      amount: "{amount}"
    });
  } else {
    template = t("balance.owesLine", {
      from: counterpartyName,
      to: ownerDisplayName,
      amount: "{amount}"
    });
  }
  const [before, after] = splitTemplate(template, "{amount}");
  return (
    <View style={styles.balanceDetailRow} key={counterpartyId}>
      <PersonAvatar name={counterpartyName} size={28} />
      <View style={styles.flex}>
        <Text variant="bodyMedium">
          {before}
          <Text variant="bodyMedium" style={[{ color }, styles.bold]}>
            {formatMoney(detail.amount)} {detail.currency}
          </Text>
          {after}
        </Text>
      </View>
      <Button mode="elevated" icon="cash-check" compact onPress={onSettle}>
        {t("settlement.settle")}
      </Button>
    </View>
  );
}
