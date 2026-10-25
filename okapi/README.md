# Okapi Todo App

This repository is deliberately split by deployable unit:

```text
okapi/
├── frontend/   # React 19 + Vite + Tailwind CSS v4
├── backend/    # Spring Boot API + Liquibase migrations (PostgreSQL)
└── todo.jdl    # Original JHipster entity definition
```

## Prerequisites

- JDK 21+
- Node 20+
- PostgreSQL 14+ running locally

## Database

Both the `dev` and `prod` profiles connect to a PostgreSQL database named `todoapp`.
Create it once:

```bash
createdb todoapp
```

The connection details live in `backend/src/main/resources/config/application-dev.yml`
(and `application-secret-samples.yml`, which overrides the credentials). Change the
`username`/`password` there if your local Postgres role differs.

Liquibase creates the schema and loads the demo accounts on first start, so there is no
manual migration step.

## Local development

In separate terminals:

```bash
cd backend && ./mvnw
cd frontend && npm install && npm start
```

The React dev server runs on `http://localhost:9000` and proxies `/api` and `/management`
to the Spring Boot API on `http://localhost:8080`. Point it elsewhere with `API_URL`:

```bash
API_URL=http://localhost:8081 npm start
```

Use `user` / `user` for the generated demo account, or `admin` / `admin` for an
administrator. You can also create a fresh account from the sign-up screen.

### Registration and email

Registration normally emails an activation link. There is no SMTP server in local
development, so `application-dev.yml` sets:

```yaml
application:
  registration:
    auto-activate: true
```

New accounts are then usable immediately. Leave this unset (it defaults to `false`) in any
environment that has a real mail server, and the activation-email flow applies as before.

## Build each deployable unit

```bash
cd backend && ./mvnw verify
cd frontend && npm run build
```

`frontend/dist/` is the static React build. `backend/target/*.jar` is the Spring Boot
artifact. They are intentionally independent, so you can give each its own Dockerfile and
Kubernetes deployment.

Because the frontend is a single-page app, whatever serves `frontend/dist/` must fall back
to `index.html` for unknown paths (`try_files $uri /index.html;` in nginx), otherwise a
refresh on `/settings` returns a 404.

### Running the backend against production settings

```bash
cd backend && ./mvnw -Pprod
```

Tests run against a throwaway PostgreSQL container via Testcontainers in both profiles, so
Docker needs to be available for `./mvnw verify`.

## Frontend notes

- Tailwind CSS v4 — the theme and both colour schemes are defined in `src/index.css`;
  there is no `tailwind.config.js`.
- Auth is a JWT read from the `id_token` field of `POST /api/authenticate`, stored in
  `localStorage` when "keep me signed in" is ticked and `sessionStorage` otherwise.
- Icons are inline SVG. The backend's Content-Security-Policy only allows `'self'` and
  `data:` sources, so no external fonts or icon CDNs will load.

## Kubernetes deployment

The handwritten k3s manifests, complete deployment procedure, field-by-field YAML
explanations, verification commands, update workflow, and troubleshooting guide are in
[`k8s/README.md`](k8s/README.md).
