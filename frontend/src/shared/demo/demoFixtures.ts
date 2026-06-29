/**
 * Canned, read-only demo data. Every response matches the shape returned by the
 * real backend.
 *
 * The source of truth is the expense + settlement fixtures. Derived figures
 * (group/friend balances, overview totals, statistics) are computed from those
 * via small helpers that mirror the backend's algorithms, so the demo can never
 * show numbers that contradict its own ledger. This intentionally duplicates a
 * little backend logic (the real implementation lives server-side in Python and
 * isn't importable here).
 */

export const DEMO_USER = {
  id: 1,
  email: "demo@splex.sterul.com",
  display_name: "Demo User",
  default_currency: "EUR",
  avatar_url: "",
  push_enabled: false,
  locale: "en",
  location_tracking_enabled: false
};

export const DEMO_TOKENS = { access: "demo", refresh: "demo" };

const TODAY = "2026-05-22";
const YESTERDAY = "2026-05-21";
const LAST_WEEK = "2026-05-15";
const LAST_MONTH = "2026-04-20";

const PARTICIPANT_ME = {
  id: 100,
  display_name: "Demo User",
  kind: "registered",
  user_id: 1,
  avatar_url: ""
};
const PARTICIPANT_ALEX = {
  id: 101,
  display_name: "Alex",
  kind: "registered",
  user_id: 2,
  avatar_url: ""
};
const PARTICIPANT_BEN = {
  id: 102,
  display_name: "Ben",
  kind: "unregistered",
  user_id: null,
  avatar_url: ""
};
const PARTICIPANT_CARLA = {
  id: 103,
  display_name: "Carla",
  kind: "registered",
  user_id: 3,
  avatar_url: ""
};
const PARTICIPANT_DANA = {
  id: 104,
  display_name: "Dana",
  kind: "registered",
  user_id: 4,
  avatar_url: ""
};

const TRIP_GROUP = {
  id: 1001,
  name: "Italy Trip",
  icon_url: "",
  default_currency: "EUR",
  default_split_method: "equal_all",
  default_split_payload: {},
  archived_at: null,
  deleted_at: null,
  created_at: "2026-04-01T10:00:00Z",
  updated_at: "2026-05-22T10:00:00Z",
  last_expense_date: TODAY
};

const FLAT_GROUP = {
  id: 1002,
  name: "Flatshare",
  icon_url: "",
  default_currency: "EUR",
  default_split_method: "equal_all",
  default_split_payload: {},
  archived_at: null,
  deleted_at: null,
  created_at: "2026-01-15T10:00:00Z",
  updated_at: "2026-05-20T10:00:00Z",
  last_expense_date: YESTERDAY
};

const ARCHIVED_GROUP = {
  id: 1003,
  name: "Old Roommates",
  icon_url: "",
  default_currency: "USD",
  default_split_method: "equal_all",
  default_split_payload: {},
  archived_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  created_at: "2025-09-01T10:00:00Z",
  updated_at: "2026-01-01T10:00:00Z",
  last_expense_date: "2025-12-31"
};

const GROUPS_BY_ID = {
  [TRIP_GROUP.id]: TRIP_GROUP,
  [FLAT_GROUP.id]: FLAT_GROUP,
  [ARCHIVED_GROUP.id]: ARCHIVED_GROUP
};

const TRIP_PARTICIPANTS = [PARTICIPANT_ME, PARTICIPANT_ALEX, PARTICIPANT_BEN];
const FLAT_PARTICIPANTS = [PARTICIPANT_ME, PARTICIPANT_CARLA];
const ARCHIVED_PARTICIPANTS = [PARTICIPANT_ME, PARTICIPANT_ALEX];

const GROUP_PARTICIPANTS = {
  [TRIP_GROUP.id]: TRIP_PARTICIPANTS,
  [FLAT_GROUP.id]: FLAT_PARTICIPANTS,
  [ARCHIVED_GROUP.id]: ARCHIVED_PARTICIPANTS
};

type ExpenseOptions = {
  latitude?: number;
  longitude?: number;
  approximate_location?: string;
  /** Settlement currency (applies to converted + owed/payment amounts, and to
   * the original amount unless overridden below). Defaults to EUR. */
  currency?: string;
  /** Set together to model an expense entered in a foreign currency that was
   * converted into ``currency`` for splitting. */
  original_amount?: string;
  original_currency?: string;
  split_method?: string;
  split_payload?: Record<string, unknown>;
  receipts?: Array<ReturnType<typeof receipt>>;
};

type ExpenseContext = {
  group_id?: number | null;
  friendship_id?: number | null;
};

type ExpensePayer = {
  id: number;
  name: string;
};

type ExpenseOwedShare = {
  id: number;
  name: string;
  amount: string;
};

type ExpenseArgs = [
  id: number,
  ctx: ExpenseContext,
  description: string,
  amount: string,
  date: string,
  payer: ExpensePayer,
  owed: ExpenseOwedShare[],
  options?: ExpenseOptions
];

function expense(
  ...[id, ctx, description, amount, date, payer, owed, options = {}]: ExpenseArgs
) {
  const currency = options.currency ?? "EUR";
  return {
    id,
    client_id: "",
    group_id: ctx.group_id ?? null,
    friendship_id: ctx.friendship_id ?? null,
    description,
    date,
    original_amount: options.original_amount ?? amount,
    original_currency: options.original_currency ?? currency,
    converted_amount: amount,
    converted_currency: currency,
    split_method: options.split_method ?? "equal_all",
    split_payload: options.split_payload ?? {},
    latitude: options.latitude ?? null,
    longitude: options.longitude ?? null,
    approximate_location: options.approximate_location ?? null,
    deleted_at: null,
    payments: [
      { participant_id: payer.id, display_name: payer.name, avatar_url: "", amount }
    ],
    owed: owed.map((row) => ({
      participant_id: row.id,
      display_name: row.name,
      avatar_url: "",
      amount: row.amount
    })),
    receipts: options.receipts ?? []
  };
}

function receipt(
  id: number,
  expenseId: number,
  filename: string,
  options: { content_type?: string; size_bytes?: number; created_at?: string } = {}
) {
  return {
    id,
    expense_id: expenseId,
    original_filename: filename,
    content_type: options.content_type ?? "image/jpeg",
    size_bytes: options.size_bytes ?? 248_000,
    created_at: options.created_at ?? `${TODAY}T18:05:00Z`,
    uploaded_by_id: PARTICIPANT_ME.user_id
  };
}

