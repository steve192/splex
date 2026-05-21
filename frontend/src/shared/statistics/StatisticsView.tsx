import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { ActivityIndicator, Card, Chip, Divider, List, Text, useTheme } from "react-native-paper";
import { BarChart } from "react-native-gifted-charts";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { asNumber, formatMoney, plainAmountText } from "../lib/money";
import { EmptyState } from "../ui/EmptyState";
import { LocationsMap } from "../ui/LocationsMap";
import { Screen } from "../ui/Screen";
import { styles } from "../ui/styles";

interface CurrencyBreakdownRow {
  currency: string;
  total: string;
  count: number;
}

interface Summary {
  currency: string;
  total_amount: string;
  expense_count: number;
  average_amount: string;
  first_expense_date: string | null;
  last_expense_date: string | null;
  spend_per_week: string;
  currency_breakdown: CurrencyBreakdownRow[];
}

interface MonthlyRow {
  month: string;
  total: string;
}

interface ContributionRow {
  participant_id: number;
  display_name: string;
  paid: string;
  share: string;
}

interface TopDescriptionRow {
  description: string;
  count: number;
  total: string;
}

interface BiggestExpenseRow {
  id: number;
  description: string;
  amount: string;
  currency: string;
  converted_amount: string;
  converted_currency: string;
  date: string;
}

interface LocationRow {
  id: number;
  description: string;
  latitude: number;
  longitude: number;
  amount: string;
  currency: string;
  date: string;
}

interface DayOfWeekRow {
  weekday: number;
  count: number;
  total: string;
}

interface PairStatsRow {
  payer_id: number;
  payer_name: string;
  beneficiary_id: number;
  beneficiary_name: string;
  count: number;
  amount: string;
}

interface StatisticsPayload {
  summary: Summary;
  monthly: MonthlyRow[];
  contributions: ContributionRow[];
  top_descriptions: TopDescriptionRow[];
  biggest_expenses: BiggestExpenseRow[];
  locations: LocationRow[];
  day_of_week: DayOfWeekRow[];
  pair_stats: PairStatsRow[];
}

interface StatisticsViewProps {
  endpoint: string;
  onExpensePress: (id: number) => void;
}

