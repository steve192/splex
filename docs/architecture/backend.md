# Backend Architecture Plan

## Goals

The backend should be a clean, testable Django application with domain logic kept out of HTTP and serialization layers. The accounting model must be auditable, deterministic, and safe to use with offline-created expenses.

Primary architecture goals:

- Keep Django as the framework, not the whole application architecture.
- Keep business operations in application services.
- Keep read/query composition in selectors.
- Keep money and balance calculations in focused domain modules.
- Keep HTTP views thin.
- Make activity/audit events part of every important mutation.
- Make offline sync idempotent.
- Make notification dispatch a side effect of recorded activity, not the source of truth.

## Recommended Project Layout

```text
backend/
  pyproject.toml
  Dockerfile
  src/
    config/
      settings/
        base.py
        local.py
        production.py
        test.py
      urls.py
      asgi.py
      wsgi.py
    splex/
      accounts/
      participants/
      groups/
      friends/
      invitations/
      expenses/
      settlements/
      balances/
      activity/
      notifications/
      currency/
      sync/
      shared/
  tests/
```

Repository root deployment and local development files:

```text
docker-compose.yml
.env.example
```

The default deployment shape is intentionally simple: one application container with SQLite stored on a mounted volume. The settings should still allow switching to an external PostgreSQL database later through environment configuration.

Each Django app should use this internal shape where useful:

```text
app_name/
  api/
    serializers.py
    urls.py
    views.py
  migrations/
  selectors/
    *.py
  services/
    *.py
  tests/
    test_*.py
  admin.py
  apps.py
  events.py
  models.py
  permissions.py
```

Guidelines:

- Views handle request/response concerns only.
- Serializers validate and shape API data only.
- Services perform writes and enforce use-case rules.
- Selectors perform reads and query composition.
- Domain calculations should be pure functions/classes where possible.
- Models define persistence, relationships, and simple local invariants.
- Avoid putting orchestration logic in model `save()` methods.

## Backend Apps

### accounts

Responsibilities:

- Registered users.
- Email magic links.
- Login codes.
- Token-based authentication.
- Account profile fields.

Important models:

- `User`
- `MagicLoginChallenge`
- `AuthToken` or refresh-token model if token state is server-side

Services:

- `request_magic_login`
- `verify_magic_link`
- `verify_magic_code`
- `logout`

Rules:

- Use short-lived access tokens.
- Use long-lived refresh tokens to avoid routine forced re-login.
- Refresh tokens should be revocable.
- Logout should revoke the active refresh token where possible.

### participants

Responsibilities:

- Represent people involved in expenses.
- Support registered and unregistered people.
- Link an unregistered participant to a user after targeted invite acceptance.

Important models:

- `Participant`

Key fields:

- `user`, nullable
- `display_name`
- `kind`
- timestamps

Rules:

- A registered user should have a participant identity.
- An unregistered group participant can exist without a user.
- Any group member can rename an unregistered participant in that group.
- Participant claiming must be explicit through a targeted invitation.

### groups

Responsibilities:

- Groups.
- Group membership.
- Group default currency.
- Member management.

Important models:

- `Group`
- `GroupMembership`

Rules:

- A group has one default currency.
- Group balances are shown in the group currency.
- Group members are participants.
- A membership references a participant.
- If a participant is linked to a user, that user can access the group.

### friends

Responsibilities:

- Direct friend relationships.
- Friend expense contexts.
- Automatic friendship derived from shared group membership.

Important models:

- `Friendship`

Rules:

- Friendship can be explicit through invite acceptance.
- Friendship can also be implied by shared group membership.
- Friend expense contexts involve two participants.

### invitations

Responsibilities:

- Group invitations.
- Friend invitations.
- Targeted participant invitations.

Important models:

- `Invitation`

Invitation types:

- `group_join`
- `friend_join`
- `claim_participant`

Rules:

- Valid invitation links do not need separate approval.
- Invitation tokens must be random, high entropy, and stored hashed.
- Invitations may expire.
- Targeted participant invitations link a registered user to a specific unregistered participant.

### expenses

Responsibilities:

- Expense records.
- Payment shares.
- Owed shares.
- Split validation and normalization.
- Expense create/edit/delete use cases.

Important models:

- `Expense`
- `ExpensePaymentShare`
- `ExpenseOwedShare`

Rules:

- Store original amount and original currency.
- Store converted amount and context currency.
- Store the exchange rate used.
- Store normalized payment shares.
- Store normalized owed shares.
- Balances use shares, not split metadata.
- Edits create activity events.
- Deletions should be soft deletes to preserve auditability.

### settlements

Responsibilities:

