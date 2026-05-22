/**
 * Canned, read-only demo data. Every response is a static fixture that matches
 * the shape returned by the real backend. No business logic is reimplemented
 * here - balances, statistics, etc. are all precomputed values.
 */

export const DEMO_USER = {
  id: 1,
  email: "demo@splex.app",
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

function expense(
  id: number,
  ctx: { group_id?: number | null; friendship_id?: number | null },
  description: string,
  amount: string,
  date: string,
  payer: { id: number; name: string },
  owed: Array<{ id: number; name: string; amount: string }>,
  options: { latitude?: number; longitude?: number; approximate_location?: string } = {}
) {
  return {
    id,
    client_id: "",
    group_id: ctx.group_id ?? null,
    friendship_id: ctx.friendship_id ?? null,
    description,
    date,
    original_amount: amount,
    original_currency: "EUR",
    converted_amount: amount,
    converted_currency: "EUR",
    split_method: "equal_all",
    split_payload: {},
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
    }))
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
    { latitude: 41.9028, longitude: 12.4964, approximate_location: "Rome, Italy" }
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

const EXPENSES_BY_FRIEND: Record<number, typeof FRIEND_EXPENSES> = {
  3001: FRIEND_EXPENSES
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
  createdAt: string
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
    currency: "EUR",
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

const ALL_SETTLEMENTS_BY_ID = Object.fromEntries(
  [...TRIP_SETTLEMENTS, ...FRIEND_SETTLEMENTS].map((s) => [s.id, s])
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
  3001: ledger(FRIEND_EXPENSES, FRIEND_SETTLEMENTS)
};

const FRIENDSHIP = {
  id: 3001,
  display_name: PARTICIPANT_ALEX.display_name,
  avatar_url: "",
  participant_id: PARTICIPANT_ALEX.id,
  current_participant_id: PARTICIPANT_ME.id,
  default_currency: "EUR",
  balance: "-13.50",
  last_expense_date: YESTERDAY
};

const FRIENDS_LIST = [FRIENDSHIP];

const OVERVIEW = {
  items: [
    {
      type: "group",
      id: TRIP_GROUP.id,
      name: TRIP_GROUP.name,
      icon_url: "",
      currency: "EUR",
      balance: "70.00",
      archived_at: null
    },
    {
      type: "group",
      id: FLAT_GROUP.id,
      name: FLAT_GROUP.name,
      icon_url: "",
      currency: "EUR",
      balance: "10.00",
      archived_at: null
    },
    {
      type: "group",
      id: ARCHIVED_GROUP.id,
      name: ARCHIVED_GROUP.name,
      icon_url: "",
      currency: "USD",
      balance: "0.00",
      archived_at: "2026-01-01T00:00:00Z"
    }
  ]
};

const GROUPS_LIST = [TRIP_GROUP, FLAT_GROUP];

const TRIP_BALANCES = [
  {
    participant_id: PARTICIPANT_ME.id,
    display_name: PARTICIPANT_ME.display_name,
    avatar_url: "",
    amount: "70.00",
    currency: "EUR",
    details: [
      {
        from_participant_id: PARTICIPANT_ALEX.id,
        from_display_name: PARTICIPANT_ALEX.display_name,
        to_participant_id: PARTICIPANT_ME.id,
        to_display_name: PARTICIPANT_ME.display_name,
        amount: "25.00",
        currency: "EUR"
      },
      {
        from_participant_id: PARTICIPANT_BEN.id,
        from_display_name: PARTICIPANT_BEN.display_name,
        to_participant_id: PARTICIPANT_ME.id,
        to_display_name: PARTICIPANT_ME.display_name,
        amount: "45.00",
        currency: "EUR"
      }
    ]
  },
  {
    participant_id: PARTICIPANT_ALEX.id,
    display_name: PARTICIPANT_ALEX.display_name,
    avatar_url: "",
    amount: "-25.00",
    currency: "EUR",
    details: []
  },
  {
    participant_id: PARTICIPANT_BEN.id,
    display_name: PARTICIPANT_BEN.display_name,
    avatar_url: "",
    amount: "-45.00",
    currency: "EUR",
    details: []
  }
];

const FLAT_BALANCES = [
  {
    participant_id: PARTICIPANT_ME.id,
    display_name: PARTICIPANT_ME.display_name,
    avatar_url: "",
    amount: "10.00",
    currency: "EUR",
    details: [
      {
        from_participant_id: PARTICIPANT_CARLA.id,
        from_display_name: PARTICIPANT_CARLA.display_name,
        to_participant_id: PARTICIPANT_ME.id,
        to_display_name: PARTICIPANT_ME.display_name,
        amount: "10.00",
        currency: "EUR"
      }
    ]
  },
  {
    participant_id: PARTICIPANT_CARLA.id,
    display_name: PARTICIPANT_CARLA.display_name,
    avatar_url: "",
    amount: "-10.00",
    currency: "EUR",
    details: []
  }
];

const BALANCES_BY_GROUP: Record<number, typeof TRIP_BALANCES> = {
  [TRIP_GROUP.id]: TRIP_BALANCES,
  [FLAT_GROUP.id]: FLAT_BALANCES,
  [ARCHIVED_GROUP.id]: []
};

function statisticsFor(label: string, totalAmount: string) {
  return {
    summary: {
      currency: "EUR",
      total_amount: totalAmount,
      expense_count: 3,
      average_amount: "85.00",
      first_expense_date: LAST_WEEK,
      last_expense_date: TODAY,
      spend_per_week: totalAmount,
      currency_breakdown: [{ currency: "EUR", total: totalAmount, count: 3 }]
    },
    monthly: [
      { month: "2026-04", total: "45.00" },
      { month: "2026-05", total: totalAmount }
    ],
    contributions: [
      {
        participant_id: PARTICIPANT_ME.id,
        display_name: `${PARTICIPANT_ME.display_name} (${label})`,
        paid: "165.00",
        share: "85.00"
      },
      {
        participant_id: PARTICIPANT_ALEX.id,
        display_name: PARTICIPANT_ALEX.display_name,
        paid: "90.00",
        share: "85.00"
      }
    ],
    top_descriptions: [
      { description: "Dinner", count: 1, total: "120.00" },
      { description: "Train tickets", count: 1, total: "90.00" },
      { description: "Museum tickets", count: 1, total: "45.00" }
    ],
    biggest_expenses: [
      {
        id: 2001,
        description: "Dinner in Rome",
        amount: "120.00",
        currency: "EUR",
        converted_amount: "120.00",
        converted_currency: "EUR",
        date: TODAY
      }
    ],
    locations: [
      {
        id: 2001,
        description: "Dinner in Rome",
        latitude: 41.9028,
        longitude: 12.4964,
        amount: "120.00",
        currency: "EUR",
        date: TODAY
      }
    ],
    day_of_week: [
      { weekday: 0, count: 1, total: "45.00" },
      { weekday: 4, count: 1, total: "90.00" },
      { weekday: 5, count: 1, total: "120.00" }
    ],
    pair_stats: [
      {
        payer_id: PARTICIPANT_ME.id,
        payer_name: PARTICIPANT_ME.display_name,
        beneficiary_id: PARTICIPANT_ALEX.id,
        beneficiary_name: PARTICIPANT_ALEX.display_name,
        count: 2,
        amount: "55.00"
      }
    ]
  };
}

const STATS_TRIP = statisticsFor("Trip", "255.00");
const STATS_FLAT = statisticsFor("Flat", "100.00");
const STATS_FRIEND = statisticsFor("Friend", "83.00");

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
  }
];

const PARTICIPANT_OUTSTANDING_EMPTY = {
  currency: "EUR",
  owes: [],
  owed_by: []
};

export const demoFixtures = {
  user: DEMO_USER,
  tokens: DEMO_TOKENS,
  overview: OVERVIEW,
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
  balancesByGroup: BALANCES_BY_GROUP,
  statisticsTrip: STATS_TRIP,
  statisticsFlat: STATS_FLAT,
  statisticsFriend: STATS_FRIEND,
  activityEvents: ACTIVITY_EVENTS,
  participantOutstandingEmpty: PARTICIPANT_OUTSTANDING_EMPTY
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

export function statisticsForGroup(groupId: number) {
  if (groupId === FLAT_GROUP.id) return STATS_FLAT;
  return STATS_TRIP;
}
