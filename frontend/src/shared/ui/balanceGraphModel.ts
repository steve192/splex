/**
 * Pure layout maths for the balance graph - kept out of the React component
 * file so it can be unit-tested without pulling in react-native.
 */
import { asNumber } from "../lib/money";
import { GroupBalance } from "../types/models";

export const CANVAS_SIZE = 320;
export const AVATAR_SIZE = 44;
const AVATAR_RADIUS = AVATAR_SIZE / 2;
export const RING_RADIUS = (CANVAS_SIZE - AVATAR_SIZE) / 2 - 24;
export const ARC_BOW = 38;
export const ARROW_INSET = AVATAR_RADIUS + 4;

export type Edge = {
  fromId: number;
  toId: number;
  amount: number;
  currency: string;
};

export type PositionedMember = {
  id: number;
  name: string;
  avatarUrl?: string;
  x: number;
  y: number;
};

export type GraphModel = {
  members: PositionedMember[];
  edges: Edge[];
};

/** Convert ``GroupBalance[]`` into ``{ members, edges }`` ready for rendering.
 *
 * Per-participant details on the API include both ends of every debt, so the
 * builder deduplicates by directed pair. Members fully settled and absent
 * from every edge are dropped to keep the graph readable. Members are placed
 * around a fixed ring, sorted by participant id for deterministic layout.
 */
export function buildGraphModel(rows: GroupBalance[]): GraphModel {
  const edgesByPair = new Map<string, Edge>();
  for (const row of rows) {
    for (const detail of row.details) {
      const amount = asNumber(detail.amount);
      if (amount <= 0) continue;
      const key = `${detail.from_participant_id}-${detail.to_participant_id}`;
      if (edgesByPair.has(key)) continue;
      edgesByPair.set(key, {
        fromId: detail.from_participant_id,
        toId: detail.to_participant_id,
        amount,
        currency: detail.currency
      });
    }
  }
  const edges = Array.from(edgesByPair.values());

  const activeIds = new Set<number>();
  for (const edge of edges) {
    activeIds.add(edge.fromId);
    activeIds.add(edge.toId);
  }
  const activeRows = rows.filter(
    (row) => activeIds.has(row.participant_id) || asNumber(row.amount) !== 0
  );
  activeRows.sort((a, b) => a.participant_id - b.participant_id);

  const center = CANVAS_SIZE / 2;
  const ring = activeRows.length <= 1 ? 0 : RING_RADIUS;
  const startAngle = -Math.PI / 2;
  const members: PositionedMember[] = activeRows.map((row, index) => {
    const angle =
      activeRows.length <= 1
        ? startAngle
        : startAngle + (index * 2 * Math.PI) / activeRows.length;
    return {
      id: row.participant_id,
      name: row.display_name,
      avatarUrl: row.avatar_url,
      x: center + ring * Math.cos(angle),
      y: center + ring * Math.sin(angle)
    };
  });
  return { members, edges };
}

export type ArcResult = { d: string; labelX: number; labelY: number };

/** Compute the SVG path and label position for a curved arrow from ``from`` to
 * ``to``. The arc bows outward from the canvas centre, keeping it clear of
 * avatars at the centre of a small group.
 */
export function buildArcPath(
  from: PositionedMember,
  to: PositionedMember,
  centerXy: number
): ArcResult {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const startX = from.x + ux * ARROW_INSET;
  const startY = from.y + uy * ARROW_INSET;
  const endX = to.x - ux * ARROW_INSET;
  const endY = to.y - uy * ARROW_INSET;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const outX = midX - centerXy;
  const outY = midY - centerXy;
  const outLen = Math.hypot(outX, outY) || 1;
  const perpX = -uy;
  const perpY = ux;
  const sign = perpX * (outX / outLen) + perpY * (outY / outLen) >= 0 ? 1 : -1;
  const controlX = midX + perpX * ARC_BOW * sign;
  const controlY = midY + perpY * ARC_BOW * sign;
  const labelX = (startX + 2 * controlX + endX) / 4;
  const labelY = (startY + 2 * controlY + endY) / 4;
  return {
    d: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
    labelX,
    labelY
  };
}
