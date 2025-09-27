# Repository Guidelines

## Project Structure & Module Organization
- `backend/web/` — Express + TypeScript API (`src/` contains `controllers/`, `routes/`, `services/`, `config/`).
- `frontend/web/` — React + TypeScript app (Vite, Tailwind, ESLint) in `src/`.
- `database/` — SQL migrations and utilities.
- `infrastructure/` — deployment and ops (`scripts/`, `systemd/`, `sql/`).
- `docs/` and top-level `*.md` — living documentation; prefer updating rather than duplicating.

## Build, Test, and Development Commands
- Backend: `cd backend/web`
  - `npm run dev` — start API with tsx + nodemon on port 3001.
  - `npm run build && npm start` — compile TypeScript and run from `dist/`.
- Frontend: `cd frontend/web`
  - `npm run dev` — Vite dev server on port 5173.
  - `npm run build` — production build; `npm run preview` to serve build.
- Infra helpers: `infrastructure/scripts/start-servers.sh` and `stop-servers.sh` manage services locally.

## Coding Style & Naming Conventions
- TypeScript everywhere; 2-space indentation; no trailing semicolons preference enforced by project configs.
- React components: PascalCase files (e.g., `EstimateTable.tsx`); hooks start with `use*`.
- Variables/functions: camelCase; constants UPPER_SNAKE_CASE; SQL files kebab or numeric prefixes (e.g., `05_create_users_table.sql`).
- Linting: Frontend uses ESLint (see `frontend/web/eslint.config.js`). Run `npm run lint` in `frontend/web`.

## Testing Guidelines
- Current status: no automated tests committed. When adding:
  - Frontend: Vitest + Testing Library; name files `*.test.tsx` colocated under `src/`.
  - Backend: Jest + supertest; name files `*.test.ts` under `tests/` or alongside modules.
  - Aim for >70% coverage on changed code; include API contract tests for new routes.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`. Scope optional (e.g., `feat(frontend): add estimate grid`).
- PRs must include: concise summary, linked issue (if any), screenshots/CLI output for UI/API changes, migration notes (if touching `database/`), and `.env` changes (if new config keys).
- Keep changes focused; avoid cross-area refactors in feature PRs.

## Security & Configuration Tips
- Backend env: `PORT`, `CORS_ORIGIN`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (see `backend/web/.env`). Never commit secrets.
- Principle of least privilege for DB users; verify `/api/health` before deploys.
- Do not introduce new dependencies without discussing impact (size, security, licensing).


- Do not run git commands unless explicitly requested by the user.

## Communication Expectations
- When direction is unclear or requirements could be interpreted multiple ways, pause and ask the user for clarification instead of assuming the intent.
