export type ThemeMode = "light" | "dark" | "system";
export type ContextType = "group" | "friendship";
export type SplitMethod = "equal_all" | "equal_selected" | "exact" | "percentage" | "adjusted_equal";

export type Participant = {
  id: number;
  display_name: string;
  kind: string;
  user_id: number | null;
  avatar_url?: string;
};

export type Group = {
  id: number;
  name: string;
  icon_url?: string;
  default_currency: string;
  default_split_method?: SplitMethod;
  default_split_payload?: Record<string, unknown>;
  archived_at?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  current_participant_id?: number;
  participants?: Participant[];
  last_expense_date?: string | null;
  balance?: string;
};

export type Friend = {
  id: number;
  display_name: string;
  avatar_url?: string;
  participant_id: number;
  current_participant_id?: number;
  default_currency: string;
  balance: string;
  last_expense_date?: string | null;
  archived_at?: string | null;
};

export type OverviewItem = {
  type: "group" | "friend";
  id: number;
  name: string;
  currency: string;
  balance: string;
  avatar_url?: string;
  icon_url?: string;
  archived_at?: string | null;
};

export type ActivityFeedEvent = {
  id: number | string;
  event_type: string;
  actor: string;
  actor_avatar_url?: string;
  payload?: Record<string, string | number | undefined>;
  subject_name?: string;
  created_at: string;
  context_type?: "group" | "friend" | "";
  context_name?: string;
  expense_id?: number | null;
  settlement_id?: number | null;
  pending_mutation_id?: string;
};

export type ContextOption = {
  type: ContextType;
  id: number;
  name: string;
  currency: string;
  image_url?: string;
  last_expense_date?: string | null;
};

export type ExpenseShare = {
  participant_id: number;
  display_name?: string;
  avatar_url?: string;
  amount: string;
};

export type Receipt = {
  id: number;
  expense_id: number | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at?: string;
  uploaded_by_id: number | null;
};

export type Expense = {
  id: number;
  client_id?: string;
  group_id?: number | null;
  friendship_id?: number | null;
  description: string;
  date: string;
  original_amount: string;
  original_currency: string;
  converted_amount: string;
  converted_currency: string;
  split_method: SplitMethod;
  split_payload?: Record<string, unknown>;
  latitude?: number | null;
  longitude?: number | null;
  approximate_location?: string | null;
  deleted_at?: string | null;
  payments: ExpenseShare[];
  owed: ExpenseShare[];
  receipts?: Receipt[];
};

export type Settlement = {
  id: number;
  group_id?: number | null;
  friendship_id?: number | null;
  payer_participant_id: number;
  receiver_participant_id: number;
  payer_display_name?: string;
  receiver_display_name?: string;
  payer_avatar_url?: string;
  receiver_avatar_url?: string;
  amount: string;
  currency: string;
  kind?: "manual" | "auto_write_off";
  created_at: string;
  deleted_at?: string | null;
};

export type LedgerItem =
  | {
      type: "expense";
      occurred_at: string;
      expense: Expense;
    }
  | {
      type: "settlement";
      occurred_at: string;
      settlement: Settlement;
    };

export type UserProfile = {
  id: number;
  email: string;
  display_name: string;
  default_currency: string;
  avatar_url: string;
  push_enabled: boolean;
  locale: string;
  location_tracking_enabled: boolean;
};

export type BalanceDetail = {
  from_participant_id: number;
  from_display_name: string;
  to_participant_id: number;
  to_display_name: string;
  amount: string;
  currency: string;
};

export type GroupBalance = {
  participant_id: number;
  display_name: string;
  avatar_url?: string;
  /** ``null`` when the member is an unregistered placeholder.  The UI uses
   * this to decide whether the card-level "Remind to settle" button is
   * available (only registered users have a push endpoint to target). */
  user_id?: number | null;
  amount: string;
  currency: string;
  details: BalanceDetail[];
};

export type PaymentMethodKind = "paypal_handle" | "paypal_email";

export type PaymentMethod = {
  id: number;
  kind: PaymentMethodKind;
  /** Normalised identifier: bare handle for paypal_handle, lower-cased email
   * for paypal_email. */
  identifier: string;
  is_preferred: boolean;
  /** Human-readable form for display (``paypal.me/alice`` or the email). */
  display: string;
  /** URL safe to open in a new tab.  For handles it deep-links into the
   * pre-filled paypal.me page; for emails it links to PayPal's send-money
   * page where the payer pastes the email manually. */
  url: string;
  /** True only when the recipient is encoded in the URL itself. */
  pre_fills_recipient: boolean;
};

export type GroupSettings = Group & {
  default_split_method: SplitMethod;
  default_split_payload: Record<string, unknown>;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};
