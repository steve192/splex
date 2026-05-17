# Splex Full Product And Implementation Plan

## Product Goal

Splex is a self-hostable expense splitter for friends and groups. The main product goal is fast, low-friction expense entry while preserving correct balances, clear auditability, offline expense creation, and a clean path to Android and progressive web app support from one frontend codebase.

The application should feel closer to a utility than a finance back office: common actions must be quick, defaults should be helpful, and advanced expense options should be available without making the default path feel heavy.

This document describes the full planned application scope discussed so far. Implementation milestones are sequencing guidance only; they are not a reduced product definition.

## Technology Choices

Backend:

- Python
- Django
- Django REST Framework
- SQLite by default for the self-hosted single-container setup
- Database configuration should allow switching to external PostgreSQL later
- `pyproject.toml` for dependency management
- Prefer `uv` for dependency locking and repeatable local setup unless the project later standardizes on another tool
- Clean architecture with domain-driven design where it fits Django naturally

Frontend:

- React Native with Expo
- TypeScript
- One shared frontend for Android and progressive web app
- Bottom tab navigation
- Translatable UI strings from the first implementation slice
- Initial languages: German and English
- Local offline storage and mutation queue for offline expense creation

Operations:

- Self-hostable backend
- Simple Docker Compose setup with one application container
- SQLite database stored in a mounted volume by default
- Optional configuration for external PostgreSQL later
- No Redis, Celery, or required sidecar services in the default setup
- Configurable public frontend/backend domain names for magic links, invitation links, PWA, and API calls
- SMTP email configuration through environment variables
- Currency-rate API integration through a provider placeholder/configuration
- FCM and VAPID push settings through environment variables
- No Expo push notification service
- Android push notifications via direct Firebase Cloud Messaging integration
- PWA push notifications via Web Push and VAPID
- Backend owns notification creation and dispatch
- Push notification preferences are global initially.

## Core Product Rules

### Accounts And Login

- Users register and log in with email magic links.
- A short code can be entered as an alternative to clicking the magic link.
- Authentication uses token-based auth for mobile and PWA compatibility.
- Access tokens should be short lived according to common practice.
- Refresh tokens should be long lived so users are not forced to re-login during normal use.
- Social logins are part of the longer-term planned scope and should not be blocked by the account model.
- A registered user owns one account profile.

### Friends

- Users can become friends through invitation links.
- If two users are in a group together, they are automatically considered friends.
- Friend expense contexts allow direct expenses between two people outside a group.

### Groups

- Users can create groups.
- A group has a default currency.
- Groups contain participants.
- A participant can be linked to a registered user or can be an unregistered person.
- Groups support invitation links.
- Group invitation links do not require additional approval. Possession of a valid invitation link is the approval.
- Any group member can edit the display name of an unregistered participant.
- A group member can create a targeted invitation link for a specific unregistered participant.
- When the targeted invite is accepted, the accepting registered user becomes linked to that participant.

### Expenses

- Expenses can be created for a friend context or a group.
- Expense fields:
  - description
  - original amount
  - original currency
  - converted amount in the group or context currency
  - exchange rate used
  - date
  - payer or payers
  - owed participants
  - split method metadata
- Single payer is the primary UX.
- Multiple payers must be supported by the backend and available through advanced UI, but should not be prominent in the default expense flow.
- Expenses can be added while offline.
- Synced expenses can only be edited or deleted while online.
- Unsynced local expenses can be edited or deleted offline.
- Editing an expense modifies the existing expense record and creates activity/audit entries. It does not create a replacement expense in the group history.

### Split Methods

The app must support:

- Equal split between all relevant participants
- Equal split between selected participants
- Percentage split
- Exact money amount per participant
- Equal split with per-participant additions or subtractions

All split methods should be normalized by the backend into final owed shares. Balance calculations must depend on normalized payment and owed shares, not on reinterpreting UI state every time.

Example:

```text
Expense total: 100 EUR

Payments:
  Alice paid 80 EUR
  Bob paid 20 EUR

Owed shares:
  Alice owes 50 EUR
  Bob owes 25 EUR
  Cara owes 25 EUR
```

### Settlements

- Users can settle expenses.
- Settlement is done from the screen that shows what each person owes within a group or friend context.
- The user selects a person and enters the amount that was paid.
- Partial settlements are supported.
- Settlement records are separate from expenses.
- A settlement means one participant paid another participant a specific amount.
- Settlement creation, editing, and deletion create activity entries and notifications.

