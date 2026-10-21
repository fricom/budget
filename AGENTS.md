# Repository Guidelines

## Project Structure & Module Organization

The primary product is the Expo/React Native app in `app/`. Routes live in `app/src/app/`, reusable UI in `app/src/components/`, hooks and data access in `app/src/hooks/` and `app/src/lib/`, and static files in `app/assets/`. Product behavior is documented in `scenarios/`. Supabase SQL is kept in `db/schema.sql` and `db/functions.sql`.

The root `scripts/` directory contains CommonJS utilities for the legacy Google Sheets budget. Apps Script code is under `scripts/apps-script/`; historical one-off migrations in `scripts/archive/` are reference material. Generated reports belong in `report/`.

## Build, Test, and Development Commands

Run app commands from `app/`:

- `npm install` installs locked Expo dependencies.
- `npm start` launches the Expo development server.
- `npm run ios`, `npm run android`, or `npm run web` opens a platform.
- `npm run lint` runs Expo's lint checks.
- `npx tsc --noEmit` performs a strict TypeScript check.

From the root, `npm install` installs legacy-script dependencies. Run utilities explicitly, for example `node scripts/check-errors.js`; review spreadsheet side effects first. Root `npm test` is a failing placeholder.

## Coding Style & Naming Conventions

Use TypeScript for app code, two-space indentation, semicolons, and single quotes, following nearby files. Name React components and exported types in `PascalCase`, hooks with a `use` prefix, and files in lowercase kebab-case (for example, `onboarding-flow.tsx`). Prefer the `@/` path alias for imports from `app/src`. Keep database identifiers in `snake_case` and preserve established spreadsheet tab and column names in integration scripts.

## Product Copy Guidelines

Write user-facing Korean in plain, conversational language that a non-technical household user can understand immediately. Replace internal terminology, abbreviations, compact noun phrases, and borrowed jargon such as “태깅”, “트래킹”, “동기화”, or “프리셋” with a complete sentence that explains the user's action or the resulting behavior. Avoid slash-separated phrases when “과/와” or a full sentence reads more naturally.

Before finalizing any new or revised copy, proofread it for Korean spelling, spacing, particles, and sentence flow. Keep compound phrases spaced correctly (for example, `아이 이름`, not `아이이름`). Show required or optional status on the related field label and do not repeat the same status in helper text unless the repetition prevents a real misunderstanding.

## Testing Guidelines

No automated test framework or coverage threshold is configured. Before submitting app changes, run lint and TypeScript checks, then exercise the affected flow on an Expo target. Document the route and device or browser used. For SQL or spreadsheet changes, verify against non-production data and record affected tables, sheets, ranges, or formulas. Colocate future tests as `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit prefixes such as `feat:`, `fix:`, and `docs:` followed by a concise description. Keep each commit focused. Pull requests should explain the user-visible outcome, list validation performed, link relevant issues or scenario documents, and include screenshots or recordings for UI changes. Call out schema migrations, environment changes, and spreadsheet side effects explicitly.

## Security & Configuration

Copy `app/.env.example` for local configuration and never commit credentials, Supabase secrets, OAuth tokens, or Google service-account JSON. Supabase changes must preserve tenant isolation and Row Level Security.
