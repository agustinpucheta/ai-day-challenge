# API HTTP inicial (propuesta)

Prefijo: `/api/v1`. Los nombres definitivos pueden ajustarse durante la implementación, pero deben conservar aislamiento por sesión y respuestas tipadas.

## Auth local

- `POST /auth/register` — registro local solo habilitado para el modo local configurado; normaliza email, valida contraseña y crea hash seguro.
- `POST /auth/login` — crea una sesión de servidor.
- `POST /auth/logout` — invalida sesión.
- `GET /auth/me` — devuelve `userId`, display name y estado de conexión Jira; nunca password/hash/token.

## Conexión Jira (modo API token, D-023)

Requieren sesión; el usuario sale siempre de la sesión.

- `GET /jira/connection` — `{ mode: 'api_token', status: 'not_configured' | 'configured', siteUrl: string | null }`. No llama a Jira y no devuelve secretos.
- `POST /jira/connection/verify` — llama a Jira `GET /rest/api/3/myself` (solo lectura) y devuelve `{ status: 'connected', siteUrl, displayName, checkedAt }`. Nunca incluye email, accountId ni token. Errores: ver la tabla de abajo.

## Jira OAuth y conexiones (modo dormido)

- `GET /jira/oauth/start` — requiere login; crea state server-side y redirige a Atlassian.
- `GET /jira/oauth/callback` — callback OAuth; state one-time, manejo seguro de error y code.
- `GET /jira/connections` — conexiones del usuario actual y estado sanitizado.
- `DELETE /jira/connections/:id` — desconectar conexión propiedad del usuario actual.

## Issues/dashboard

- `GET /jira/issues/search?q=...` — búsqueda limitada, paginada y validada con el token del usuario actual.
- `GET /dashboard/issues/:issueKey` — vista agregada del issue, métricas, subtareas, links y metadata de actualización.
- `GET /jira/issues/:issueKey/transitions` — devuelve opciones válidas desde Jira.
- `POST /jira/issues/:issueKey/transitions` — body con `transitionId`; solo permite ID ofrecido por Jira después de revalidar; requiere confirmación UI explícita.
- `POST /users/me/tracked-issues` — body con `jiraConnectionId`, `issueKey` (o `issueId`); comprobar acceso a través de esa conexión.
- `GET /users/me/tracked-issues` — recupera seguimientos del usuario y carga/actualiza métricas según estrategia de cache.
- `DELETE /users/me/tracked-issues/:id` — solo el propietario puede quitarlo.
- `GET /users/me/preferences` — devuelve las preferencias del propio usuario.
- `PATCH /users/me/preferences` — actualiza solo campos permitidos con DTO tipado.

## Forma de respuesta orientativa

```ts
interface DashboardIssueResponse {
  issue: {
    id: string;
    key: string;
    summary: string;
    issueType: string;
    status: string;
    statusCategory: string | null;
    url: string;
    parentKey?: string | null;
  };
  progress: {
    completed: number;
    total: number;
    percent: number | null;
    basis: 'subtasks' | 'children' | 'none';
  };
  subtasks: {
    completed: number;
    pending: number;
    inProgress: number;
    items: Array<{ key: string; summary: string; status: string; url: string }>;
  };
  weeklyStoryPoints: Array<{
    weekStart: string;
    storyPoints: number;
    completedIssues: number;
    isApproximate: boolean;
  }>;
  dependencies: {
    blockers: Array<{ key: string; summary?: string; status?: string; url?: string; inaccessible?: boolean }>;
    blockedIssues: Array<{ key: string; summary?: string; status?: string; url?: string; inaccessible?: boolean }>;
  };
  metadata: { fetchedAt: string; isStale: boolean; warnings: string[] };
}
```

El tipo es un contrato conceptual. Ajustar `weeklyStoryPoints`, nombres de estados y métricas según lo que realmente devuelva Jira. No incluir datos de issues a los que el usuario no tenga acceso.

## Errores normalizados

- `UNAUTHENTICATED`: sesión no válida.
- `JIRA_NOT_CONNECTED` (HTTP 409): faltan las credenciales de Jira (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`) o no hay conexión activa.
- `JIRA_REAUTH_REQUIRED` (HTTP 424): Jira respondió 401; el API token es inválido, venció o fue revocado (o refresh expirado/revocado en modo OAuth). Hay que reemplazar el token.
- `JIRA_FORBIDDEN` (HTTP 424): Jira respondió 403; la cuenta no tiene permiso.
- `ISSUE_NOT_FOUND_OR_INACCESSIBLE`: no revelar si un issue existe sin permiso.
- `JIRA_RATE_LIMITED` (HTTP 429, con `Retry-After` si Jira lo envía): informar y reintentar según reglas.
- `JIRA_UNAVAILABLE` (HTTP 503): fallo upstream (5xx, red, timeout o respuesta inesperada); conservar respuesta anterior como stale si es seguro.
- `INVALID_TRANSITION`: transition ID inválido o ya no disponible.
- `VALIDATION_ERROR`: entrada local inválida.

Los errores de Jira por credenciales (`JIRA_REAUTH_REQUIRED`, `JIRA_FORBIDDEN`) usan HTTP 424 (Failed Dependency) y no 401/403, para que el frontend no los confunda con una sesión de la aplicación vencida (`UNAUTHENTICATED`, 401) ni con un origen rechazado (`FORBIDDEN_ORIGIN`, 403). El cliente debe decidir por `code`, no solo por el estado HTTP.