Example:

```text
Bob owes Alice 50 EUR.
Bob pays Alice 20 EUR.
Bob now owes Alice 30 EUR.
```

### Currency Conversion

- A group has a default currency.
- A friend context should also have a default currency, derived from user preference or selected explicitly.
- Expenses may be entered in a different currency.
- Currency conversion uses the latest available exchange rate at the time the expense is saved or synced.
- The exchange rate used for an expense is stored permanently.
- Historical expenses do not change when rates change later.
- If an expense is created offline and a cached exchange rate exists, the frontend may show an estimated converted amount.
- The backend calculates the canonical converted amount during sync/save.
- The exchange-rate source is intentionally configurable and starts as a provider placeholder.
- The implementation should support plugging in an external currency-rate API without changing expense logic.

### Activity And Audit Log

The activity screen is the audit log. It should show all relevant events involving the current user.

Activity should include:

- Expense created
- Expense edited
- Expense deleted
- Settlement created
- Settlement edited
- Settlement deleted
- Group created
- Group member invited
- Group member joined
- Group member renamed
- Friend invited
- Friend accepted
- Invitation accepted
- Push notification relevant events

Activity entries are immutable. If something changes, create a new activity entry describing the change.

### Notifications

- All users of a group receive notifications when somebody adds, removes, or changes an expense.
- Relevant users receive notifications for settlements and invitations.
- Push notifications are required.
- The app must remain self-hostable and must not depend on Expo's push notification service.
- Android push delivery uses direct FCM from the backend.
- PWA push delivery uses Web Push with VAPID.
- In-app activity remains the canonical notification and audit history.
- Push delivery failure must not affect the source transaction.
- In the simple default deployment, push and email dispatch run from the application process without Redis/Celery.
- Failed dispatch should be recorded and visible for diagnostics, but the domain action still succeeds.
- Push notification preferences are global for the first implementation.

## Screens

### Navigation

Use bottom navigation tabs:

- Overview
- Add
- Activity
- Account

Additional stack/modal screens:

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

### Overview

Shows all groups and friends with the current user's balance.

For each row:

- name
- type: group or friend
- balance summary
- optional recent activity indicator

Examples:

```text
Weekend Trip
You are owed 42.50 EUR

Alice
You owe 12.00 EUR
```

Tapping a group or friend opens the expense history for that context.

### Add

The Add tab is optimized for fast expense entry.

Default flow:

1. Choose friend or group.
2. Enter amount, description, currency, and date.
3. Confirm payer and split.
4. Save.

Fast defaults:

- recently used friend/group
- current date
- user's or group's default currency
- current user as payer
- equal split

Advanced options:

- multiple payers
- selected participants
- percentage split
- exact amount split
- equal split with adjustments

### Activity

Shows an audit-style list of events where the current user is involved.

Examples:

```text
Alice added "Dinner" for 42.00 EUR in Weekend Trip.
Bob settled 20.00 EUR with you.
Cara joined Weekend Trip.
```

The list should support pagination/infinite loading.

### Account

Shows:

- email/account information
- profile display name
- notification settings
- default currency preference
- active sessions/devices if implemented
- logout

### Friend Or Group Expense History

Shows:

- expense and settlement ledger
- group/friend balance summary
- for groups, the current user's balance with each participant
- button to add an expense for this context
- button to settle with a participant
- button to invite or add users
- expense editing actions

For group balance display, show direct balance between the current user and each group participant:

```text
Bob owes you 12.50 EUR
You owe Cara 8.00 EUR
You and Daniel are settled up
```

The planned balance screen shows the current user's direct balance with each participant. Group-wide optimized settlement suggestions are not currently part of the planned scope unless explicitly added later.

### Login

Shows:

- email input
- button to request magic link/code
- clear success state after request
- option to enter code manually
- error state for invalid email or rate limit

Rules:

- The same flow is used for registration and login.
- If an invitation link opened the app, preserve the invitation token through login.
- Later social login buttons can be added without changing the core account model.

### Magic Code Entry

Shows:

- code input
- submit action
- resend action
- current email address
- error state for invalid or expired code

Rules:

- Codes expire.
- Verification should consume or invalidate the challenge according to backend policy.

### Invitation Accept

Shows:

- invitation context
- group, friend, or participant claim target
- accept action
- error states for expired, revoked, or invalid invitations

