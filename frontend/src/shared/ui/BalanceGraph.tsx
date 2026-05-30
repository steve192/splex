import { useMemo } from "react";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Svg, { Defs, Marker, Path, Polygon } from "react-native-svg";

import { useI18n } from "../i18n/I18nContext";
import { formatMoney } from "../lib/money";
import { GroupBalance } from "../types/models";
import {
  AVATAR_SIZE,
  CANVAS_SIZE,
  buildArcPath,
  buildGraphModel
} from "./balanceGraphModel";
import { PersonAvatar } from "./PersonAvatar";

const AVATAR_RADIUS = AVATAR_SIZE / 2;

type BalanceGraphProps = {
  /** Balance rows for every participant.  We render one node per member with
   * a non-zero balance OR with at least one detail edge - members fully
   * settled and missing from every detail row are dropped. */
  rows: GroupBalance[];
};

/** Visualises pair-wise debts as a directed graph: each member is a circular
 * avatar laid out around a ring, arrows curve from debtor to creditor with
 * the amount printed on the arc.  Best at 2-6 members; still legible up to
 * ~10, after which the arc bow starts overlapping.
 */
export function BalanceGraph({ rows }: BalanceGraphProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const { members, edges } = useMemo(() => buildGraphModel(rows), [rows]);

  if (members.length < 2 || edges.length === 0) {
    return null;
  }

  const arrowColor = theme.colors.onSurface;
  const labelColor = theme.colors.onSurface;
  const labelBg = theme.colors.surfaceVariant;
  const arcs = edges
    .map((edge) => {
      const from = members.find((m) => m.id === edge.fromId);
      const to = members.find((m) => m.id === edge.toId);
      if (!from || !to) return null;
      return { edge, from, to, ...buildArcPath(from, to, CANVAS_SIZE / 2) };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <View style={{ alignItems: "center" }}>
      <Text
        variant="titleMedium"
        style={{ alignSelf: "flex-start", color: theme.colors.onSurface }}
      >
        {t("balance.graphTitle")}
      </Text>
      <View style={{ height: CANVAS_SIZE, width: CANVAS_SIZE }}>
        <Svg width={CANVAS_SIZE} height={CANVAS_SIZE}>
          <Defs>
            <Marker
              id="arrowhead"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              // ``orient="auto"`` rotates the marker to follow the path's
              // tangent at the attachment point.  The SVG 2 ``auto-start-reverse``
              // keyword crashes on Android (react-native-svg's MarkerView
              // tries ``Double.parseDouble("auto-start-reverse")``), and we
              // only ever use this marker via ``markerEnd`` so the reverse
              // semantics aren't needed.
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <Polygon points="0,0 10,5 0,10" fill={arrowColor} />
            </Marker>
          </Defs>
          {arcs.map((arc) => (
            <Path
              key={`${arc.edge.fromId}-${arc.edge.toId}`}
              d={arc.d}
              stroke={arrowColor}
              strokeWidth={2}
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          ))}
        </Svg>
        {members.map((member) => (
          <View
            key={member.id}
            style={{
              alignItems: "center",
              position: "absolute",
              left: member.x - AVATAR_RADIUS,
              top: member.y - AVATAR_RADIUS,
              width: AVATAR_SIZE
            }}
          >
            <PersonAvatar
              name={member.name}
              imageUrl={member.avatarUrl}
              size={AVATAR_SIZE}
            />
            <Text
              variant="labelSmall"
              numberOfLines={1}
              style={{
                color: theme.colors.onSurface,
                marginTop: 2,
                maxWidth: AVATAR_SIZE + 32,
                textAlign: "center"
              }}
            >
              {member.name}
            </Text>
          </View>
        ))}
        {arcs.map((arc) => (
          // Centering wrapper: fixed-width "lane" around the arc midpoint so
          // the inner pill can grow with the number and still stay centred on
          // the curve.  Currency is omitted (every edge in a group shares
          // the same currency anyway), and the lane is wide enough to hold
          // up to ~7-character amounts without clipping.
          <View
            key={`label-${arc.edge.fromId}-${arc.edge.toId}`}
            pointerEvents="none"
            style={{
              alignItems: "center",
              left: arc.labelX - 60,
              position: "absolute",
              top: arc.labelY - 10,
              width: 120
            }}
          >
            <View
              style={{
                backgroundColor: labelBg,
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 1
              }}
            >
              <Text
                variant="labelSmall"
                numberOfLines={1}
                style={{ color: labelColor }}
              >
                {formatMoney(arc.edge.amount)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