const TRIP_EXPENSES = [
  expense(
    2001,
    { group_id: TRIP_GROUP.id },
    "Dinner in Rome",
    "120.00",
    TODAY,
    { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "40.00" },
      { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name, amount: "40.00" },
      { id: PARTICIPANT_BEN.id, name: PARTICIPANT_BEN.display_name, amount: "40.00" }
    ],
    {
      latitude: 41.9028,
      longitude: 12.4964,
      approximate_location: "Rome, Italy",
      receipts: [receipt(5001, 2001, "trattoria-receipt.jpg")]
    }
  ),
  expense(
    2002,
    { group_id: TRIP_GROUP.id },
    "Train tickets",
    "90.00",
    YESTERDAY,
    { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "30.00" },
      { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name, amount: "30.00" },
      { id: PARTICIPANT_BEN.id, name: PARTICIPANT_BEN.display_name, amount: "30.00" }
    ]
  ),
  expense(
    2003,
    { group_id: TRIP_GROUP.id },
    "Museum tickets",
    "45.00",
    LAST_WEEK,
    { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "15.00" },
      { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name, amount: "15.00" },
      { id: PARTICIPANT_BEN.id, name: PARTICIPANT_BEN.display_name, amount: "15.00" }
    ]
  ),
  // Multi-currency: paid in USD on the trip, converted to EUR for splitting.
  expense(
    2004,
    { group_id: TRIP_GROUP.id },
    "Souvenirs",
    "30.00",
    LAST_WEEK,
    { id: PARTICIPANT_BEN.id, name: PARTICIPANT_BEN.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "10.00" },
      { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name, amount: "10.00" },
      { id: PARTICIPANT_BEN.id, name: PARTICIPANT_BEN.display_name, amount: "10.00" }
    ],
    { original_amount: "32.40", original_currency: "USD" }
  ),
  // Exact split: everyone owes a hand-entered amount.
  expense(
    2005,
    { group_id: TRIP_GROUP.id },
    "Boat tour",
    "100.00",
    LAST_WEEK,
    { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "50.00" },
      { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name, amount: "30.00" },
      { id: PARTICIPANT_BEN.id, name: PARTICIPANT_BEN.display_name, amount: "20.00" }
    ],
    {
      split_method: "exact",
      split_payload: {
        shares: [
          { participant_id: PARTICIPANT_ME.id, amount: "50.00" },
          { participant_id: PARTICIPANT_ALEX.id, amount: "30.00" },
          { participant_id: PARTICIPANT_BEN.id, amount: "20.00" }
        ]
      }
    }
  ),
  // Percentage split: 40 / 30 / 30 of the hotel bill.
  expense(
    2006,
    { group_id: TRIP_GROUP.id },
    "Hotel",
    "300.00",
    LAST_MONTH,
    { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "120.00" },
      { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name, amount: "90.00" },
      { id: PARTICIPANT_BEN.id, name: PARTICIPANT_BEN.display_name, amount: "90.00" }
    ],
    {
      split_method: "percentage",
      split_payload: {
        shares: [
          { participant_id: PARTICIPANT_ME.id, percentage: "40" },
          { participant_id: PARTICIPANT_ALEX.id, percentage: "30" },
          { participant_id: PARTICIPANT_BEN.id, percentage: "30" }
        ]
      }
    }
  )
];

const FLAT_EXPENSES = [
  expense(
    2101,
    { group_id: FLAT_GROUP.id },
    "Groceries",
    "60.00",
    YESTERDAY,
    { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "30.00" },
      { id: PARTICIPANT_CARLA.id, name: PARTICIPANT_CARLA.display_name, amount: "30.00" }
    ]
  ),
  expense(
    2102,
    { group_id: FLAT_GROUP.id },
    "Internet bill",
    "40.00",
    LAST_WEEK,
    { id: PARTICIPANT_CARLA.id, name: PARTICIPANT_CARLA.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "20.00" },
      { id: PARTICIPANT_CARLA.id, name: PARTICIPANT_CARLA.display_name, amount: "20.00" }
    ]
  ),
  // Adjusted-equal: split equally, then Carla covers 10 extra (she used more).
  expense(
    2103,
    { group_id: FLAT_GROUP.id },
    "Electricity",
    "80.00",
    LAST_MONTH,
    { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "35.00" },
      { id: PARTICIPANT_CARLA.id, name: PARTICIPANT_CARLA.display_name, amount: "45.00" }
    ],
    {
      split_method: "adjusted_equal",
      split_payload: {
        participant_ids: [PARTICIPANT_ME.id, PARTICIPANT_CARLA.id],
        adjustments: [{ participant_id: PARTICIPANT_CARLA.id, amount: "10.00" }]
      }
    }
  ),
  // Equal between a selected subset (here only Carla is on the hook).
  expense(
    2104,
    { group_id: FLAT_GROUP.id },
    "Carla's parking fine",
    "25.00",
    YESTERDAY,
    { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name },
    [{ id: PARTICIPANT_CARLA.id, name: PARTICIPANT_CARLA.display_name, amount: "25.00" }],
    {
      split_method: "equal_selected",
      split_payload: { participant_ids: [PARTICIPANT_CARLA.id] }
    }
  )
];

const FRIEND_EXPENSES = [
  expense(
    2201,
    { friendship_id: 3001 },
    "Coffee",
    "8.00",
    YESTERDAY,
    { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "4.00" },
      { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name, amount: "4.00" }
    ]
  ),
  expense(
    2202,
    { friendship_id: 3001 },
    "Concert tickets",
    "75.00",
    LAST_MONTH,
    { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "37.50" },
      { id: PARTICIPANT_ALEX.id, name: PARTICIPANT_ALEX.display_name, amount: "37.50" }
    ]
  )
];

const EXPENSES_BY_GROUP = {
  [TRIP_GROUP.id]: TRIP_EXPENSES,
  [FLAT_GROUP.id]: FLAT_EXPENSES,
  [ARCHIVED_GROUP.id]: []
};

