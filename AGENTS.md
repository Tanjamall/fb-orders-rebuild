# Golden rule

This is the separate Supabase rebuild. Never modify or deploy the original app or connect this code to the original database. Never publish credentials, customer exports, backups or migration payloads. Keep workspace authorization in the database. Do not automatically apply migrations to an existing hosted project. Validate source changes with npm run lint, npm test and appropriate database checks.
