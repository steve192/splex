# Frontend Architecture Plan

## Goals

The frontend is a shared Expo React Native application that targets Android and progressive web app users. It should prioritize fast expense entry, clear balance presentation, reliable offline expense creation, and consistent translated UI.

Primary goals:

- One TypeScript codebase for Android and PWA.
- Fast add-expense flow.
- Offline creation of expenses.
- Clean feature-based structure.
- No duplicated API or form logic across screens.
- All user-visible strings are translatable.
- Reusable design primitives for common controls.
- Clear pending-sync and offline states.

## Recommended Project Layout

```text
frontend/
  package.json
  tsconfig.json
  app.json
  Dockerfile
  src/
    app/
      navigation/
      routes/
    features/
      account/
      activity/
      auth/
      expenses/
      friends/
      groups/
      invitations/
      overview/
      settlements/
    shared/
      api/
      components/
      errors/
      forms/
      i18n/
      money/
      notifications/
      storage/
      sync/
      theme/
      validation/
```

Use feature folders for product behavior and `shared` for reusable infrastructure.

## Navigation

Use bottom tabs for the primary app:

- Overview
- Add
- Activity
- Account

Use stack screens or modals for:

- Login
- Magic code entry
- Group detail
- Friend detail
- Expense detail
- Expense edit
- Settlement
- Group settings
- Add group members
- Invitation accept
- Notification settings

The Add tab should support being prefilled from group/friend detail screens.

## Feature Boundaries

### auth

Responsibilities:

- Magic link request.
- Magic code verification.
- Auth state restoration.
- Logout.
- Login/register screens.

Rules:

- Auth state should be stored securely where possible.
- PWA and Android storage differences should be hidden behind a shared auth storage abstraction.
- Screens should not call raw fetch directly.

### overview

Responsibilities:

- List groups and friends.
- Show per-context balance summaries.
- Navigate to group or friend detail.

Rules:

- Balance text must be directional and explicit.
- Do not show ambiguous signed numbers without words.

### expenses

Responsibilities:

- Add expense flow.
- Expense detail.
- Expense edit.
- Split method UI.
- Multiple payer advanced UI.
- Offline draft handling.

Rules:

- The default add flow should be short.
- Advanced split options should be progressively disclosed.
- Expense form state should be reusable between Add tab and group/friend detail.
- Unsynced expenses can be edited/deleted offline.
- Synced expenses require online access for edit/delete.

### groups

Responsibilities:

- Group list data.
- Group detail.
- Group balance summary.
- Group member list.
- Unregistered participant display names.
- Group settings.

Rules:

- Any group member can rename an unregistered participant.
- Targeted invite actions should be available for unregistered participants.

### friends

Responsibilities:

- Friend list data.
- Friend detail.
- Friend invitation flow.
- Direct friend expense context.

### invitations

Responsibilities:

- Accept group invite.
- Accept friend invite.
- Accept targeted participant claim invite.
- Handle invitation errors and expired links.

Rules:

- Invitation links may be opened when logged out.
- If logged out, preserve the invite token through login.

### settlements

Responsibilities:

- Settlement flow from a balance row.
- Manual settlement amount.
- Partial settlement.

Rules:

- Settlements require online access.
- Settlement copy should make direction clear, for example: "You paid Alice" or "Alice paid you".

### activity

Responsibilities:

- Audit log feed.
- Infinite loading.
- Activity detail navigation where useful.

Rules:

- Activity is not chat.
- Entries should be concise and stable.
- User-visible strings are composed through frontend translations using structured event data.

### account

Responsibilities:

- Profile information.
- Default currency setting.
- Notification settings.
- Logout.

### notifications

Responsibilities:

- Android notification permission request.
- Android FCM token registration.
- PWA push subscription registration.
- Local handling of tapped notifications.

Rules:

- Do not use Expo push notification service.
- Backend receives platform tokens/subscriptions directly.
- The activity feed remains the source of truth.

## Shared Infrastructure

### API Client

All HTTP access should go through `shared/api`.

Requirements:

- Central base URL configuration.
- Token-based auth handling.
- Standard error parsing.
- Request timeout handling.
- Typed request and response shapes.
- No raw fetch calls inside screens.

Open decision:

- Generate API types from OpenAPI, or maintain TypeScript API types manually at first.

Recommendation:

- Start manually while the API is still moving.
- Add OpenAPI generation once backend endpoints stabilize.

### Local Storage

Use a storage abstraction instead of calling storage APIs directly.

Responsibilities:

- Auth persistence.
- Cached overview data.
- Cached group/friend detail data.
- Pending offline mutations.
- Unsynced expense drafts.
- Cached exchange rates for estimated offline display.

The implementation may differ by platform, but callers should use one interface.

### Sync Queue

The sync queue handles offline-created expenses.

Local mutation shape:

```ts
type PendingMutation = {
  id: string;
  type: "create_expense";
  payload: unknown;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
};
```