// A second friend kept entirely in USD, to exercise non-EUR formatting.
const DANA_FRIEND_EXPENSES = [
  expense(
    2301,
    { friendship_id: 3002 },
    "Lunch",
    "24.00",
    LAST_WEEK,
    { id: PARTICIPANT_DANA.id, name: PARTICIPANT_DANA.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "12.00" },
      { id: PARTICIPANT_DANA.id, name: PARTICIPANT_DANA.display_name, amount: "12.00" }
    ],
    { currency: "USD" }
  ),
  expense(
    2302,
    { friendship_id: 3002 },
    "Cinema",
    "30.00",
    LAST_MONTH,
    { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name },
    [
      { id: PARTICIPANT_ME.id, name: PARTICIPANT_ME.display_name, amount: "15.00" },
      { id: PARTICIPANT_DANA.id, name: PARTICIPANT_DANA.display_name, amount: "15.00" }
    ],
    { currency: "USD" }
  )
];

const EXPENSES_BY_FRIEND: Record<number, typeof FRIEND_EXPENSES> = {
  3001: FRIEND_EXPENSES,
  3002: DANA_FRIEND_EXPENSES
};

const ALL_EXPENSES_BY_ID = Object.fromEntries(
  [...TRIP_EXPENSES, ...FLAT_EXPENSES, ...FRIEND_EXPENSES].map((e) => [e.id, e])
);

type DemoParticipant = {
  id: number;
  display_name: string;
  kind: string;
  user_id: number | null;
  avatar_url: string;
};

function settlement(
  id: number,
  ctx: { group_id?: number | null; friendship_id?: number | null },
  payer: DemoParticipant,
  receiver: DemoParticipant,
  amount: string,
  createdAt: string,
  currency = "EUR"
) {
  return {
    id,
    group_id: ctx.group_id ?? null,
    friendship_id: ctx.friendship_id ?? null,
    payer_participant_id: payer.id,
    receiver_participant_id: receiver.id,
    payer_display_name: payer.display_name,
    receiver_display_name: receiver.display_name,
    payer_avatar_url: "",
    receiver_avatar_url: "",
    amount,
    currency,
    kind: "manual",
    created_at: createdAt,
    deleted_at: null
  };
}

const TRIP_SETTLEMENTS = [
  settlement(
    4001,
    { group_id: TRIP_GROUP.id },
    PARTICIPANT_BEN,
    PARTICIPANT_ME,
    "10.00",
    "2026-05-10T12:00:00Z"
  )
];

const FRIEND_SETTLEMENTS = [
  settlement(
    4101,
    { friendship_id: 3001 },
    PARTICIPANT_ALEX,
    PARTICIPANT_ME,
    "20.00",
    "2026-05-05T09:00:00Z"
  )
];

const DANA_FRIEND_SETTLEMENTS = [
  settlement(
    4201,
    { friendship_id: 3002 },
    PARTICIPANT_ME,
    PARTICIPANT_DANA,
    "9.00",
    "2026-04-28T19:00:00Z",
    "USD"
  )
];

const ALL_SETTLEMENTS_BY_ID = Object.fromEntries(
  [...TRIP_SETTLEMENTS, ...FRIEND_SETTLEMENTS, ...DANA_FRIEND_SETTLEMENTS].map((s) => [s.id, s])
);

function ledger(expenses: typeof TRIP_EXPENSES, settlements: typeof TRIP_SETTLEMENTS) {
  const items: Array<{ type: string; occurred_at: string; expense?: object; settlement?: object }> = [];
  for (const e of expenses) {
    items.push({ type: "expense", occurred_at: `${e.date}T12:00:00Z`, expense: e });
  }
  for (const s of settlements) {
    items.push({ type: "settlement", occurred_at: s.created_at, settlement: s });
  }
  items.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  return items;
}

const LEDGER_BY_GROUP = {
  [TRIP_GROUP.id]: ledger(TRIP_EXPENSES, TRIP_SETTLEMENTS),
  [FLAT_GROUP.id]: ledger(FLAT_EXPENSES, []),
  [ARCHIVED_GROUP.id]: []
};

const LEDGER_BY_FRIEND: Record<number, ReturnType<typeof ledger>> = {
  3001: ledger(FRIEND_EXPENSES, FRIEND_SETTLEMENTS),
  3002: ledger(DANA_FRIEND_EXPENSES, DANA_FRIEND_SETTLEMENTS)
};

// --- Derived balances/statistics ------------------------------------------
// These are computed from the expense + settlement fixtures (rather than
// hand-set) so the demo never shows numbers that contradict its own ledger.
// The algorithm mirrors the backend: each owed share is a debt to the (single)
// payer, settlements net it down, opposing edges cancel, and every pairwise
// debt detail is attached to both the debtor and the creditor.

type BalanceParticipant = { id: number; display_name: string; user_id: number | null };

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Greedy "net everyone out, then settle largest creditor against largest
// debtor" reduction - the minimum set of transactions with identical net
// positions. Mirrors the backend's simplified_debts(). Returns debtor->creditor
// edges keyed "debtor:creditor".
function simplifiedDebts(net: Map<string, number>): Map<string, number> {
  const EPS = 0.005;
  const nets = new Map<number, number>();
  for (const [key, amount] of net) {
    const [d, c] = key.split(":").map(Number);
    nets.set(d, round2((nets.get(d) ?? 0) - amount));
    nets.set(c, round2((nets.get(c) ?? 0) + amount));
  }
  // Deterministic ordering (largest first, lower id breaking ties) so the demo
  // renders a stable breakdown.
  const creditors = [...nets.entries()]
    .filter(([, amt]) => amt > EPS)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const debtors = [...nets.entries()]
    .filter(([, amt]) => amt < -EPS)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);

  const result = new Map<string, number>();
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const [creditorId, creditorAmt] = creditors[ci];
    const [debtorId, debtorAmt] = debtors[di];
    const pay = round2(Math.min(creditorAmt, -debtorAmt));
    if (pay <= 0) break;
    result.set(`${debtorId}:${creditorId}`, pay);
    const nextCreditor = round2(creditorAmt - pay);
    const nextDebtor = round2(debtorAmt + pay);
    if (nextCreditor <= EPS) ci += 1;
    else creditors[ci] = [creditorId, nextCreditor];
    if (nextDebtor >= -EPS) di += 1;
    else debtors[di] = [debtorId, nextDebtor];
  }
  return result;
}

