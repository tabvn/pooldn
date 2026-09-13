# PoolDN



## Techs
- Next.js
- shadcn/ui
- @base-ui/react 
- Tailwind CSS
- TypeScript
- Prisma
- @pothos/core 
- @pothos/plugin-prisma
- PostgreSQL
- @apollo/client-integration-nextjs 
- apollo client
- graphql-yoga 
- react-hook-form (use for all Forms)
- zod (use for all Forms validation)
- graphql-codegen/cli (use for generate types from graphql schema)
- CASL (use for authorization)
- @casl/ability
- @casl/prisma
- @casl/react



## Local database 


```psql -U toan -d postgres ```

postgresql://toan@localhost:5432/pooldn





## Production — docker compose

The stack is Next.js + Postgres 17 + Redis 7. Host ports are all in the 9xxx
range so it never collides with the bare-metal prod run on :8084, the e2e
server on :3000, or CargoDesk on :8085.

| service | host port | notes |
| --- | --- | --- |
| app | `9084` → 8084 | point the pooldn.com tunnel / reverse proxy here |
| postgres | `127.0.0.1:9432` → 5432 | loopback only |
| redis | `127.0.0.1:9379` → 6379 | loopback only |

```bash
cp .env.docker.example .env.docker      # fill in AUTH_SECRET, ADMIN_PASSWORD, SMTP, OAuth
docker compose --env-file .env.docker up -d --build
```

On boot the container waits for Postgres, runs `prisma migrate deploy`, then
runs `prisma/seed-admin.ts` — which creates **one country, one city and one
SUPER_ADMIN** and nothing else. The demo seed (`prisma/seed.ts`, with its
venues, teams and fixtures) is never run in this stack.

The admin bootstrap is idempotent, so restarts do not duplicate the account
and do not reset a password that has since been changed in-app. Set
`ADMIN_FORCE_PASSWORD=true` for one run to overwrite the hash.

### Refreshing the database

`RESET_DB=true` in `.env.docker` drops the schema, replays every migration,
skips the seed and recreates the admin. It is destructive — set it, run
`docker compose --env-file .env.docker up -d --force-recreate app`, then set
it back to `false`.

### Notes

- `NEXT_PUBLIC_APP_URL` is inlined at **build** time. Changing the domain
  needs `up -d --build`, not just a restart.
- `APP_ORIGIN_ALLOWLIST` gates the session as well as OAuth. A request on a
  host that is neither `NEXT_PUBLIC_APP_URL` nor in the allowlist renders as a
  guest even with a valid cookie, and auth cookies are `Secure` in production
  — so `http://localhost:9084` will show signed-out pages until you put HTTPS
  in front of it.
- Uploads live in the `uploads` volume, mounted at `/app/uploads`.