- Settlement records.
- Partial settlement support.
- Settlement create/edit/delete use cases.

Important models:

- `Settlement`

Rules:

- A settlement is separate from an expense.
- A settlement has a payer participant and receiver participant.
- Settlement amount is entered manually.
- Settlements are included in ledgers and balance calculations.
- Edits/deletes create activity entries.

### balances

Responsibilities:

- Balance calculation.
- Context summaries.
- Overview summaries.

This app may have no models at first. It should expose selectors/domain functions.

Rules:

- Balances are derived from expenses and settlements.
- Cache summaries later only if needed.
- The source of truth remains expense and settlement ledger entries.
- Group detail shows the current user's direct balance with each participant.
- Group-wide optimized settlement suggestions are not currently part of the planned scope.

### activity

Responsibilities:

- Immutable audit events.
- Activity feed selectors.
- Event payload storage.

Important models:

- `ActivityEvent`

Rules:

- Every important mutation creates an activity event.
- Events are immutable.
- Event payload should contain enough display information for stable audit history.
- The activity feed is the canonical in-app audit log.

### notifications

Responsibilities:

- In-app notifications.
- Device registrations.
- Web Push subscriptions.
- Direct push dispatch through platform push systems.

Important models:

- `Notification`
- `DeviceToken`
- `WebPushSubscription`

Rules:

- Notifications are created from activity events.
- Push dispatch failure does not roll back the domain mutation.
- No Expo push service.
- Android push uses direct FCM.
- PWA push uses Web Push/VAPID.
- Default deployment does not require Redis/Celery.
- Push dispatch runs from the application process after the database transaction commits.
- Failed push dispatch is recorded for diagnostics.

### currency

Responsibilities:

- Exchange rates.
- Rate fetching.
- Currency conversion.

Important models:

- `ExchangeRate`

Rules:

- Conversion uses the latest available rate at save/sync time.
- Store the exact rate used on each expense.
- Existing expenses do not change when rates change.
- Rate providers must be behind an interface.
- The concrete currency-rate API provider remains configurable.
- The first implementation may fetch rates on demand and cache them in the database.

### sync

Responsibilities:

- Offline mutation ingestion.
- Idempotency.
- Client mutation tracking.

Important models:

- `ClientMutation`

Rules:

- Offline creation uses client-generated UUIDs.
- Each mutation has a unique idempotency key.
- Duplicate mutations return the existing canonical result.
- Only expense creation is accepted from offline sync in the initial planned offline implementation.
- Synced record edits are not accepted offline.

### shared

Responsibilities:

- Common value objects.
- Exceptions.
- API error formatting.
- Money helpers.
- Permission helpers.
- Testing factories shared across apps.

## Core Model Sketches

### Participant

```text
Participant
  id
  user nullable
  display_name
  kind: registered | unregistered
  created_at
  updated_at
```

### Group

```text
Group
  id
  name
  default_currency
  created_by
  created_at
  updated_at
```

### GroupMembership

```text
GroupMembership
  id
  group
  participant
  role
  joined_at
  removed_at nullable
```

### Friendship

```text
Friendship
  id
  participant_a
  participant_b
  source: explicit | shared_group
  created_at
  ended_at nullable
```

### Invitation

```text
Invitation
  id
  token_hash
  type
  group nullable
  target_participant nullable
  invited_by
  accepted_by nullable
  expires_at nullable
  accepted_at nullable
  revoked_at nullable
  created_at
```

### Expense

```text
Expense
  id
  client_id nullable
  group nullable
  friendship nullable
  description
  date
  original_amount
  original_currency
  converted_amount
  converted_currency
  exchange_rate
  exchange_rate_source
  split_method
  split_metadata
  created_by
  created_at
  updated_at
  deleted_at nullable
```

### ExpensePaymentShare

```text
ExpensePaymentShare
  id
  expense
  participant
  amount
  currency
```

### ExpenseOwedShare

```text
ExpenseOwedShare
  id
  expense
  participant
  amount
  currency
```

### Settlement

```text
Settlement
  id
  client_id nullable
  group nullable
  friendship nullable
  payer_participant
  receiver_participant
  amount
  currency
  created_by
  created_at
  updated_at
  deleted_at nullable
```

### ActivityEvent

```text
ActivityEvent
  id
  actor
  event_type
  group nullable
  friendship nullable
  expense nullable
  settlement nullable
  payload
  created_at
```

### ClientMutation

```text
ClientMutation
  id
  user
  client_mutation_id
  mutation_type
  request_payload
  response_payload
  status
  created_at
  processed_at nullable
```

## Money And Rounding Rules

Money should not use floats.

Rules:

