# AGENTS.md

## Engineering Standards

- Make production-ready changes. Avoid temporary shortcuts, TODO-driven implementations, and "will fix later" behavior.
- Prefer clear, maintainable code over cleverness.
- Keep changes scoped to the requested behavior and surrounding ownership boundaries.
- Follow DRY principles, but only introduce abstractions when they remove real duplication or simplify the code.
- When two functions or views diverge only by a parameter or context, extract a shared helper rather than maintaining near-twins.
- When a switch over the same enum/discriminator appears in multiple places, build a strategy registry (a map of cases to handlers). Adding a new case should be one entry, not edits in five files.
- Match field names across DB, API, and frontend types. A field renamed in one layer must be renamed in the others in the same change.
- Use constants (Python class or TS literal-union module) for stable string identifiers - event names, route keys, error codes. No bare string literals at call sites.
- Separate assertion helpers (`assert_X` that raise) from getter helpers (`get_X` that return). A single function should not both raise on failure and return a meaningful value via the same call shape.
- Helpers should handle their own `None`/empty inputs. Don't make every caller write `helper(x) if x else ""`.
- Preserve existing project conventions before adding new patterns.
- Keep user-facing text translatable. Do not hard-code UI strings in components.
- During implementation, only English and German copy are maintained actively. Other locale files may lag and must fall back to English for any missing keys.
- When adding or changing i18n keys, edit **only** `en.json` (the source of truth) and `de.json`. Never hand-fill the other `locales/*.json` files - and in particular never copy English text into them to satisfy the key-parity test. Leave them untouched; the translation pipeline fills them later and they fall back to English at runtime until then. Expect `locale.test.ts` parity to be red for the unmaintained locales on a feature branch; that is reconciled by the separate "add translations" step, not by you.
- Use typed, structured data instead of ad hoc string parsing where reasonable.
- Handle loading, empty, error, and success states explicitly for user-facing flows.
- Do not introduce cloud-only infrastructure requirements unless explicitly requested.

## Backend Preferences

- Use Python and Django idiomatically.
- Keep backend code organized around clean architecture boundaries where Django allows it:
  - models define persistence shape,
  - services contain business rules and write workflows,
  - selectors/read helpers contain query-heavy read behavior,
  - API views stay thin and delegate domain behavior.
- Lean toward domain-driven naming and workflows.
- Validate permissions and domain invariants in backend services, not only in the frontend.
- Permission checks belong in one helper per resource (e.g. `assert_group_member`, `ensure_friendship_member`) applied at the view boundary. Don't reimplement the membership predicate inline in every view.
- Use `get_object_or_404` (or equivalent) for primary-key lookups. Avoid raw `.get(id=...)` in views - it surfaces as a 500.
- Pagination logic (limit/offset clamping, ordering, slicing) belongs in selectors. Views should pass query-params through, not implement the clamping themselves. Magic limits live as named constants.
- Don't reimplement the same algorithm for adjacent contexts (e.g. group vs friendship). Factor the shared shape into a helper that takes a queryset filter.
- Create/update flows for the same entity share a helper (e.g. `_replace_expense_shares`). Don't duplicate the share-rebuild logic between `create_*` and `update_*` services.
- Use `pyproject.toml` for dependency and tooling configuration.
- Prefer explicit transactions around multi-step writes.
- Soft-delete business records when history/auditability matters.
- Project targets Python 3.8+. Don't use PEP 604 `X | None` or PEP 585 `list[X]`/`dict[X, Y]` as runtime annotations. Either use `from __future__ import annotations` at the top of the module or use `Optional`/`List`/`Dict` from `typing`.

## Frontend Preferences