Rules:

- A logged-out user can open an invite and then authenticate.
- A group invite joins the group directly.
- A friend invite creates a friendship.
- A targeted participant invite links the accepting registered user to the selected unregistered participant.

### Expense Detail

Shows:

- description
- original amount and currency
- converted amount and context currency when different
- date
- payer or payers
- owed shares
- split method summary
- activity/audit references where useful
- edit action
- delete action

Rules:

- Synced expenses can only be edited or deleted online.
- Unsynced expenses can be edited or deleted offline.
- Deleted expenses remain auditable through activity.

### Expense Edit

Shows:

- the same editable fields as expense creation
- current split configuration
- current payer configuration
- save action
- delete action

Rules:

- Editing updates the existing expense.
- Editing creates an activity/audit event.
- Group members receive notifications after synced expense changes.

### Settlement

Shows:

- selected person
- direction of payment
- current balance with that person
- amount input
- confirm action

Rules:

- Partial settlement is supported.
- Amount is entered manually.
- Settlement requires online access.
- Settlement creates activity and notifications.

### Group Settings

Shows:

- group name
- group default currency
- member list
- unregistered participant names
- invite actions

Rules:

- Any group member can edit unregistered participant display names.
- Currency changes after expenses exist need a clear backend rule before implementation. Prefer disabling group currency changes after ledger entries exist unless a later migration/recalculation feature is designed.
- Deleted expenses are hidden from the normal ledger and remain visible only through activity.

### Add Group Members

Shows:

- create invite link
- add unregistered participant
- create targeted invite for unregistered participant
- existing pending invitations

Rules:

- Invitation links are bearer permissions.
- Targeted participant invites are bound to one unregistered participant.

### Notification Settings

Shows:

- push notification status
- Android/PWA permission state
- global notification preference
- optional per-group preferences if implemented

Rules:

- Push settings affect push delivery only.
- Activity/audit entries are still created regardless of push preference.

## Offline Behavior

Allowed offline:

- Create a new expense.
- Edit an expense that has not synced yet.
- Delete an expense that has not synced yet.
- View locally cached data.

Blocked offline:

- Edit synced expenses.
- Delete synced expenses.
- Create settlements.
- Accept invitations.
- Create invitations.
- Rename members.
- Change group settings.

Offline expense creation flow:

1. User creates expense locally.
2. Frontend assigns client-side UUIDs.
3. Frontend stores a pending mutation.
4. UI shows the expense as pending sync.
5. When online, the mutation is sent to the backend.
6. Backend validates and creates the canonical expense.
7. Backend returns canonical data.
8. Frontend replaces pending local state with server state.

Conflicts should not occur for synced records because editing synced expenses is disabled offline.

## Full Implementation Roadmap

The roadmap below covers the complete planned app. Earlier milestones create the minimum usable accounting core, while later milestones complete the full planned feature set.

### Milestone 1: Project Foundation

- Create monorepo structure.
- Add Django backend.
- Add Expo TypeScript frontend.
- Add Dockerfiles and Docker Compose setup.
- Add single-service Docker Compose setup for the application container.
- Add SQLite volume configuration.
- Add optional external PostgreSQL configuration path.
- Serve the built PWA from the same application container as the Django backend.
- Add dependency management.
- Add linting and formatting.
- Add test tooling.
- Add baseline documentation.
- Add environment configuration patterns.

### Milestone 2: Authentication

- Magic link request endpoint.
- Magic code request and verification.
- Email delivery abstraction.
- Token-based auth.
- Frontend login screens.
- Persisted frontend auth state.

### Milestone 3: Participants, Groups, And Friends

- Registered user participants.
- Unregistered group participants.
- Group creation with default currency.
- Group membership.
- Friendships.
- Automatic friendship for shared group membership.
- Group and friend overview data.

### Milestone 4: Invitations

- Group invitation links.
- Friend invitation links.
- Targeted invitation links for unregistered participants.
- Invitation accept flow.
- Participant claiming.
- Activity entries for invitations and joins.

### Milestone 5: Basic Expenses

- Single-payer equal split expense creation.
- Store payment shares and owed shares.
- Group and friend expense history.
- Activity entries.
- Basic balance calculation.
- Unit tests for accounting logic.

### Milestone 6: Settlements

- Settlement model.
- Settlement creation flow.
- Partial settlement support.
- Balance updates.
- Activity entries.
- Settlement history in ledger.