function computeBalances(
  participants: BalanceParticipant[],
  expenses: ReturnType<typeof expense>[],
  settlements: ReturnType<typeof settlement>[],
  currency: string,
  simplified = false
) {
  const debts = new Map<string, number>();
  const addDebt = (debtor: number, creditor: number, amount: number) => {
    if (debtor === creditor || amount === 0) return;
    const key = `${debtor}:${creditor}`;
    debts.set(key, round2((debts.get(key) ?? 0) + amount));
  };
  // Demo expenses always have a single payer, so each owed share is a straight
  // debt from that participant to the payer.
  for (const e of expenses) {
    const payerId = e.payments[0].participant_id;
    for (const owed of e.owed) addDebt(owed.participant_id, payerId, Number(owed.amount));
  }
  for (const s of settlements) {
    addDebt(s.payer_participant_id, s.receiver_participant_id, -Number(s.amount));
  }

  // Net each pair down to a single direction.
  const net = new Map<string, number>();
  const handled = new Set<string>();
  for (const key of debts.keys()) {
    const [d, c] = key.split(":").map(Number);
    const reverse = `${c}:${d}`;
    if (handled.has(key) || handled.has(reverse)) continue;
    handled.add(key);
    handled.add(reverse);
    const value = round2((debts.get(key) ?? 0) - (debts.get(reverse) ?? 0));
    if (value > 0) net.set(`${d}:${c}`, value);
    else if (value < 0) net.set(`${c}:${d}`, round2(-value));
  }

  const nameById = new Map(participants.map((p) => [p.id, p.display_name]));
  const userIdById = new Map(participants.map((p) => [p.id, p.user_id]));

  // Totals always come from the raw netted graph; simplification only
  // rearranges the breakdown edges, never anyone's net position.
  const totals = new Map<number, number>(participants.map((p) => [p.id, 0]));
  for (const [key, amount] of net) {
    const [d, c] = key.split(":").map(Number);
    totals.set(d, round2((totals.get(d) ?? 0) - amount));
    totals.set(c, round2((totals.get(c) ?? 0) + amount));
  }

  const breakdown = simplified ? simplifiedDebts(net) : net;
  const detailsById = new Map<number, object[]>(participants.map((p) => [p.id, []]));
  for (const [key, amount] of breakdown) {
    const [d, c] = key.split(":").map(Number);
    const detail = {
      from_participant_id: d,
      from_display_name: nameById.get(d) ?? "",
      from_user_id: userIdById.get(d) ?? null,
      to_participant_id: c,
      to_display_name: nameById.get(c) ?? "",
      to_user_id: userIdById.get(c) ?? null,
      amount: amount.toFixed(2),
      currency
    };
    detailsById.get(d)?.push(detail);
    detailsById.get(c)?.push(detail);
  }

  return participants.map((p) => ({
    participant_id: p.id,
    display_name: p.display_name,
    avatar_url: "",
    user_id: p.user_id,
    amount: (totals.get(p.id) ?? 0).toFixed(2),
    currency,
    details: detailsById.get(p.id) ?? []
  }));
}

function meBalance(rows: ReturnType<typeof computeBalances>): string {
  return rows.find((row) => row.participant_id === PARTICIPANT_ME.id)?.amount ?? "0.00";
}

const TRIP_BALANCES = computeBalances(TRIP_PARTICIPANTS, TRIP_EXPENSES, TRIP_SETTLEMENTS, "EUR");
const TRIP_BALANCES_SIMPLIFIED = computeBalances(
  TRIP_PARTICIPANTS,
  TRIP_EXPENSES,
  TRIP_SETTLEMENTS,
  "EUR",
  true
);
const FLAT_BALANCES = computeBalances(FLAT_PARTICIPANTS, FLAT_EXPENSES, [], "EUR");
const FLAT_BALANCES_SIMPLIFIED = computeBalances(FLAT_PARTICIPANTS, FLAT_EXPENSES, [], "EUR", true);
const FRIEND_BALANCES = computeBalances(
  [PARTICIPANT_ME, PARTICIPANT_ALEX],
  FRIEND_EXPENSES,
  FRIEND_SETTLEMENTS,
  "EUR"
);
const DANA_BALANCES = computeBalances(
  [PARTICIPANT_ME, PARTICIPANT_DANA],
  DANA_FRIEND_EXPENSES,
  DANA_FRIEND_SETTLEMENTS,
  "USD"
);

const FRIENDSHIP = {
  id: 3001,
  display_name: PARTICIPANT_ALEX.display_name,
  avatar_url: "",
  participant_id: PARTICIPANT_ALEX.id,
  current_participant_id: PARTICIPANT_ME.id,
  default_currency: "EUR",
  balance: meBalance(FRIEND_BALANCES),
  last_expense_date: YESTERDAY
};

const FRIENDSHIP_DANA = {
  id: 3002,
  display_name: PARTICIPANT_DANA.display_name,
  avatar_url: "",
  participant_id: PARTICIPANT_DANA.id,
  current_participant_id: PARTICIPANT_ME.id,
  default_currency: "USD",
  balance: meBalance(DANA_BALANCES),
  last_expense_date: LAST_WEEK
};

const FRIENDSHIP_BY_ID: Record<number, typeof FRIENDSHIP> = {
  [FRIENDSHIP.id]: FRIENDSHIP,
  [FRIENDSHIP_DANA.id]: FRIENDSHIP_DANA
};

const FRIENDS_LIST = [FRIENDSHIP, FRIENDSHIP_DANA];

const GROUPS_LIST = [
  { ...TRIP_GROUP, balance: meBalance(TRIP_BALANCES) },
  { ...FLAT_GROUP, balance: meBalance(FLAT_BALANCES) },
  { ...ARCHIVED_GROUP, balance: "0.00" }
];

const BALANCES_BY_GROUP: Record<number, typeof TRIP_BALANCES> = {
  [TRIP_GROUP.id]: TRIP_BALANCES,
  [FLAT_GROUP.id]: FLAT_BALANCES,
  [ARCHIVED_GROUP.id]: []
};

// Breakdown shown when the user flips the "simplify balances" toggle. Net totals
// are identical to BALANCES_BY_GROUP; only the who-pays-whom edges differ.
const BALANCES_BY_GROUP_SIMPLIFIED: Record<number, typeof TRIP_BALANCES> = {
  [TRIP_GROUP.id]: TRIP_BALANCES_SIMPLIFIED,
  [FLAT_GROUP.id]: FLAT_BALANCES_SIMPLIFIED,
  [ARCHIVED_GROUP.id]: []
};

