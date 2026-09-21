# Mentoring PRO 360

Production-oriented application foundation for the Mentoring PRO 360 SaaS. It is a pnpm TypeScript workspace containing a NestJS API and a Next.js web application.

## Prerequisites

- Node.js 22.16 (see `.node-version`) with Corepack enabled
- pnpm 9 (activated by Corepack)
- Docker Desktop with Docker Compose for containerized local development

## Local development

1. Copy `.env.example` to `.env`. The checked-in values are local-only defaults; never reuse them outside a developer workstation.
2. Run `corepack enable` once, then `pnpm install`.
3. Start applications directly with `pnpm --filter @mentoring/api start:dev` and `pnpm --filter @mentoring/web dev`, or start the complete local stack with `docker compose up --build`.
4. Apply the database foundation with `pnpm --filter @mentoring/api migration:run`, then explicitly create the local tenant with `pnpm --filter @mentoring/api seed:development`.

Docker Compose starts PostgreSQL 15, Redis 7, MailHog, the API, and the web application. Its persistent named volumes retain database and Redis data between restarts. Use `docker compose down -v` only when local service data may be discarded.

| Service       | Address                            |
| ------------- | ---------------------------------- |
| Web           | http://localhost:3001              |
| API health    | http://localhost:3000/health       |
| API readiness | http://localhost:3000/health/ready |
| PostgreSQL    | localhost:5432                     |
| Redis         | localhost:6379                     |
| MailHog UI    | http://localhost:8025              |

## Environment and secrets

Copy `apps/api/.env.example` to `apps/api/.env` when running the API without Docker. The API validates configuration during startup. Local defaults make initial development practical; production requires a non-empty database password, both JWT key paths, and either a KMS key ID or an AES key of at least 32 characters.

Do not commit `.env` files, private keys, or production credentials. Production secret values and the files referenced by JWT paths must be supplied by the deployment platform's secret manager or workload identity. `NEXT_PUBLIC_*` variables are browser-visible and must never contain secrets.

## Tenancy and database foundation

The database uses five fixed PostgreSQL schemas: `iam`, `assessment`, `clinical`, `intelligence`, and `operations`. Every future tenant-scoped table must include `tenant_id`; schema names organize domains, while tenant IDs are the isolation boundary. The initial `operations.tenants` directory is intentionally not RLS-filtered so the application can validate a presented tenant before it enters a tenant transaction. `operations.tenant_settings` demonstrates the mandatory model: PostgreSQL RLS reads `app.current_tenant_id`, which is set with `SET LOCAL` only by `TenantScopedDataSource` after the active tenant is verified.

For local development only, supply an active database tenant UUID as `X-Tenant-Id` on non-health API requests. The resolver is isolated for replacement or extension by a future authenticated identity/subdomain resolver. Production rejects the development header setting and must provide that trusted resolver before non-public routes are enabled. Never grant the application database role `BYPASSRLS`; run migrations with a schema-owner role, then grant the runtime role only required schema/table permissions.

Migrations are versioned and repeatable through TypeORM's migration table, not by claiming all SQL is independently idempotent. Use `migration:revert` only for local development. The development seed is explicit, idempotent by slug, and refuses production execution.

Run the opt-in PostgreSQL RLS integration suite after Compose is healthy with `pnpm --filter @mentoring/api test:integration`; it is intentionally not part of the default unit suite.

## IAM security foundation

IAM data is tenant-scoped and protected by RLS. The migration creates immutable `iam.audit_log` records, canonical roles, users, role assignments, sessions, refresh-token hashes, TOTP secret envelopes, recovery-code hashes, and consent records. Canonical roles are global reference data: they contain no tenant data and use the exact hierarchy documented in the migration. Their permissions expressly exclude clinical/PHI access from **Super Admin** and complete clinical-record access from **Recepción & Admisión**.

Generate an RS256 keypair outside the repository (for example `openssl genrsa -out jwt-private.pem 3072` and `openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem`). Configure only file paths/secret mounts. Never place private key material or `IAM_ENCRYPTION_KEY` in source control. The encryption key is a base64-encoded 32-byte value used for AES-256-GCM TOTP envelopes. Access tokens are RS256 and default to 15 minutes; browser refresh tokens are random, Argon2id-hashed, single-use, and delivered only via an HttpOnly/Secure/SameSite=Strict `/auth` cookie.

Public registration and public super-admin bootstrap are deliberately absent. Provision the first tenant administrator through a controlled migration/operator workflow after creating the tenant, assign **Director / Admin**, and enroll TOTP before granting privileged use. Authentication endpoints require the existing validated tenant context (`X-Tenant-Id` only in documented development mode). Rate limiting requires a Redis-backed throttling middleware and is not yet enabled; do not expose the API publicly until that infrastructure and the production identity resolver are deployed.

Authentication controls require Redis. Login is limited to five attempts per IP per 15 minutes and refresh is limited to ten attempts per user per minute. Logout and detected refresh-token reuse write Redis denylist keys using the remaining configured refresh lifetime. Redis unavailability fails these security operations with a 503 rather than allowing authentication to proceed. Explicit `@Audit()` routes write sanitized, non-PHI metadata after handler success; transactional service audit writes remain the authoritative mechanism for existing IAM state changes.

Rate-limit exceedance returns RFC 7807 status **429** and a `Retry-After` header derived from Redis key TTL. The fixed-window counter increment/expiry operation is atomic in Redis Lua; users/IPs map to distinct Redis keys.

## Verification

Run the same checks as CI:

```sh
pnpm format:check
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```