- Use `Decimal`.
- Store currency as ISO 4217 code.
- Store amounts with appropriate decimal precision.
- Validate that payment shares sum to the converted expense amount.
- Validate that owed shares sum to the converted expense amount.
- Rounding remainders should be assigned deterministically.
- For equal splits, distribute smallest currency units in a stable participant order.
- Reject invalid percentage totals unless they sum exactly to 100 after accepted decimal precision.
- Reject exact splits unless they sum exactly to the total after rounding rules.

## Balance Calculation

Balances are derived from non-deleted expenses and settlements.

For each expense:

```text
participant_net += amount_paid_by_participant
participant_net -= amount_owed_by_participant
```

For each settlement:

```text
payer_net += settlement_amount
receiver_net -= settlement_amount
```

Interpretation:

- Positive net means the participant is owed money.
- Negative net means the participant owes money.

For the group detail screen, show the current user's balance with each other participant. This should be calculated from ledger entries involving both parties or allocated consistently from the same normalized shares. The planned balance view presents direct pairwise balances, not optimized settlement suggestions.

## Expense Creation Use Case

Service: `expenses.services.create_expense`

Inputs:

- actor user
- context: group or friendship
- description
- date
- original amount
- original currency
- payer shares
- split method input
- client id optional

Flow:

1. Authorize actor for context.
2. Resolve context participants.
3. Validate amount and currency.
4. Fetch latest exchange rate if needed.
5. Convert amount into context currency.
6. Normalize payer shares.
7. Normalize owed shares from split method.
8. Validate payment shares and owed shares.
9. Persist expense and share records in one transaction.
10. Create activity event.
11. Create notifications from activity event.
12. Return canonical expense representation.

## Settlement Use Case

Service: `settlements.services.create_settlement`

Inputs:

- actor user
- context: group or friendship
- payer participant
- receiver participant
- amount
- currency

Flow:

1. Authorize actor for context.
2. Validate payer and receiver belong to context.
3. Validate amount is positive.
4. Validate currency matches context currency.
5. Persist settlement in one transaction.
6. Create activity event.
7. Create notifications from activity event.
8. Return canonical settlement representation.

## Offline Sync Use Case

Endpoint:

```text
POST /api/sync/mutations/
```

Request:

```json
{
  "clientMutationId": "uuid",
  "type": "create_expense",
  "payload": {}
}
```

Flow:

1. Authenticate user.
2. Check for existing `ClientMutation` by user and client mutation id.
3. If processed, return stored response payload.
4. If new, create pending `ClientMutation`.
5. Dispatch to the relevant service.
6. Store response payload and processed status.
7. Return canonical response.

Initially supported offline mutation types:

- `create_expense`

Rejected offline mutation types:

- edit synced expense
- delete synced expense
- create settlement
- accept invitation
- create invitation
- rename participant
- change group settings

## API Surface

Initial REST endpoints:

```text
POST /api/auth/magic-link/
POST /api/auth/magic-code/
POST /api/auth/logout/

GET  /api/overview/

GET  /api/groups/
POST /api/groups/
GET  /api/groups/{group_id}/
GET  /api/groups/{group_id}/balances/
GET  /api/groups/{group_id}/expenses/
POST /api/groups/{group_id}/expenses/
POST /api/groups/{group_id}/settlements/
POST /api/groups/{group_id}/invitations/

GET  /api/friends/
POST /api/friends/invitations/

GET  /api/activity/

GET  /api/currency/rates/

POST /api/sync/mutations/
```

Later endpoints:

```text
PATCH  /api/expenses/{expense_id}/
DELETE /api/expenses/{expense_id}/
PATCH  /api/settlements/{settlement_id}/
DELETE /api/settlements/{settlement_id}/
POST   /api/notifications/device-tokens/
POST   /api/notifications/web-push-subscriptions/
```

## Permissions

General rules:

- Users can only access groups where their linked participant has active membership.
- Users can only access friend contexts where their participant is involved.
- Group members can create expenses in the group.
- Group members can rename unregistered group participants.
- Group members can create group invitations.
- Group members can create targeted invitations for unregistered participants.
- Only authorized context members can edit or delete expenses.
- Only authorized context members can create settlements.

## Activity Event Types

Initial event types:

```text
expense.created
expense.updated
expense.deleted
settlement.created
settlement.updated
settlement.deleted
group.created
group.member_invited
group.member_joined
group.member_renamed
friend.invited
friend.accepted
invitation.accepted
```

Activity payloads should include stable display data such as:

- actor display name
- expense description
- formatted or raw amount/currency
- group name
- affected participant display names

## Notification Flow

Flow:

```text
domain service
  -> database transaction
  -> activity event
  -> notification records
  -> push dispatch after commit
```

Rules:

- Push dispatch should run after the transaction commits.
- Push dispatch should run from the application process in the default one-container setup.
- Failed push delivery should mark notification delivery state but not undo the domain operation.
- Users should be able to see activity even if push fails.
- Push payloads should be small and avoid sensitive full detail where possible.

## Background Jobs

The default deployment must not require a separate background worker, Redis, or Celery. Keep the app simple enough to run as one container with SQLite.

Initial background-like responsibilities:

- Send magic login emails from the application process.
- Send push notifications from the application process after commit.
- Fetch currency rates on demand through the configured provider and cache them.
- Provide management commands for maintenance tasks where useful.

Rules:

- Domain data must be committed before external dispatch is attempted.
- Email and push dispatch should be triggered after database commit.
- External dispatch failures must not roll back the domain operation.
- Any maintenance command should be idempotent.
- Redis/Celery can be added later only if the simple setup proves insufficient.

## Currency Provider Interface

Currency conversion should depend on an interface, not a concrete provider.

Example:

```text
CurrencyRateProvider
  get_latest_rate(base_currency, quote_currency) -> ExchangeRateValue
```

Provider implementations can include:

- Configurable external API provider
- Manual/static provider for tests

The conversion service should:

- retrieve latest available rate
- convert using `Decimal`
- return converted amount plus rate metadata
- store rate metadata on the expense

## Testing Strategy

Required backend test layers:

- Pure unit tests for split calculation.
- Pure unit tests for balance calculation.
- Service tests for expense creation.
- Service tests for settlements.
- Service tests for invitation acceptance and participant claiming.
- API tests for authentication and permissions.
- Sync tests for idempotency.
- Currency conversion tests using fake providers.
- Activity event tests for important mutations.

Critical test cases:

- Equal split with rounding.
- Exact split validation failure.
- Percentage split validation failure.
- Multiple payer expense.
- Unregistered participant in group expense.
- Targeted invite links user to participant.
- Duplicate sync mutation returns original result.
- Settlement reduces balance correctly.
- Deleted expense no longer affects balance but remains auditable.

## Frontend Coordination Contract

The backend should return stable IDs and canonical state that the frontend can reconcile after offline sync.

Important API response requirements:

- Every expense has a server ID.
- Offline-created expenses can include a client ID.
- Sync responses include the original client mutation ID.
- Money fields are returned as strings, not floats.
- Currency codes are explicit.
- User-facing display strings should be composed by the frontend translation layer, not returned as fixed English sentences.

## Production Readiness Requirements

Before production:

- Add indexes for group membership, expense context/date, activity feed, and client mutation lookup.
- Rate-limit magic login and code verification.
- Hash invitation tokens at rest.
- Configure secure token issuance, refresh, revocation, and storage guidance.
- Add structured logging.
- Add health checks.
- Add pagination everywhere lists can grow.
- Add permission tests for all context endpoints.
- Add database constraints for share validity where possible.
- Document environment variables.
- Document deployment.
- Document SQLite backup/restore.
- Document optional external PostgreSQL configuration.

## Docker Compose Requirements

The project must include Docker Compose for local development and self-hosted deployment.

Default Compose should include exactly one required service:

- `app`: the application container.

The app container should:

- Run the Django backend.
- Serve the built PWA/static frontend from the same app container.
- Use SQLite by default with the database stored on a mounted volume.
- Support environment-based configuration for an external PostgreSQL database later.
- Expose health checks where practical.

Required environment documentation:

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `FRONTEND_PUBLIC_URL`
- `BACKEND_PUBLIC_URL`
- `DATABASE_URL`, optional, defaults to SQLite
- `SQLITE_PATH`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USE_TLS`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `DEFAULT_FROM_EMAIL`
- `CURRENCY_RATE_PROVIDER`
- `CURRENCY_RATE_API_BASE_URL`
- `CURRENCY_RATE_API_KEY`, optional depending on provider
- `FCM_PROJECT_ID`
- `FCM_CREDENTIALS_JSON` or documented file-based equivalent
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `ACCESS_TOKEN_LIFETIME_MINUTES`
- `REFRESH_TOKEN_LIFETIME_DAYS`

Rules:

- Compose files should not bake secrets into the repository.
- `.env.example` documents required variables.
- Local Compose should support one-command startup for the app.
- The default setup must not require PostgreSQL, Redis, Celery, or other sidecar containers.
- Production Compose should be an example baseline, not a hidden managed-cloud dependency.
- Database migrations should be explicit and documented, not silently run in every container start unless we deliberately choose that policy.
