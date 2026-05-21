import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { OverviewStackParamList } from "../../application/navigationTypes";
import { StatisticsView } from "../../shared/statistics/StatisticsView";

type Props = NativeStackScreenProps<OverviewStackParamList, "FriendStatistics">;

export function FriendStatisticsScreen({ route, navigation }: Props) {
  const friendshipId = route.params.id;
  return (
    <StatisticsView
      endpoint={`/api/friends/${friendshipId}/statistics/`}
      onExpensePress={(id) => navigation.navigate("ExpenseDetail", { id })}
    />
  );
}