type ExpenseFixture = ReturnType<typeof expense>;

const compareIsoDate = (left: string, right: string) => left.localeCompare(right);

function isoWeekday(dateStr: string): number {
  // JS getUTCDay() is 0=Sun..6=Sat; the UI labels weekdays Mon=0..Sun=6.
  return (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function getExpenseDateRange(expenses: ExpenseFixture[]) {
  const sortedDates = expenses.map((expenseRow) => expenseRow.date).sort(compareIsoDate);
  return {
    firstDate: sortedDates[0] ?? null,
    lastDate: sortedDates.at(-1) ?? null
  };
}

function calculateSpendPerWeek(
  total: number,
  count: number,
  firstDate: string | null,
  lastDate: string | null
) {
  if (!count || !firstDate || !lastDate || total <= 0) {
    return 0;
  }

  const spanDays =
    Math.max(0, Math.round((Date.parse(lastDate) - Date.parse(firstDate)) / 86_400_000)) + 1;
  const weeks = spanDays / 7;

  return weeks > 0 ? round2(total / weeks) : 0;
}

function buildCurrencyBreakdown(expenses: ExpenseFixture[]) {
  const byOriginalCurrency = new Map<string, { total: number; count: number }>();

  for (const expenseRow of expenses) {
    const row = byOriginalCurrency.get(expenseRow.original_currency) ?? { total: 0, count: 0 };
    row.total = round2(row.total + Number(expenseRow.original_amount));
    row.count += 1;
    byOriginalCurrency.set(expenseRow.original_currency, row);
  }

  return [...byOriginalCurrency.entries()]
    .sort((left, right) => right[1].total - left[1].total)
    .map(([currency, row]) => ({
      currency,
      total: row.total.toFixed(2),
      count: row.count
    }));
}

function buildMonthlyTotals(expenses: ExpenseFixture[], latestMonth: string) {
  const byMonth = new Map<string, number>();

  for (const expenseRow of expenses) {
    const key = expenseRow.date.slice(0, 7);
    byMonth.set(key, round2((byMonth.get(key) ?? 0) + Number(expenseRow.converted_amount)));
  }

  let [year, month] = latestMonth.split("-").map(Number);
  const monthly: Array<{ month: string; total: string }> = [];

  for (let index = 0; index < 12; index += 1) {
    const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
    monthly.push({ month: `${key}-01`, total: (byMonth.get(key) ?? 0).toFixed(2) });
    month -= 1;
    if (0 === month) {
      month = 12;
      year -= 1;
    }
  }

  monthly.reverse();
  return monthly;
}

function buildContributions(expenses: ExpenseFixture[], participants: BalanceParticipant[]) {
  const paidById = new Map<number, number>();
  const shareById = new Map<number, number>();

  for (const expenseRow of expenses) {
    for (const payment of expenseRow.payments) {
      paidById.set(
        payment.participant_id,
        round2((paidById.get(payment.participant_id) ?? 0) + Number(payment.amount))
      );
    }
    for (const share of expenseRow.owed) {
      shareById.set(
        share.participant_id,
        round2((shareById.get(share.participant_id) ?? 0) + Number(share.amount))
      );
    }
  }

  return participants
    .map((participant) => ({
      participant_id: participant.id,
      display_name: participant.display_name,
      paid: (paidById.get(participant.id) ?? 0).toFixed(2),
      share: (shareById.get(participant.id) ?? 0).toFixed(2),
      net: round2((paidById.get(participant.id) ?? 0) - (shareById.get(participant.id) ?? 0)).toFixed(2)
    }))
    .sort((left, right) => Number(right.paid) - Number(left.paid));
}

function buildTopDescriptions(expenses: ExpenseFixture[]) {
  const descriptionBuckets = new Map<string, { display: string; count: number; total: number }>();

  for (const expenseRow of expenses) {
    const key = expenseRow.description.trim().toLowerCase();
    if (!key) {
      continue;
    }

    const bucket = descriptionBuckets.get(key) ?? {
      display: expenseRow.description.trim(),
      count: 0,
      total: 0
    };
    bucket.count += 1;
    bucket.total = round2(bucket.total + Number(expenseRow.converted_amount));
    descriptionBuckets.set(key, bucket);
  }

  return [...descriptionBuckets.values()]
    .sort((left, right) => right.count - left.count || right.total - left.total)
    .slice(0, 8)
    .map((bucket) => ({
      description: bucket.display,
      count: bucket.count,
      total: bucket.total.toFixed(2)
    }));
}

function buildBiggestExpenses(expenses: ExpenseFixture[]) {
  return [...expenses]
    .sort((left, right) => Number(right.converted_amount) - Number(left.converted_amount))
    .slice(0, 5)
    .map((expenseRow) => ({
      id: expenseRow.id,
      description: expenseRow.description,
      amount: Number(expenseRow.original_amount).toFixed(2),
      currency: expenseRow.original_currency,
      converted_amount: Number(expenseRow.converted_amount).toFixed(2),
      converted_currency: expenseRow.converted_currency,
      date: expenseRow.date
    }));
}

function buildLocations(expenses: ExpenseFixture[]) {
  return [...expenses]
    .filter((expenseRow) => expenseRow.latitude != null && expenseRow.longitude != null)
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((expenseRow) => ({
      id: expenseRow.id,
      description: expenseRow.description,
      latitude: expenseRow.latitude as number,
      longitude: expenseRow.longitude as number,
      amount: Number(expenseRow.original_amount).toFixed(2),
      currency: expenseRow.original_currency,
      date: expenseRow.date
    }));
}

function buildDayOfWeek(expenses: ExpenseFixture[]) {
  const totals = Array.from({ length: 7 }, () => 0);
  const counts = Array.from({ length: 7 }, () => 0);

  for (const expenseRow of expenses) {
    const weekdayIndex = isoWeekday(expenseRow.date);
    totals[weekdayIndex] = round2(totals[weekdayIndex] + Number(expenseRow.converted_amount));
    counts[weekdayIndex] += 1;
  }

  return totals.map((total, index) => ({
    weekday: index,
    count: counts[index],
    total: total.toFixed(2)
  }));
}

function buildPairStats(expenses: ExpenseFixture[], nameById: Map<number, string>) {
  const pairs = new Map<
    string,
    { payer: number; beneficiary: number; count: number; amount: number }
  >();

  for (const expenseRow of expenses) {
    const payerId = expenseRow.payments[0].participant_id;
    for (const share of expenseRow.owed) {
      if (share.participant_id === payerId) {
        continue;
      }

      const key = `${payerId}:${share.participant_id}`;
      const row = pairs.get(key) ?? {
        payer: payerId,
        beneficiary: share.participant_id,
        count: 0,
        amount: 0
      };
      row.count += 1;
      row.amount = round2(row.amount + Number(share.amount));
      pairs.set(key, row);
    }
  }

  return [...pairs.values()]
    .sort((left, right) => right.amount - left.amount || right.count - left.count)
    .slice(0, 10)
    .map((row) => ({
      payer_id: row.payer,
      payer_name: nameById.get(row.payer) ?? "",
      beneficiary_id: row.beneficiary,
      beneficiary_name: nameById.get(row.beneficiary) ?? "",
      count: row.count,
      amount: row.amount.toFixed(2)
    }));
}

function buildPersonalSummary(
  contributions: ReturnType<typeof buildContributions>,
  currentParticipantId: number
) {
  const row = contributions.find((entry) => entry.participant_id === currentParticipantId);
  if (!row) return null;
  const net = Number(row.net);
  return {
    participant_id: row.participant_id,
    display_name: row.display_name,
    paid: row.paid,
    share: row.share,
    net: row.net,
    covered_for_others: Math.max(net, 0).toFixed(2),
    covered_by_others: Math.max(-net, 0).toFixed(2)
  };
}

function buildTopLocations(expenses: ExpenseFixture[]) {
  const buckets = new Map<string, { count: number; total: number }>();
  for (const expenseRow of expenses) {
    const location = expenseRow.approximate_location?.trim();
    if (!location) continue;
    const row = buckets.get(location) ?? { count: 0, total: 0 };
    row.count += 1;
    row.total = round2(row.total + Number(expenseRow.converted_amount));
    buckets.set(location, row);
  }
  return [...buckets.entries()]
    .sort((left, right) => right[1].total - left[1].total || right[1].count - left[1].count)
    .slice(0, 8)
    .map(([location, row]) => ({
      location,
      count: row.count,
      total: row.total.toFixed(2)
    }));
}

function buildMonthlyComparison(expenses: ExpenseFixture[], latestMonth: string) {
  const byMonth = new Map<string, { total: number; count: number }>();
  for (const expenseRow of expenses) {
    const key = expenseRow.date.slice(0, 7);
    const row = byMonth.get(key) ?? { total: 0, count: 0 };
    row.total = round2(row.total + Number(expenseRow.converted_amount));
    row.count += 1;
    byMonth.set(key, row);
  }
  const [year, month] = latestMonth.split("-").map(Number);
  const previousDate = new Date(year, month - 2, 1);
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
  const current = byMonth.get(latestMonth) ?? { total: 0, count: 0 };
  const previous = byMonth.get(previousMonth) ?? { total: 0, count: 0 };
  const activeTotals = [...byMonth.values()].map((row) => row.total).filter((total) => total > 0);
  const average = activeTotals.length
    ? round2(activeTotals.reduce((sum, total) => sum + total, 0) / activeTotals.length)
    : 0;
  const highest = [...byMonth.entries()].sort((left, right) => right[1].total - left[1].total)[0];
  const changeAmount = round2(current.total - previous.total);
  return {
    current_month: `${latestMonth}-01`,
    current_total: current.total.toFixed(2),
    current_count: current.count,
    previous_month: `${previousMonth}-01`,
    previous_total: previous.total.toFixed(2),
    previous_count: previous.count,
    change_amount: changeAmount.toFixed(2),
    change_percent: previous.total > 0 ? round2((changeAmount / previous.total) * 100).toFixed(2) : null,
    average_active_month: average.toFixed(2),
    highest_month: highest ? `${highest[0]}-01` : null,
    highest_month_total: (highest?.[1].total ?? 0).toFixed(2)
  };
}

function buildParticipantActivity(expenses: ExpenseFixture[], participants: BalanceParticipant[]) {
  const paidById = new Map<number, number>();
  const includedById = new Map<number, number>();
  for (const expenseRow of expenses) {
    for (const payment of expenseRow.payments) {
      paidById.set(payment.participant_id, (paidById.get(payment.participant_id) ?? 0) + 1);
    }
    for (const owed of expenseRow.owed) {
      includedById.set(owed.participant_id, (includedById.get(owed.participant_id) ?? 0) + 1);
    }
  }
  return participants
    .map((participant) => ({
      participant_id: participant.id,
      display_name: participant.display_name,
      paid_expense_count: paidById.get(participant.id) ?? 0,
      included_expense_count: includedById.get(participant.id) ?? 0,
      created_expense_count: participant.id === PARTICIPANT_ME.id ? expenses.length : 0
    }))
    .sort((left, right) => {
      return (
        right.created_expense_count - left.created_expense_count ||
        right.paid_expense_count - left.paid_expense_count ||
        right.included_expense_count - left.included_expense_count
      );
    });
}

// Mirror of the backend's statistics aggregation, so the figures always agree
// with the expense fixtures they're built from.
function computeStatistics(
  expenses: ExpenseFixture[],
  participants: BalanceParticipant[],
  currency: string,
  latestMonth: string,
  currentParticipantId = PARTICIPANT_ME.id
) {
  const nameById = new Map(participants.map((p) => [p.id, p.display_name]));
  const total = round2(expenses.reduce((sum, e) => sum + Number(e.converted_amount), 0));
  const count = expenses.length;
  const { firstDate, lastDate } = getExpenseDateRange(expenses);
  const average = count ? round2(total / count) : 0;
  const spendPerWeek = calculateSpendPerWeek(total, count, firstDate, lastDate);
  const currencyBreakdown = buildCurrencyBreakdown(expenses);
  const monthly = buildMonthlyTotals(expenses, latestMonth);
  const contributions = buildContributions(expenses, participants);
  const personalSummary = buildPersonalSummary(contributions, currentParticipantId);
  const topDescriptions = buildTopDescriptions(expenses);
  const biggestExpenses = buildBiggestExpenses(expenses);
  const locations = buildLocations(expenses);
  const topLocations = buildTopLocations(expenses);
  const dayOfWeek = buildDayOfWeek(expenses);
  const pairStats = buildPairStats(expenses, nameById);
  const monthlyComparison = buildMonthlyComparison(expenses, latestMonth);
  const participantActivity = buildParticipantActivity(expenses, participants);

  return {
    date_filter: { date_from: null, date_to: null },
    summary: {
      currency,
      total_amount: total.toFixed(2),
      expense_count: count,
      average_amount: average.toFixed(2),
      first_expense_date: firstDate,
      last_expense_date: lastDate,
      spend_per_week: spendPerWeek.toFixed(2),
      currency_breakdown: currencyBreakdown
    },
    monthly,
    contributions,
    personal_summary: personalSummary,
    top_descriptions: topDescriptions,
    biggest_expenses: biggestExpenses,
    locations,
    top_locations: topLocations,
    day_of_week: dayOfWeek,
    pair_stats: pairStats,
    monthly_comparison: monthlyComparison,
    participant_activity: participantActivity
  };
}

const CURRENT_MONTH = TODAY.slice(0, 7);
const STATS_TRIP = computeStatistics(
  TRIP_EXPENSES,
  TRIP_PARTICIPANTS,
  "EUR",
  CURRENT_MONTH
);
const STATS_FLAT = computeStatistics(FLAT_EXPENSES, FLAT_PARTICIPANTS, "EUR", CURRENT_MONTH);
const STATS_FRIEND = computeStatistics(
  FRIEND_EXPENSES,
  [PARTICIPANT_ME, PARTICIPANT_ALEX],
  "EUR",
  CURRENT_MONTH
);
const STATS_FRIEND_DANA = computeStatistics(
  DANA_FRIEND_EXPENSES,
  [PARTICIPANT_ME, PARTICIPANT_DANA],
  "USD",
  CURRENT_MONTH
);

const STATS_BY_FRIEND: Record<number, ReturnType<typeof computeStatistics>> = {
  [FRIENDSHIP.id]: STATS_FRIEND,
  [FRIENDSHIP_DANA.id]: STATS_FRIEND_DANA
};

const ACTIVITY_EVENTS = [
  {
    id: 9001,
    event_type: "expense.created",
    actor: PARTICIPANT_ME.display_name,
    actor_avatar_url: "",
    payload: { description: "Dinner in Rome", amount: "120.00", currency: "EUR" },
    subject_name: "",
    created_at: `${TODAY}T18:00:00Z`,
    context_type: "group",
    context_name: TRIP_GROUP.name,
    group_id: TRIP_GROUP.id,
    friendship_id: null,
    expense_id: 2001,
    settlement_id: null
  },
  {
    id: 9002,
    event_type: "settlement.created",
    actor: PARTICIPANT_BEN.display_name,
    actor_avatar_url: "",
    payload: { fromName: PARTICIPANT_BEN.display_name, toName: PARTICIPANT_ME.display_name, amount: "10.00", currency: "EUR" },
    subject_name: "",
    created_at: "2026-05-10T12:00:00Z",
    context_type: "group",
    context_name: TRIP_GROUP.name,
    group_id: TRIP_GROUP.id,
    friendship_id: null,
    expense_id: null,
    settlement_id: 4001
  },
  {
    id: 9003,
    event_type: "expense.created",
    actor: PARTICIPANT_CARLA.display_name,
    actor_avatar_url: "",
    payload: { description: "Internet bill", amount: "40.00", currency: "EUR" },
    subject_name: "",
    created_at: `${LAST_WEEK}T08:00:00Z`,
    context_type: "group",
    context_name: FLAT_GROUP.name,
    group_id: FLAT_GROUP.id,
    friendship_id: null,
    expense_id: 2102,
    settlement_id: null
  },
  {
    id: 9004,
    event_type: "group.created",
    actor: PARTICIPANT_ME.display_name,
    actor_avatar_url: "",
    payload: { name: TRIP_GROUP.name },
    subject_name: "",
    created_at: "2026-04-01T10:00:00Z",
    context_type: "group",
    context_name: TRIP_GROUP.name,
    group_id: TRIP_GROUP.id,
    friendship_id: null,
    expense_id: null,
    settlement_id: null
  },
  {
    id: 9005,
    event_type: "expense.created",
    actor: PARTICIPANT_DANA.display_name,
    actor_avatar_url: "",
    payload: { description: "Lunch", amount: "24.00", currency: "USD" },
    subject_name: "",
    created_at: `${LAST_WEEK}T13:00:00Z`,
    context_type: "friend",
    context_name: PARTICIPANT_DANA.display_name,
    group_id: null,
    friendship_id: FRIENDSHIP_DANA.id,
    expense_id: 2301,
    settlement_id: null
  },
  {
    id: 9006,
    event_type: "expense.updated",
    actor: PARTICIPANT_ALEX.display_name,
    actor_avatar_url: "",
    payload: { description: "Hotel", amount: "300.00", currency: "EUR" },
    subject_name: "",
    created_at: `${YESTERDAY}T09:30:00Z`,
    context_type: "group",
    context_name: TRIP_GROUP.name,
    group_id: TRIP_GROUP.id,
    friendship_id: null,
    expense_id: 2006,
    settlement_id: null
  },
  {
    id: 9007,
    event_type: "group.member_added",
    actor: PARTICIPANT_ME.display_name,
    actor_avatar_url: "",
    payload: {},
    subject_name: PARTICIPANT_BEN.display_name,
    created_at: "2026-04-02T11:00:00Z",
    context_type: "group",
    context_name: TRIP_GROUP.name,
    group_id: TRIP_GROUP.id,
    friendship_id: null,
    expense_id: null,
    settlement_id: null
  },
  {
    id: 9008,
    event_type: "expense.deleted",
    actor: PARTICIPANT_CARLA.display_name,
    actor_avatar_url: "",
    payload: { description: "Duplicate groceries", amount: "12.00", currency: "EUR" },
    subject_name: "",
    created_at: `${LAST_MONTH}T16:00:00Z`,
    context_type: "group",
    context_name: FLAT_GROUP.name,
    group_id: FLAT_GROUP.id,
    friendship_id: null,
    expense_id: null,
    settlement_id: null
  },
  {
    id: 9009,
    event_type: "settlement.created",
    actor: PARTICIPANT_ME.display_name,
    actor_avatar_url: "",
    payload: { fromName: PARTICIPANT_ME.display_name, toName: PARTICIPANT_DANA.display_name, amount: "9.00", currency: "USD" },
    subject_name: "",
    created_at: "2026-04-28T19:00:00Z",
    context_type: "friend",
    context_name: PARTICIPANT_DANA.display_name,
    group_id: null,
    friendship_id: FRIENDSHIP_DANA.id,
    expense_id: null,
    settlement_id: 4201
  }
];

const PARTICIPANT_OUTSTANDING_EMPTY = {
  currency: "EUR",
  owes: [],
  owed_by: []
};

// Payment methods (Account > Payment methods) and the per-participant preferred
// method that powers the "Pay with PayPal" button in the settle dialog.
type DemoPaymentMethod = {
  id: number;
  kind: "paypal_handle" | "paypal_email";
  identifier: string;
  is_preferred: boolean;
  display: string;
  url: string;
  pre_fills_recipient: boolean;
};

// Handles are deliberately non-real, sandbox-looking strings so the demo never
// deep-links into a stranger's actual paypal.me page.
const PAYMENT_METHODS: DemoPaymentMethod[] = [
  {
    id: 6001,
    kind: "paypal_handle",
    identifier: "splexdemo-me-x7f3a9",
    is_preferred: true,
    display: "paypal.me/splexdemo-me-x7f3a9",
    url: "https://www.paypal.com/paypalme/splexdemo-me-x7f3a9",
    pre_fills_recipient: true
  },
  {
    id: 6002,
    kind: "paypal_email",
    identifier: "demo@splex.sterul.com",
    is_preferred: false,
    display: "demo@splex.sterul.com",
    url: "https://www.paypal.com/myaccount/transfer/homepage/pay",
    pre_fills_recipient: false
  }
];

const PREFERRED_PAYMENT_METHOD_BY_PARTICIPANT: Record<number, DemoPaymentMethod> = {
  [PARTICIPANT_ALEX.id]: {
    id: 6101,
    kind: "paypal_handle",
    identifier: "splexdemo-alex-a4k2p9",
    is_preferred: true,
    display: "paypal.me/splexdemo-alex-a4k2p9",
    url: "https://www.paypal.com/paypalme/splexdemo-alex-a4k2p9",
    pre_fills_recipient: true
  },
  [PARTICIPANT_CARLA.id]: {
    id: 6102,
    kind: "paypal_email",
    identifier: "carla@splex.sterul.com",
    is_preferred: true,
    display: "carla@splex.sterul.com",
    url: "https://www.paypal.com/myaccount/transfer/homepage/pay",
    pre_fills_recipient: false
  },
  [PARTICIPANT_DANA.id]: {
    id: 6103,
    kind: "paypal_handle",
    identifier: "splexdemo-dana-d8m5q1",
    is_preferred: true,
    display: "paypal.me/splexdemo-dana-d8m5q1",
    url: "https://www.paypal.com/paypalme/splexdemo-dana-d8m5q1",
    pre_fills_recipient: true
  }
};

export const demoFixtures = {
  user: DEMO_USER,
  tokens: DEMO_TOKENS,
  groupsList: GROUPS_LIST,
  groupsById: GROUPS_BY_ID,
  groupParticipants: GROUP_PARTICIPANTS,
  expensesByGroup: EXPENSES_BY_GROUP,
  expensesByFriend: EXPENSES_BY_FRIEND,
  expensesById: ALL_EXPENSES_BY_ID,
  settlementsById: ALL_SETTLEMENTS_BY_ID,
  ledgerByGroup: LEDGER_BY_GROUP,
  ledgerByFriend: LEDGER_BY_FRIEND,
  friendsList: FRIENDS_LIST,
  friendship: FRIENDSHIP,
  friendshipById: FRIENDSHIP_BY_ID,
  balancesByGroup: BALANCES_BY_GROUP,
  balancesByGroupSimplified: BALANCES_BY_GROUP_SIMPLIFIED,
  statisticsTrip: STATS_TRIP,
  statisticsFlat: STATS_FLAT,
  statisticsFriend: STATS_FRIEND,
  statisticsByFriend: STATS_BY_FRIEND,
  activityEvents: ACTIVITY_EVENTS,
  participantOutstandingEmpty: PARTICIPANT_OUTSTANDING_EMPTY,
  paymentMethods: PAYMENT_METHODS,
  preferredPaymentMethodByParticipant: PREFERRED_PAYMENT_METHOD_BY_PARTICIPANT
};

export function groupDetail(groupId: number) {
  const group = GROUPS_BY_ID[groupId];
  if (!group) return null;
  return {
    ...group,
    current_participant_id: PARTICIPANT_ME.id,
    participants: GROUP_PARTICIPANTS[groupId] ?? []
  };
}

function dateRangeFromQuery(query: string) {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  return {
    date_from: params.get("date_from") ?? null,
    date_to: params.get("date_to") ?? null
  };
}

function filterExpensesByQuery(expenses: ExpenseFixture[], query: string) {
  const range = dateRangeFromQuery(query);
  return expenses.filter((expenseRow) => {
    if (range.date_from && expenseRow.date < range.date_from) return false;
    if (range.date_to && expenseRow.date > range.date_to) return false;
    return true;
  });
}

function withDateFilter<T extends { date_filter: { date_from: string | null; date_to: string | null } }>(
  stats: T,
  query: string
) {
  return { ...stats, date_filter: dateRangeFromQuery(query) };
}

export function statisticsForGroup(groupId: number, query = "") {
  const expenses = filterExpensesByQuery(EXPENSES_BY_GROUP[groupId] ?? TRIP_EXPENSES, query);
  const participants = GROUP_PARTICIPANTS[groupId] ?? TRIP_PARTICIPANTS;
  const currency = GROUPS_BY_ID[groupId]?.default_currency ?? "EUR";
  return withDateFilter(
    computeStatistics(expenses, participants, currency, CURRENT_MONTH),
    query
  );
}

export function statisticsForFriend(friendId: number, query = "") {
  const expenses = filterExpensesByQuery(EXPENSES_BY_FRIEND[friendId] ?? FRIEND_EXPENSES, query);
  const isDana = friendId === FRIENDSHIP_DANA.id;
  const participants = isDana
    ? [PARTICIPANT_ME, PARTICIPANT_DANA]
    : [PARTICIPANT_ME, PARTICIPANT_ALEX];
  const currency = isDana ? "USD" : "EUR";
  return withDateFilter(
    computeStatistics(expenses, participants, currency, CURRENT_MONTH),
    query
  );
}
