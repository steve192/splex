import { describe, expect, it } from "vitest";

import { CANVAS_SIZE, buildArcPath, buildGraphModel } from "./balanceGraphModel";
import { GroupBalance } from "../types/models";

function row(
  participantId: number,
  displayName: string,
  amount: string,
  details: GroupBalance["details"]
): GroupBalance {
  return {
    participant_id: participantId,
    display_name: displayName,
    amount,
    currency: "EUR",
    details
  };
}

function detail(from: number, to: number, amount: string) {
  return {
    from_participant_id: from,
    from_display_name: `P${from}`,
    to_participant_id: to,
    to_display_name: `P${to}`,
    amount,
    currency: "EUR"
  };
}

describe("buildGraphModel", () => {
  it("returns no edges and no members when everyone is settled", () => {
    const rows = [row(1, "A", "0.00", []), row(2, "B", "0.00", [])];
    const model = buildGraphModel(rows);
    expect(model.edges).toEqual([]);
    expect(model.members).toEqual([]);
  });

  it("deduplicates the same edge surfaced on both members' detail lists", () => {
    const d = detail(1, 2, "10.00");
    const rows = [
      row(1, "A", "-10.00", [d]),
      row(2, "B", "10.00", [d])
    ];
    const model = buildGraphModel(rows);
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({ fromId: 1, toId: 2, amount: 10 });
  });

  it("places members in stable order by participant id", () => {
    const rows = [
      row(3, "C", "5.00", [detail(1, 3, "5.00")]),
      row(1, "A", "-5.00", [detail(1, 3, "5.00")])
    ];
    const first = buildGraphModel(rows);
    const reversed = buildGraphModel([...rows].reverse());
    expect(first.members.map((m) => m.id)).toEqual(reversed.members.map((m) => m.id));
  });

  it("skips members that are fully settled and have no edge", () => {
    const rows = [
      row(1, "A", "-5.00", [detail(1, 2, "5.00")]),
      row(2, "B", "5.00", [detail(1, 2, "5.00")]),
      row(3, "C", "0.00", [])
    ];
    const model = buildGraphModel(rows);
    expect(model.members.map((m) => m.id)).toEqual([1, 2]);
  });

  it("drops zero-amount detail rows from the edge set", () => {
    const rows = [
      row(1, "A", "0.00", [detail(1, 2, "0.00")]),
      row(2, "B", "0.00", [detail(1, 2, "0.00")])
    ];
    const model = buildGraphModel(rows);
    expect(model.edges).toEqual([]);
  });

  it("produces both edges of an A↔B cycle", () => {
    const a = detail(1, 2, "5.00");
    const b = detail(2, 1, "3.00");
    const rows = [
      row(1, "A", "-2.00", [a, b]),
      row(2, "B", "2.00", [a, b])
    ];
    const model = buildGraphModel(rows);
    const pairs = model.edges
      .map((edge) => `${edge.fromId}->${edge.toId}`)
      .sort();
    expect(pairs).toEqual(["1->2", "2->1"]);
  });

  it("places three members evenly around the ring", () => {
    const rows = [
      row(1, "A", "-10.00", [detail(1, 2, "5.00"), detail(1, 3, "5.00")]),
      row(2, "B", "5.00", [detail(1, 2, "5.00")]),
      row(3, "C", "5.00", [detail(1, 3, "5.00")])
    ];
    const model = buildGraphModel(rows);
    expect(model.members).toHaveLength(3);
    // Top member should be highest on the canvas (smallest y).
    const sortedByY = [...model.members].sort((a, b) => a.y - b.y);
    expect(sortedByY[0].id).toBe(1);
  });
});

describe("buildArcPath", () => {
  const center = CANVAS_SIZE / 2;

  it("returns a quadratic Bezier path with one control point", () => {
    const arc = buildArcPath(
      { id: 1, name: "A", x: 100, y: 100 },
      { id: 2, name: "B", x: 220, y: 220 },
      center
    );
    // Format: "M x y Q cx cy x2 y2"
    expect(arc.d).toMatch(/^M [\d.-]+ [\d.-]+ Q [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+$/);
    expect(arc.labelX).toEqual(expect.any(Number));
    expect(arc.labelY).toEqual(expect.any(Number));
  });

  it("inset shortens the path so the arrow doesn't sit under the avatar", () => {
    const from = { id: 1, name: "A", x: 100, y: 160 };
    const to = { id: 2, name: "B", x: 220, y: 160 };
    const arc = buildArcPath(from, to, center);
    // First coords on the path are the start; pull them out and check the gap.
    const match = arc.d.match(/^M (\S+) (\S+) Q \S+ \S+ (\S+) (\S+)$/);
    expect(match).not.toBeNull();
    const startX = Number(match![1]);
    const endX = Number(match![3]);
    // The path must start a few px after `from.x` and end a few px before `to.x`.
    expect(startX).toBeGreaterThan(from.x);
    expect(endX).toBeLessThan(to.x);
  });

  it("is symmetric for an A→B and B→A pair", () => {
    const a = { id: 1, name: "A", x: 80, y: 160 };
    const b = { id: 2, name: "B", x: 240, y: 160 };
    const forward = buildArcPath(a, b, center);
    const reverse = buildArcPath(b, a, center);
    // The two arcs should bow to opposite sides (different sign of labelY-160).
    const forwardOffset = forward.labelY - 160;
    const reverseOffset = reverse.labelY - 160;
    expect(Math.sign(forwardOffset)).not.toEqual(Math.sign(reverseOffset));
  });
});
