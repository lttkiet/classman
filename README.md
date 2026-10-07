# Classman

A full-stack tutoring center workspace for learners, groups, teaching sessions, lesson plans, assignments, progress notes, and staff access.

## Stack

- Next.js App Router and TypeScript
- PostgreSQL with Prisma ORM and migrations
- Better Auth with email/password, email verification, and password reset
- Center-scoped REST API under `/api/v1`

## Shared document library

Owners and managers can upload PDF, Word, PowerPoint, plain text, and PNG/JPEG/WebP image files up to 15 MB. A document can be shared with the whole center, one grade, or one class. Teachers see common documents and grade/class documents connected to students assigned to them. File contents are stored in PostgreSQL with their center-scoped metadata; removing a grade or class moves its documents into the common library.

## Local setup

1. Install Node.js 20.9 or newer, Docker Desktop, and npm dependencies with `npm install`.
2. Run `npm run dev:setup` to fill missing `.env` values, start the local PostgreSQL container, apply migrations, and generate Prisma Client. On an empty database it creates a demo admin and sample center records.
3. Start the app with `npm run dev`. Owners and managers provision staff from the Team page by inviting an email address and assigning a role.
4. In development without SMTP, verification, reset, and invitation emails are printed to the server terminal. Invitees open the link, set a password, and verify their email before joining.

`dev:setup` is strictly for local development. It refuses production, Vercel, CI, and non-local database or app URLs. On a new local database it uses `admin@classman.test` / `ClassmanDev123!`; change those development credentials before sharing the environment. Existing database data is preserved and skips the demo bootstrap and seeding.

`npm run db:deploy` applies checked-in migrations in a deployment environment. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, and SMTP settings in the hosting provider. Keep `BETTER_AUTH_URL` and `APP_URL` on the public app origin. Email verification and team invitations require a working SMTP configuration in production.

## Roles and data access

- Owners and managers can manage center records and staff.
- Teachers see assigned learners and their sessions, notes, assignments, and progress. They can create sessions and learning notes, update their own session details and attendance, and mark assigned work complete.
- The deployment has one center. Each account can hold one center membership, and each data API operation is scoped to that center. Client requests cannot choose a center ID.
- Learners do not have login accounts in this release.

## API

Authenticated resource routes are available at `/api/v1/{grades|learners|groups|sessions|lessons|notes|assignments|progress}` with `GET` and `POST`; individual IDs support `GET`, `PATCH`, and `DELETE` subject to role access. The shared library uses `GET`/`POST /api/v1/library`, `GET`/`DELETE /api/v1/library/:id` for authorized file downloads and removal. Additional routes handle initial center setup, group rosters, team invitations, and role changes. Authentication is served at `/api/auth/*`.

## Checks

Run `npm test`, `npm run lint`, and `npm run build`. The auth and email flows need a database and a configured sender to verify end to end. A manual QA checklist for roles, tenants, and teaching workflows is included in `tests/manual-qa.md`.
