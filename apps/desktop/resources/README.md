# Yunwu Desktop Resources

The desktop shell starts the local Docker Compose stack with bundled compose files:

1. bundled `infra/docker-compose.yml`
2. bundled `infra/docker-compose.desktop.yml`

Runtime files are generated under Electron `app.getPath("userData")`, including
`.env`, `docker-compose.override.yml`, and `desktop.log`.

Release builds run `docker compose pull` followed by `docker compose up -d` and
use GHCR images by default. Development builds use `docker compose up -d --build`
against the repository fallback. Set `YUNWU_DESKTOP_BUILD=1` and
`YUNWU_DESKTOP_APP_SOURCE_DIR` only when an explicit local build is required.
