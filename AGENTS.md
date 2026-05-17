# AGENTS.md

## Engineering Standards

- Make production-ready changes. Avoid temporary shortcuts, TODO-driven implementations, and "will fix later" behavior.
- Prefer clear, maintainable code over cleverness.
- Keep changes scoped to the requested behavior and surrounding ownership boundaries.
- Follow DRY principles, but only introduce abstractions when they remove real duplication or simplify the code.
- Preserve existing project conventions before adding new patterns.
- Keep user-facing text translatable. Do not hard-code UI strings in components.
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
- Use `pyproject.toml` for dependency and tooling configuration.
- Prefer explicit transactions around multi-step writes.
- Soft-delete business records when history/auditability matters.

## Frontend Preferences

- Use React, Expo, and TypeScript with strict typing.
- Build both PWA and Android-compatible UI unless a feature is explicitly platform-specific.
- Keep screens focused. Extract shared UI and reusable behavior when components grow large.
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

- Run relevant type checks, builds, migrations, and tests after implementation.
- Fix type errors and obvious runtime errors before handing work back.
- When a check cannot be run, state that clearly with the reason.
- Do not revert user changes unless explicitly asked.