### Milestone 7: Advanced Splits And Multiple Payers

- Multiple payers.
- Selected equal split.
- Percentage split.
- Exact amount split.
- Equal split with adjustments.
- Validation and rounding rules.
- Frontend advanced split UI.

### Milestone 8: Offline Expense Creation

- Frontend local storage.
- Pending mutation queue.
- Sync endpoint.
- Idempotency keys.
- Pending state UI.
- Offline create/edit/delete for unsynced expenses.
- Backend tests for duplicate mutation handling.

### Milestone 9: Currency Conversion

- Exchange rate model.
- Currency-rate provider interface and placeholder implementation.
- Conversion service.
- Expense conversion on create/sync.
- Frontend currency selector.
- Display original and converted amounts where useful.

### Milestone 10: Notifications

- Notification records.
- Global notification preferences.
- Device token registration for Android.
- Web Push subscription registration for PWA.
- Direct FCM dispatcher.
- Web Push dispatcher.
- Push events from activity events.
- Environment variables for FCM and VAPID configuration.

### Milestone 11: Social Login Extension

- Add social account model support.
- Add provider configuration.
- Add frontend social login buttons.
- Link social identities to existing email accounts where safe.
- Preserve magic link/code login as the primary non-provider flow.

### Milestone 12: Production Readiness

- Permissions hardening.
- API error contract.
- Rate limits for auth and invitation endpoints.
- Audit coverage review.
- Database indexes.
- Pagination.
- Accessibility pass.
- Translation completeness checks.
- Production Docker Compose example.
- SQLite backup/restore documentation.
- Optional PostgreSQL migration/switch documentation.
- Same-container PWA serving documentation.
- Deployment documentation.

## Full Planned Scope Checklist

The full planned application includes:

- Magic-link and code-based account registration/login.
- Token-based authentication.
- Social login support as a later planned login option.
- Groups with default currency.
- Registered and unregistered group participants.
- Editable display names for unregistered participants.
- Group invitation links.
- Targeted invitation links for specific unregistered participants.
- Friend invitation links.
- Automatic friendship for users who share a group.
- Direct friend expense contexts.
- Group expense contexts.
- Fast expense entry through the Add tab.
- Expense creation while offline.
- Offline editing/deleting of unsynced local expenses.
- Online-only editing/deleting of synced expenses.
- Single-payer default expense UX.
- Multiple-payer expense support.
- Equal split across all participants.
- Equal split across selected participants.
- Percentage split.
- Exact amount split.
- Equal split with per-person additions/subtractions.
- Group and friend expense history.
- Expense editing.
- Settlements from balance rows.
- Partial settlements.
- Manual settlement amount entry.
- Per-group and per-friend balance summaries.
- Per-participant group balance display from the current user's perspective.
- Activity screen as immutable audit log.
- Push notifications for relevant changes.
- Global push notification preferences.
- Android push through direct FCM.
- PWA push through Web Push/VAPID.
- Currency conversion using the latest available rate at save/sync time.
- Stored exchange rates per expense.
- Backend-owned canonical money calculations.
- Full i18n for all user-visible UI strings.
- Initial translations for German and English.
- PWA support.
- Android support.
- Simple one-container Docker Compose setup.
- SQLite by default with an optional path to external PostgreSQL later.
- Configurable domain names and SMTP/FCM/VAPID environment variables.
- Built PWA served by the application container.
- Production-ready backend and frontend structure.

## Not Currently Planned

These are outside the current plan unless we deliberately add them later:

- Bank account integrations.
- Payment provider integrations.
- Group-wide optimized settlement suggestions.
- Recurring expenses.
- Receipt scanning.
- Comments on expenses.
- Full offline editing of synced records.
- Cloud-hosted notification providers beyond mandatory platform push infrastructure.

## UX Principles

- The default add-expense path must be short.
- Use progressive disclosure for advanced split options.
- Keep balance language clear and directional.
- Never make users infer whether a number means they owe or are owed.
- Surface pending sync state clearly.
- Use cached data offline, but communicate when actions require online access.
- Avoid making the activity feed feel like chat; it is an audit log.
- All user-visible strings must go through the translation layer.

## Open Implementation Decisions

These do not block the first scaffold but should be decided before the related milestones:

- Whether the frontend API client is generated from OpenAPI or manually typed.
- Exact currency-rate API provider.