- Use React, Expo, and TypeScript with strict typing.
- Build both PWA and Android-compatible UI unless a feature is explicitly platform-specific.
- Keep screens focused. Extract shared UI and reusable behavior when components grow large.
- Leaf components, sheets, and dialogs should self-resolve cross-cutting utilities (`useI18n`, `useTheme`, formatters, theme colors) from context or imports. Don't prop-drill `t`, `formatMoney`, `surfaceColor`, etc. - a sheet's props should describe its data and callbacks, nothing else.
- Use `t(key, params)` interpolation for placeholders. Never chain `.replace("{name}", value)` at call sites.
- Use `useFocusEffect(useCallback(…))` for on-focus reloading. Do not subscribe manually to `navigation.addListener("focus", …)` - pick the framework primitive once and use it everywhere.
- Repeated inline styles (`{ fontWeight: "700" }`, `{ marginTop: 8 }`, `{ alignSelf: "center" }`) belong in `shared/ui/styles.ts`. Inline styles in JSX are reserved for genuinely one-off values.
- When extending an enum-like discriminator (`SplitMethod`, `ActiveSheet`, payment kind), the change should land in one strategy/registry, not as scattered `if/else` branches across components.
- Caching, pagination, and infinite scroll have shared primitives (`cacheStore<T>`, `useInfiniteScroll`, `paginated_ledger_response` on the backend). Use them - don't re-implement.
- Don't construct synthetic objects to satisfy a function signature (e.g. fake `Participant` to call `participantName`). Guard at the boundary and return the literal fallback.
- For set-equality, test both length and membership (`a.length === b.length && a.every(x => b.includes(x))`). Length-only is a bug waiting to surface.
- Prioritize fast, low-friction UX for frequent workflows.
- Use a component framework consistently for polished, accessible controls.
- Support dark mode.
- Prefer familiar controls:
  - bottom tabs for primary navigation,
  - bottom sheets for focused selections,
  - tabs or segmented controls for mode switching,
  - searchable lists when option sets can grow.
- Avoid raw IDs, JSON payloads, or technical implementation details in end-user forms.
- Make offline behavior explicit. Only allow offline workflows that can sync safely.
- Debug logging in API/client code must be gated behind a dev flag (e.g. `__DEV__`, `EXPO_PUBLIC_API_DEBUG`). Don't ship URL-filtered debug logs to production.

## Authentication And Tokens

- Use access and refresh tokens.
- Keep access tokens short-lived.
- Keep refresh tokens long-lived enough to avoid frequent re-login for normal users.
- Refresh tokens automatically before logging users out.
- Store and clear tokens consistently across web and mobile.

## Deployment Preferences

- Keep the default self-hosted setup simple.
- Prefer a single application container for the app.
- Serve the PWA from the same app container unless there is a strong reason not to.
- Use SQLite by default for a low-friction setup, while keeping the code compatible with a later move to PostgreSQL.
- Configure domains and external service credentials through environment variables.

## Quality Gates

- Run relevant type checks, builds, migrations, and tests after implementation. The standard set:
  - Frontend: `npx tsc --noEmit` (from `frontend/`) and `npm test`.
  - Backend: `pytest` (from `backend/`), `ruff check src`, and a Django system check (`python manage.py check` or equivalent).
- Fix type errors and obvious runtime errors before handing work back.
- When a check cannot be run, state that clearly with the reason.
- Do not revert user changes unless explicitly asked.
- After any refactor that touches a file, verify the file still represents your intended state - IDE diagnostics and tooling may surface stale snapshots; trust the command-line check.

## Testing Requirements

- **Every change ships with tests.** Bug fixes, new features, refactors, and edge-case patches all need at least one test that would fail without the change. This is required so that automatic dependency updates remain safe to merge.
- For pure logic, add a unit test next to the file (`foo.test.ts` / `test_foo.py`).
- For backend services, write `@pytest.mark.django_db` integration tests that exercise the full create/update/delete path including the activity event and notification side-effects where they exist.
- For frontend logic that lives inside a screen component, extract the function to a `*Helpers.ts` module and test the pure function. Don't try to test deeply through React rendering unless a render-test harness is already in place.
- When the change cannot be tested (e.g. third-party-only integration, infra config), say so explicitly and explain why - don't silently skip.
- Tests are not optional. If you find yourself wanting to skip them "because the change is small", write one anyway.
