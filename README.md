# FB Orders Tracking — Supabase rebuild

A separate rebuild of the order and inventory app, using React, TypeScript, Vite and Supabase. This repository is independent of the original app and its database.

## Run locally

Use Node.js 24 and npm.

~~~sh
npm ci
npm run dev
~~~

Open http://127.0.0.1:5186 . Without backend configuration the app uses local demo data. Demo changes stay in browser storage.

## Connect the rebuild backend

Copy .env.example to .env.local and configure the separate Supabase project with VITE_DATA_MODE=supabase, VITE_SUPABASE_URL and its browser publishable key in VITE_SUPABASE_ANON_KEY. Never use a secret or service-role key in the frontend.

Database schema and trusted operations are in supabase/migrations. Do not run them on the original application database. Existing hosted rebuild projects already have these migrations applied. Do not reinitialize an existing database. Authentication requires an approved workspace membership; signing up alone does not grant business-data access.

The source deliberately refuses the original app's Supabase URL. This is the project's golden rule: the original app and database remain untouched.

## Checks and build

~~~sh
npm run lint
npm test
npm run test:database
npm run build
~~~

The database tests run in an isolated embedded Postgres engine, without a hosted database. npm run test:import is optional and requires the private export file described in local-review/import.test.mjs; customer exports and backups are intentionally absent from this repository.

## Features

- Orders, delivery dates, carry-over orders, customer contact links and WhatsApp.
- Inventory, independent variant stock, bundles, archives, restocks and FIFO costing.
- Multi-product and multi-variant orders, delivery stock validation and exact reversals.
- Profit and analytics, shared daily delivery costs and configurable default order costs.
- Employee bonuses, per-employee earning stages and guarded payout accounting.
- Supabase email/password sign-in, workspace separation and database-enforced roles.

## Private data

Credentials, environment files, customer exports, backups, migration payloads, generated builds and local review reports are excluded. The app source contains no imported customer database. The SQL and migration scripts are source code, not a production data dump. Auth accounts and database records are not included in a Git push.

Initial UI source: https://github.com/ecomtanger1-hue/fb-orders . This repository contains the separate Supabase rebuild and subsequent improvements.