export function StatisticsView({ endpoint, onExpensePress }: StatisticsViewProps) {
  const { api } = useAuth();
  const { t, locale } = useI18n();
  const theme = useTheme();
  const [data, setData] = useState<StatisticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<StatisticsPayload>(endpoint)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, endpoint]);

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short" }),
    [locale]
  );
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short" }),
    [locale]
  );
  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }),
    [locale]
  );
  // Build weekday labels in the user's locale. weekday=0 → Monday → reference date 2024-01-01 was a Monday.
  const weekdayLabels = useMemo(() => {
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return weekdayFormatter.format(d);
    });
  }, [weekdayFormatter]);

  if (loading) {
    return (
      <Screen>
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!data || data.summary.expense_count === 0) {
    return (
      <Screen>
        <EmptyState text={t("statistics.noData")} />
      </Screen>
    );
  }

  const { summary, monthly, contributions, top_descriptions, biggest_expenses, locations, day_of_week, pair_stats } = data;
  const maxMonthly = monthly.reduce((max, row) => Math.max(max, asNumber(row.total)), 0);
  const maxContribution = contributions.reduce(
    (max, row) => Math.max(max, asNumber(row.paid), asNumber(row.share)),
    0
  );
  const maxDayOfWeek = day_of_week.reduce((max, row) => Math.max(max, asNumber(row.total)), 0);

  return (
    <Screen>
      {/* Summary card */}
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.gap}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("statistics.summary")}
          </Text>
          <View>
            <Text variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: "700" }}>
              {plainAmountText(summary.total_amount, summary.currency)}
            </Text>
            {summary.first_expense_date && summary.last_expense_date ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {t("statistics.dateRange", {
                  first: fullDateFormatter.format(new Date(summary.first_expense_date)),
                  last: fullDateFormatter.format(new Date(summary.last_expense_date))
                })}
              </Text>
            ) : null}
          </View>
          <Divider />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <SummaryStat label={t("statistics.expenseCount")} value={String(summary.expense_count)} />
            <SummaryStat
              label={t("statistics.average")}
              value={plainAmountText(summary.average_amount, summary.currency)}
            />
            <SummaryStat
              label={t("statistics.perWeek")}
              value={plainAmountText(summary.spend_per_week, summary.currency)}
            />
          </View>
        </Card.Content>
      </Card>

      {/* Monthly chart card */}
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">{t("statistics.monthlyTitle")}</Text>
          {maxMonthly === 0 ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("statistics.monthlyEmpty")}
            </Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              <BarChart
                data={monthly.map((row) => ({
                  value: asNumber(row.total),
                  label: monthFormatter.format(new Date(row.month)),
                  frontColor: theme.colors.primary
                }))}
                barWidth={18}
                spacing={10}
                initialSpacing={8}
                noOfSections={4}
                yAxisColor={theme.colors.outlineVariant}
                xAxisColor={theme.colors.outlineVariant}
                yAxisTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                rulesColor={theme.colors.outlineVariant}
                hideRules={false}
                isAnimated
              />
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Contributions card */}
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">{t("statistics.contributionsTitle")}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("statistics.contributionsHint")}
          </Text>
          <View style={{ gap: 14, marginTop: 4 }}>
            {contributions.map((row) => (
              <ContributionBar
                key={row.participant_id}
                row={row}
                currency={summary.currency}
                max={maxContribution}
                paidColor={theme.colors.primary}
                shareColor={theme.colors.tertiary}
                trackColor={theme.colors.surfaceVariant}
                labelColor={theme.colors.onSurfaceVariant}
                t={t}
              />
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Day of week chart card */}
      {maxDayOfWeek > 0 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("statistics.dayOfWeekTitle")}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("statistics.dayOfWeekHint")}
            </Text>
            <View style={{ marginTop: 8 }}>
              <BarChart
                data={day_of_week.map((row) => ({
                  value: asNumber(row.total),
                  label: weekdayLabels[row.weekday] ?? "",
                  frontColor: theme.colors.secondary
                }))}
                barWidth={28}
                spacing={14}
                initialSpacing={8}
                noOfSections={4}
                yAxisColor={theme.colors.outlineVariant}
                xAxisColor={theme.colors.outlineVariant}
                yAxisTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                rulesColor={theme.colors.outlineVariant}
                hideRules={false}
                isAnimated
              />
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {/* Top descriptions card */}
      {top_descriptions.length > 0 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("statistics.topDescriptionsTitle")}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("statistics.topDescriptionsHint")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {top_descriptions.map((row) => (
                <Chip key={row.description} icon="tag-outline" compact>
                  {row.description} · {t("statistics.descriptionCount", { count: row.count })} ·{" "}
                  {plainAmountText(row.total, summary.currency)}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {/* Biggest expenses card */}
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={[styles.gap, { paddingHorizontal: 0 }]}>
          <Text variant="titleMedium" style={{ paddingHorizontal: 16 }}>
            {t("statistics.biggestTitle")}
          </Text>
          {biggest_expenses.map((expense, index) => (
            <List.Item
              key={expense.id}
              title={expense.description}
              description={fullDateFormatter.format(new Date(expense.date))}
              left={(props) => (
                <View
                  {...props}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: theme.colors.secondaryContainer,
                    justifyContent: "center",
                    alignItems: "center",
                    marginLeft: 8
                  }}
                >
                  <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                    {index + 1}
                  </Text>
                </View>
              )}
              right={() => (
                <Text variant="titleSmall" style={{ alignSelf: "center" }}>
                  {plainAmountText(expense.amount, expense.currency)}
                </Text>
              )}
              onPress={() => onExpensePress(expense.id)}
            />
          ))}
        </Card.Content>
      </Card>

      {/* Pair stats card */}
      {pair_stats.length > 0 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("statistics.pairsTitle")}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("statistics.pairsHint")}
            </Text>
            <View style={{ gap: 10, marginTop: 4 }}>
              {pair_stats.map((row) => (
                <View
                  key={`${row.payer_id}-${row.beneficiary_id}`}
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <View style={{ flexShrink: 1, paddingRight: 12 }}>
                    <Text variant="bodyMedium">
                      {t("statistics.pairsLine", {
                        payer: row.payer_name,
                        beneficiary: row.beneficiary_name
                      })}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t("statistics.descriptionCount", { count: row.count })}
                    </Text>
                  </View>
                  <Text variant="titleSmall">{plainAmountText(row.amount, summary.currency)}</Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {/* Locations map card */}
      {locations.length > 0 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("statistics.locationsTitle")}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("statistics.locationsHint", { count: locations.length })}
            </Text>
            <LocationsMap
              points={locations.map((loc) => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
                label: `${loc.description} — ${plainAmountText(loc.amount, loc.currency)}`
              }))}
            />
          </Card.Content>
        </Card>
      ) : null}

      {/* Currency breakdown — only when more than one currency */}
      {summary.currency_breakdown.length > 1 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("statistics.currencyBreakdownTitle")}</Text>
            <View style={{ gap: 4 }}>
              {summary.currency_breakdown.map((row) => (
                <View
                  key={row.currency}
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Text variant="bodyMedium">{row.currency}</Text>
                  <Text variant="bodyMedium">{formatMoney(row.total)}</Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}
    </Screen>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ minWidth: 100 }}>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text variant="titleMedium" style={{ marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

interface ContributionBarProps {
  row: ContributionRow;
  currency: string;
  max: number;
  paidColor: string;
  shareColor: string;
  trackColor: string;
  labelColor: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function ContributionBar({
  row,
  currency,
  max,
  paidColor,
  shareColor,
  trackColor,
  labelColor,
  t
}: ContributionBarProps) {
  const paid = asNumber(row.paid);
  const share = asNumber(row.share);
  const paidPct = max > 0 ? Math.max(0, Math.min(1, paid / max)) : 0;
  const sharePct = max > 0 ? Math.max(0, Math.min(1, share / max)) : 0;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="bodyMedium" style={{ fontWeight: "600" }}>
          {row.display_name}
        </Text>
      </View>
      <Stripe
        label={t("statistics.paid")}
        amountText={plainAmountText(row.paid, currency)}
        pct={paidPct}
        color={paidColor}
        trackColor={trackColor}
        labelColor={labelColor}
      />
      <Stripe
        label={t("statistics.share")}
        amountText={plainAmountText(row.share, currency)}
        pct={sharePct}
        color={shareColor}
        trackColor={trackColor}
        labelColor={labelColor}
      />
    </View>
  );
}

function Stripe({
  label,
  amountText,
  pct,
  color,
  trackColor,
  labelColor
}: {
  label: string;
  amountText: string;
  pct: number;
  color: string;
  trackColor: string;
  labelColor: string;
}) {
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
        <Text variant="labelSmall" style={{ color: labelColor }}>
          {label}
        </Text>
        <Text variant="labelSmall" style={{ color: labelColor }}>
          {amountText}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: trackColor, borderRadius: 4, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: color }} />
      </View>
    </View>
  );
}
