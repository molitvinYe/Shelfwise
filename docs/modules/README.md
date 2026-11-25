# Module specs

One file per module. Each spec lists: purpose, owned data, dependencies, endpoints / routes, business rules, validation, security, tests and an implementation checklist. The roadmap step that builds it is linked at the top.

## Backend (`apps/api/src/modules`)

| Module | Spec | Roadmap step |
|--------|------|--------------|
| health | [health.md](health.md) | 3, 5 |
| auth | [auth.md](auth.md) | 6 |
| users | [users.md](users.md) | 6, 11 |
| books | [books.md](books.md) | 7–9 |
| shelves | [shelves.md](shelves.md) | 10–11 |
| collections | [collections.md](collections.md) | 12 |
| admin | [admin.md](admin.md) | 13 |
| ai | [ai.md](ai.md) | 15–16 |

## Packages & apps

| Part | Spec | Roadmap step |
|------|------|--------------|
| `packages/shared` | [shared.md](shared.md) | 1 (grows with every module) |
| `apps/web` | [web.md](web.md) | 1, 6, 8, 10–12, 16 |
| Infrastructure (Docker, CI, deploy) | [infra.md](infra.md) | 2, 4, 5, 18 |

## Spec template

```markdown
# <module>
> Roadmap: step N · Depends on: ...

## Purpose
## Owns (data)
## Endpoints
## Business rules
## Validation (shared schemas)
## Security
## UI (if any)
## Tests
## Implementation checklist
```
