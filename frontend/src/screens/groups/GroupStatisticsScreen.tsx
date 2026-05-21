import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { OverviewStackParamList } from "../../application/navigationTypes";
import { StatisticsView } from "../../shared/statistics/StatisticsView";

type Props = NativeStackScreenProps<OverviewStackParamList, "GroupStatistics">;

export function GroupStatisticsScreen({ route, navigation }: Props) {
  const groupId = route.params.id;
  return (
    <StatisticsView
      endpoint={`/api/groups/${groupId}/statistics/`}
      onExpensePress={(id) => navigation.navigate("ExpenseDetail", { id })}
    />
  );
}