Rules:

- Every pending mutation has a client mutation ID.
- Mutations are retried when network connectivity returns.
- Duplicate submissions are safe because the backend is idempotent.
- Synced canonical data replaces pending local data.
- Failed mutations remain visible and retryable.

Allowed offline actions:

- Create expense.
- Edit unsynced expense.
- Delete unsynced expense.
- View cached data.

Blocked offline actions:

- Edit synced expense.
- Delete synced expense.
- Settle balance.
- Accept invitations.
- Create invitations.
- Rename participants.
- Change group settings.

### i18n

All user-visible strings must go through the translation layer.

Requirements:

- No hardcoded display strings in screens except translation keys.
- Initial locale files for English and German.
- Interpolation support for names, amounts, and dates.
- Pluralization support.
- Locale-aware date and number formatting.
- Activity messages composed from structured event payloads.

Recommended structure:

```text
src/shared/i18n/
  index.ts
  locales/
    en.json
    de.json
```

### Money Formatting

Use shared formatting helpers for all money display.

Rules:

- API money values are strings.
- Convert to decimal-safe representation for calculations where needed.
- Do not use JavaScript floating point for meaningful money arithmetic.
- Prefer backend-calculated canonical amounts.
- Frontend may calculate display estimates for offline drafts only.

### Forms And Validation

Use shared form primitives and schema validation.

Recommended:

- React Hook Form
- Zod or Valibot for TypeScript validation

Rules:

- Keep validation rules close to form models.
- Backend remains the final authority.
- Frontend validation should optimize UX, not replace backend validation.

## UX Plan

### Add Expense Flow

Default flow:

1. Select context: friend or group.
2. Enter amount, description, currency, and date.
3. Confirm payer and split.
4. Save.

Fast defaults:

- Recent context.
- Current date.
- Group or user default currency.
- Current user as payer.
- Equal split.

Advanced controls:

- Multiple payers.
- Selected participants.
- Percentage split.
- Exact amount split.
- Equal split with adjustments.

### Pending Sync UI

Pending offline expenses should be visible in the same ledger as synced expenses but visually marked.

States:

- pending sync
- syncing
- sync failed

For failed sync:

- Show retry action.
- Preserve local draft.
- Show a clear error state.

### Offline Blocking UI

When an online-only action is attempted offline:

- Disable the action where possible.
- Explain briefly through translated UI.
- Do not let the user perform changes that cannot sync safely.

## Data Fetching Strategy

Use a data-fetching layer that supports caching and invalidation.

Recommended:

- TanStack Query, if it fits Expo/PWA constraints well.

Rules:

- Overview invalidates after expense, settlement, group, or friend changes.
- Group detail invalidates after expenses, settlements, member changes, or invitation acceptance.
- Activity invalidates after successful mutations.
- Sync completion should update or invalidate affected queries.

## API Models

Frontend should model these resource shapes:

```text
User
Participant
Group
GroupMembership
Friendship
Invitation
Expense
ExpensePaymentShare
ExpenseOwedShare
Settlement
ActivityEvent
Notification
OverviewItem
BalanceSummary
PendingMutation
```

Money fields should be strings:

```ts
type Money = {
  amount: string;
  currency: string;
};
```

## Testing Strategy

Required frontend tests:

- Split form validation.
- Money formatting.
- Translation key coverage for core screens.
- Sync queue behavior.
- Offline blocking behavior.
- API client error handling.
- Add expense flow.

Recommended tools:

- Jest
- React Native Testing Library
- Playwright for PWA smoke tests

Critical test cases:

- Create expense offline and sync later.
- Edit unsynced expense offline.
- Synced edit disabled offline.
- Settlement disabled offline.
- Activity event renders from structured payload.
- Magic link/code flow handles errors.
- Invitation token survives login redirect.

## Production Readiness Requirements

Before production:

- Add error boundaries.
- Add loading, empty, and failure states for every screen.
- Add accessibility labels for interactive controls.
- Verify Android notification permission flow.
- Verify PWA install and offline behavior.
- Verify responsive layouts for narrow mobile and desktop web widths.
- Ensure no hardcoded display strings remain.
- Ensure no screen performs raw API calls outside shared API layer.
- Ensure no meaningful money math uses JavaScript floats.

## Docker Compose Requirements

The frontend must fit the repository-level single-app-container Docker Compose setup.

Local development:

- The default Compose setup should not require a separate frontend container.
- Native Expo development can run outside Docker when working on Android or frontend iteration.
- Android device development can still use the normal Expo tooling when needed.
- The frontend receives the backend API base URL through environment configuration.

Production example:

- Build the Expo web/PWA output.
- Serve static web assets from the same app container as the Django backend.
- Android builds remain outside Docker Compose unless a later build pipeline explicitly adds them.

Rules:

- Do not hardcode API URLs in source files.
- Environment-specific frontend configuration must be documented.
- PWA behavior should be verified against the production-style web build, not only the development server.
