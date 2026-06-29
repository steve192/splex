import { ReactNode, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  List,
  SegmentedButtons,
  Text,
  useTheme
} from "react-native-paper";
import { BarChart } from "react-native-gifted-charts";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { asNumber, plainAmountText } from "../lib/money";
import { EmptyState } from "../ui/EmptyState";
import { DatePickerSheet } from "../ui/DatePickerSheet";
import { LocationsMap } from "../ui/LocationsMap";
import { Screen } from "../ui/Screen";
import { styles } from "../ui/styles";
import {
  signedAmountLabel,
  statisticsEndpointWithRange,
  statisticsRangeForPeriod,
  StatisticsPeriod
} from "./statisticsModel";

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
  net: string;
}

interface PersonalSummary {
  participant_id: number;
  display_name: string;
  paid: string;
  share: string;
  net: string;
  covered_for_others: string;
  covered_by_others: string;
}

interface DescriptionTotalRow {
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

interface TopLocationRow {
  location: string;
  count: number;
  total: string;
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

interface MonthlyComparison {
  current_month: string;
  current_total: string;
  current_count: number;
  previous_month: string;
  previous_total: string;
  previous_count: number;
  change_amount: string;
  change_percent: string | null;
  average_active_month: string;
  highest_month: string | null;
  highest_month_total: string;
}

interface ParticipantActivityRow {
  participant_id: number;
  display_name: string;
  paid_expense_count: number;
  included_expense_count: number;
  created_expense_count: number;
}

interface StatisticsPayload {
  summary: Summary;
  monthly: MonthlyRow[];
  contributions: ContributionRow[];
  personal_summary: PersonalSummary | null;
  top_descriptions: DescriptionTotalRow[];
  biggest_expenses: BiggestExpenseRow[];
  locations: LocationRow[];
  top_locations: TopLocationRow[];
  day_of_week: DayOfWeekRow[];
  pair_stats: PairStatsRow[];
  monthly_comparison: MonthlyComparison;
  participant_activity: ParticipantActivityRow[];
}

interface StatisticsViewProps {
  endpoint: string;
  onExpensePress: (id: number) => void;
}

export function StatisticsView({ endpoint, onExpensePress }: Readonly<StatisticsViewProps>) {
  const { api } = useAuth();
  const { t, locale } = useI18n();
  const theme = useTheme();
  const [period, setPeriod] = useState<StatisticsPeriod>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedCustomRange, setAppliedCustomRange] = useState({ date_from: "", date_to: "" });
  const [activeCustomDate, setActiveCustomDate] = useState<"from" | "to" | null>(null);
  const [data, setData] = useState<StatisticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedRange = useMemo(
    () => statisticsRangeForPeriod(period, new Date(), appliedCustomRange),
    [appliedCustomRange, period]
  );
  const requestEndpoint = useMemo(
    () => statisticsEndpointWithRange(endpoint, selectedRange),
    [endpoint, selectedRange]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<StatisticsPayload>(requestEndpoint)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, requestEndpoint]);

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short" }),
    [locale]
  );
  const monthYearFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }),
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
  const weekdayLabels = useMemo(() => {
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return weekdayFormatter.format(d);
    });
  }, [weekdayFormatter]);

  const periodControls = (
    <PeriodControls
      period={period}
      customFrom={customFrom}
      customTo={customTo}
      onPeriodChange={setPeriod}
      onCustomFromChange={setCustomFrom}
      onCustomToChange={setCustomTo}
      activeCustomDate={activeCustomDate}
      onActiveCustomDateChange={setActiveCustomDate}
      onApplyCustom={() => {
        setPeriod("custom");
        setAppliedCustomRange({ date_from: customFrom, date_to: customTo });
      }}
      t={t}
    />
  );

  if (loading) {
    return (
      <Screen>
        {periodControls}
        <View style={statisticsStyles.loading}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!data || data.summary.expense_count === 0) {
    return (
      <Screen>
        {periodControls}
        <EmptyState text={t(period === "all" ? "statistics.noData" : "statistics.noDataForRange")} />
      </Screen>
    );
  }

  const {
    summary,
    monthly,
    contributions,
    personal_summary,
    top_descriptions,
    biggest_expenses,
    locations,
    top_locations,
    day_of_week,
    pair_stats,
    monthly_comparison,
    participant_activity
  } = data;
  const maxMonthly = monthly.reduce((max, row) => Math.max(max, asNumber(row.total)), 0);
  const maxContribution = contributions.reduce((max, row) => {
    return Math.max(max, asNumber(row.paid), asNumber(row.share), Math.abs(asNumber(row.net)));
  }, 0);
  const maxDayOfWeek = day_of_week.reduce((max, row) => Math.max(max, asNumber(row.total)), 0);
  const maxPairAmount = pair_stats.reduce((max, row) => Math.max(max, asNumber(row.amount)), 0);

  return (
    <Screen>
      {periodControls}

      {personal_summary ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <SectionTitle title={t("statistics.personalTitle")} hint={t("statistics.personalHint")} />
            <MetricGrid>
              <SummaryStat
                label={t("statistics.yourShare")}
                value={plainAmountText(personal_summary.share, summary.currency)}
              />
              <SummaryStat
                label={t("statistics.youPaid")}
                value={plainAmountText(personal_summary.paid, summary.currency)}
              />
              <SummaryStat
                label={t("statistics.yourNet")}
                value={signedAmountLabel(personal_summary.net, (amount) => plainAmountText(amount, summary.currency))}
                valueColor={netColor(personal_summary.net, theme.colors.primary, theme.colors.error)}
              />
            </MetricGrid>
            <Divider />
            <AmountRow
              label={t("statistics.coveredForOthers")}
              value={plainAmountText(personal_summary.covered_for_others, summary.currency)}
            />
            <AmountRow
              label={t("statistics.coveredByOthers")}
              value={plainAmountText(personal_summary.covered_by_others, summary.currency)}
            />
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.gap}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("statistics.summary")}
          </Text>
          <View>
            <Text variant="displaySmall" style={[statisticsStyles.total, { color: theme.colors.primary }]}>
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
          <MetricGrid>
            <SummaryStat label={t("statistics.expenseCount")} value={String(summary.expense_count)} />
            <SummaryStat
              label={t("statistics.average")}
              value={plainAmountText(summary.average_amount, summary.currency)}
            />
            <SummaryStat
              label={t("statistics.perWeek")}
              value={plainAmountText(summary.spend_per_week, summary.currency)}
            />
          </MetricGrid>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.gap}>
          <SectionTitle title={t("statistics.monthlyTitle")} hint={t("statistics.monthlyHint")} />
          <MetricGrid>
            <SummaryStat
              label={t("statistics.thisMonth")}
              value={plainAmountText(monthly_comparison.current_total, summary.currency)}
            />
            <SummaryStat
              label={t("statistics.previousMonth")}
              value={plainAmountText(monthly_comparison.previous_total, summary.currency)}
            />
            <SummaryStat
              label={t("statistics.monthlyChange")}
              value={signedAmountLabel(monthly_comparison.change_amount, (amount) =>
                plainAmountText(amount, summary.currency)
              )}
              valueColor={netColor(monthly_comparison.change_amount, theme.colors.error, theme.colors.primary)}
            />
            <SummaryStat
              label={t("statistics.activeMonthAverage")}
              value={plainAmountText(monthly_comparison.average_active_month, summary.currency)}
            />
          </MetricGrid>
          {monthly_comparison.highest_month ? (
            <AmountRow
              label={t("statistics.highestMonth", {
                month: monthYearFormatter.format(new Date(monthly_comparison.highest_month))
              })}
              value={plainAmountText(monthly_comparison.highest_month_total, summary.currency)}
            />
          ) : null}
          {maxMonthly === 0 ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("statistics.monthlyEmpty")}
            </Text>
          ) : (
            <ChartShell>
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
            </ChartShell>
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.gap}>
          <SectionTitle title={t("statistics.contributionsTitle")} hint={t("statistics.contributionsHint")} />
          <View style={statisticsStyles.rows}>
            {contributions.map((row) => (
              <ContributionBar
                key={row.participant_id}
                row={row}
                currency={summary.currency}
                max={maxContribution}
              />
            ))}
          </View>
        </Card.Content>
      </Card>

      {maxDayOfWeek > 0 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <SectionTitle title={t("statistics.dayOfWeekTitle")} hint={t("statistics.dayOfWeekHint")} />
            <ChartShell>
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
            </ChartShell>
          </Card.Content>
        </Card>
      ) : null}

      {participant_activity.length > 0 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <SectionTitle title={t("statistics.activityTitle")} hint={t("statistics.activityHint")} />
            <View style={statisticsStyles.rows}>
              {participant_activity.map((row) => (
                <View key={row.participant_id} style={statisticsStyles.activityRow}>
                  <Text variant="bodyMedium" style={statisticsStyles.rowTitle}>
                    {row.display_name}
                  </Text>
                  <View style={statisticsStyles.chipRow}>
                    <Chip compact>{t("statistics.createdCount", { count: row.created_expense_count })}</Chip>
                    <Chip compact>{t("statistics.paidCount", { count: row.paid_expense_count })}</Chip>
                    <Chip compact>{t("statistics.includedCount", { count: row.included_expense_count })}</Chip>
                  </View>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {top_descriptions.length > 0 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <SectionTitle title={t("statistics.topDescriptionsTitle")} hint={t("statistics.topDescriptionsHint")} />
            <View style={styles.chips}>
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

      <Card mode="elevated" style={styles.card}>
        <Card.Content style={[styles.gap, statisticsStyles.flushHorizontal]}>
          <Text variant="titleMedium" style={statisticsStyles.sectionPadding}>
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
                  style={[
                    statisticsStyles.rankBadge,
                    { backgroundColor: theme.colors.secondaryContainer }
                  ]}
                >
                  <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                    {index + 1}
                  </Text>
                </View>
              )}
              right={() => (
                <Text variant="titleSmall" style={statisticsStyles.listAmount}>
                  {plainAmountText(expense.amount, expense.currency)}
                </Text>
              )}
              onPress={() => onExpensePress(expense.id)}
            />
          ))}
        </Card.Content>
      </Card>

      {pair_stats.length > 0 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <SectionTitle title={t("statistics.pairsTitle")} hint={t("statistics.pairsHint")} />
            <View style={statisticsStyles.rows}>
              {pair_stats.map((row) => (
                <PairCoverageRow
                  key={`${row.payer_id}-${row.beneficiary_id}`}
                  row={row}
                  currency={summary.currency}
                  max={maxPairAmount}
                />
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {top_locations.length > 0 || locations.length > 0 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <SectionTitle
              title={t("statistics.locationsTitle")}
              hint={locations.length > 0 ? t("statistics.locationsHint", { count: locations.length }) : undefined}
            />
            {top_locations.map((row) => (
              <AmountRow
                key={row.location}
                label={row.location}
                detail={t("statistics.descriptionCount", { count: row.count })}
                value={plainAmountText(row.total, summary.currency)}
              />
            ))}
            {locations.length > 0 ? (
              <LocationsMap
                points={locations.map((loc) => ({
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  label: `${loc.description} - ${plainAmountText(loc.amount, loc.currency)}`
                }))}
              />
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      {summary.currency_breakdown.length > 1 ? (
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <SectionTitle title={t("statistics.currencyBreakdownTitle")} />
            <View style={statisticsStyles.rows}>
              {summary.currency_breakdown.map((row) => (
                <AmountRow
                  key={row.currency}
                  label={row.currency}
                  detail={t("statistics.descriptionCount", { count: row.count })}
                  value={plainAmountText(row.total, row.currency)}
                />
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}
    </Screen>
  );
}

function PeriodControls({
  period,
  customFrom,
  customTo,
  onPeriodChange,
  onCustomFromChange,
  onCustomToChange,
  activeCustomDate,
  onActiveCustomDateChange,
  onApplyCustom,
  t
}: Readonly<{
  period: StatisticsPeriod;
  customFrom: string;
  customTo: string;
  onPeriodChange: (period: StatisticsPeriod) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  activeCustomDate: "from" | "to" | null;
  onActiveCustomDateChange: (value: "from" | "to" | null) => void;
  onApplyCustom: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}>) {
  return (
    <>
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.gap}>
          <SegmentedButtons
            value={period}
            onValueChange={(value) => onPeriodChange(value as StatisticsPeriod)}
            buttons={[
              { value: "all", label: t("statistics.periodAll") },
              { value: "last12", label: t("statistics.periodLast12") },
              { value: "thisMonth", label: t("statistics.periodThisMonth") },
              { value: "lastMonth", label: t("statistics.periodLastMonth") },
              { value: "custom", label: t("statistics.periodCustom") }
            ]}
          />
          {period === "custom" ? (
            <View style={statisticsStyles.customRange}>
              <Button
                mode="outlined"
                icon="calendar-start"
                onPress={() => onActiveCustomDateChange("from")}
                style={statisticsStyles.dateButton}
              >
                {customFrom || t("statistics.dateFrom")}
              </Button>
              <Button
                mode="outlined"
                icon="calendar-end"
                onPress={() => onActiveCustomDateChange("to")}
                style={statisticsStyles.dateButton}
              >
                {customTo || t("statistics.dateTo")}
              </Button>
              <Button mode="contained" onPress={onApplyCustom}>
                {t("statistics.applyRange")}
              </Button>
            </View>
          ) : null}
        </Card.Content>
      </Card>
      <DatePickerSheet
        visible={activeCustomDate === "from"}
        value={customFrom}
        title={t("statistics.dateFrom")}
        onSelect={onCustomFromChange}
        onDismiss={() => onActiveCustomDateChange(null)}
      />
      <DatePickerSheet
        visible={activeCustomDate === "to"}
        value={customTo}
        title={t("statistics.dateTo")}
        onSelect={onCustomToChange}
        onDismiss={() => onActiveCustomDateChange(null)}
      />
    </>
  );
}

function SectionTitle({
  title,
  hint,
  horizontalPadding = false
}: Readonly<{ title: string; hint?: string; horizontalPadding?: boolean }>) {
  const theme = useTheme();
  return (
    <View style={horizontalPadding ? statisticsStyles.sectionPadding : undefined}>
      <Text variant="titleMedium">{title}</Text>
      {hint ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function MetricGrid({ children }: Readonly<{ children: ReactNode }>) {
  return <View style={statisticsStyles.metricGrid}>{children}</View>;
}

function SummaryStat({
  label,
  value,
  valueColor
}: Readonly<{ label: string; value: string; valueColor?: string }>) {
  const theme = useTheme();
  return (
    <View style={statisticsStyles.metric}>
      <Text variant="labelSmall" style={[statisticsStyles.metricLabel, { color: theme.colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Text variant="titleMedium" style={[statisticsStyles.metricValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

function AmountRow({
  label,
  detail,
  value
}: Readonly<{ label: string; detail?: string; value: string }>) {
  const theme = useTheme();
  return (
    <View style={statisticsStyles.amountRow}>
      <View style={statisticsStyles.amountLabel}>
        <Text variant="bodyMedium" style={statisticsStyles.rowTitle}>
          {label}
        </Text>
        {detail ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text variant="titleSmall" style={statisticsStyles.amountValue}>
        {value}
      </Text>
    </View>
  );
}

function PairCoverageRow({
  row,
  currency,
  max
}: Readonly<{ row: PairStatsRow; currency: string; max: number }>) {
  const theme = useTheme();
  const { t } = useI18n();
  const pct = max > 0 ? Math.max(0.04, Math.min(1, asNumber(row.amount) / max)) : 0;

  return (
    <View style={statisticsStyles.pairRow}>
      <View style={statisticsStyles.pairHeader}>
        <View style={statisticsStyles.pairPerson}>
          <InitialBadge name={row.payer_name} color={theme.colors.primaryContainer} />
          <View style={statisticsStyles.pairNameBlock}>
            <Text variant="bodyMedium" style={statisticsStyles.rowTitle}>
              {row.payer_name}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("statistics.pairPayer")}
            </Text>
          </View>
        </View>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {"->"}
        </Text>
        <View style={statisticsStyles.pairPerson}>
          <InitialBadge name={row.beneficiary_name} color={theme.colors.secondaryContainer} />
          <View style={statisticsStyles.pairNameBlock}>
            <Text variant="bodyMedium" style={statisticsStyles.rowTitle}>
              {row.beneficiary_name}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("statistics.pairBeneficiary")}
            </Text>
          </View>
        </View>
      </View>
      <View style={statisticsStyles.pairMeta}>
        <Text variant="titleSmall">{plainAmountText(row.amount, currency)}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t("statistics.descriptionCount", { count: row.count })}
        </Text>
      </View>
      <View style={[statisticsStyles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View
          style={[
            statisticsStyles.trackFill,
            { width: `${pct * 100}%`, backgroundColor: theme.colors.primary }
          ]}
        />
      </View>
    </View>
  );
}

function InitialBadge({ name, color }: Readonly<{ name: string; color: string }>) {
  return (
    <View style={[statisticsStyles.initialBadge, { backgroundColor: color }]}>
      <Text variant="labelMedium">{name.trim().slice(0, 1).toUpperCase() || "?"}</Text>
    </View>
  );
}

function ContributionBar({ row, currency, max }: Readonly<{ row: ContributionRow; currency: string; max: number }>) {
  const theme = useTheme();
  const paid = asNumber(row.paid);
  const share = asNumber(row.share);
  const net = asNumber(row.net);
  const paidPct = max > 0 ? Math.max(0, Math.min(1, paid / max)) : 0;
  const sharePct = max > 0 ? Math.max(0, Math.min(1, share / max)) : 0;
  const netColorValue = netColor(row.net, theme.colors.primary, theme.colors.error);
  const { t } = useI18n();

  return (
    <View style={statisticsStyles.contributionRow}>
      <View style={statisticsStyles.contributionHeader}>
        <Text variant="bodyMedium" style={statisticsStyles.rowTitle}>
          {row.display_name}
        </Text>
        <Chip compact textStyle={{ color: netColorValue }}>
          {signedAmountLabel(row.net, (amount) => plainAmountText(amount, currency))}
        </Chip>
      </View>
      <Stripe
        label={t("statistics.paid")}
        amountText={plainAmountText(row.paid, currency)}
        pct={paidPct}
        color={theme.colors.primary}
      />
      <Stripe
        label={t("statistics.share")}
        amountText={plainAmountText(row.share, currency)}
        pct={sharePct}
        color={theme.colors.tertiary}
      />
    </View>
  );
}

function Stripe({
  label,
  amountText,
  pct,
  color
}: Readonly<{
  label: string;
  amountText: string;
  pct: number;
  color: string;
}>) {
  const theme = useTheme();
  return (
    <View>
      <View style={statisticsStyles.stripeHeader}>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {label}
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {amountText}
        </Text>
      </View>
      <View style={[statisticsStyles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={[statisticsStyles.trackFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ChartShell({ children }: Readonly<{ children: ReactNode }>) {
  return <View style={statisticsStyles.chart}>{children}</View>;
}

function netColor(amount: string, positiveColor: string, negativeColor: string): string | undefined {
  const value = asNumber(amount);
  if (value > 0) return positiveColor;
  if (value < 0) return negativeColor;
  return undefined;
}

const statisticsStyles = StyleSheet.create({
  activityRow: {
    gap: 8
  },
  amountLabel: {
    flexShrink: 1,
    paddingRight: 12
  },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  amountValue: {
    textAlign: "right"
  },
  chart: {
    marginTop: 8
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  contributionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  contributionRow: {
    gap: 6
  },
  customRange: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  dateButton: {
    minWidth: 132
  },
  flushHorizontal: {
    paddingHorizontal: 0
  },
  listAmount: {
    alignSelf: "center",
    paddingRight: 16
  },
  loading: {
    alignItems: "center",
    paddingVertical: 32
  },
  metric: {
    minWidth: 116
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  },
  metricLabel: {
    textTransform: "uppercase"
  },
  metricValue: {
    marginTop: 2
  },
  initialBadge: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  pairHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  pairMeta: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  pairNameBlock: {
    flexShrink: 1
  },
  pairPerson: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0
  },
  pairRow: {
    gap: 8
  },
  rankBadge: {
    alignItems: "center",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    marginLeft: 8,
    width: 28
  },
  rowTitle: {
    fontWeight: "600"
  },
  rows: {
    gap: 12
  },
  sectionPadding: {
    paddingHorizontal: 16
  },
  stripeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2
  },
  total: {
    fontWeight: "700"
  },
  track: {
    borderRadius: 4,
    height: 8,
    overflow: "hidden"
  },
  trackFill: {
    height: "100%"
  }
});
