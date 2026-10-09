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

- `GET /jira/issues/search?q=<texto|CLAVE>&pageToken=<opaco>&pageSize=<1..50, default 20>` — búsqueda de solo lectura con las credenciales resueltas en el backend (el usuario sale solo de la sesión). `q` se recorta y debe tener 2 a 100 caracteres sin caracteres de control; `pageToken` es el cursor opaco (máx. 2000 caracteres, charset URL-safe) devuelto como `nextPageToken`. Responde `{ items: IssueSummary[], nextPageToken: string | null, metadata: { fetchedAt, isStale: false } }` con `IssueSummary = { key, summary, issueType: { id, name, hierarchyLevel, isSubtask }, status: { name, categoryKey, isCancelled }, url }`. Una lista vacía con 200 significa "sin resultados"; todo fallo de Jira responde con su código de error y nunca con `items: []`. Entrada inválida: 400 `VALIDATION_ERROR` sin llamar a Jira.
- `GET /dashboard/issues/:issueKey` — detalle del issue con subtareas y story points (ver `DashboardIssueResponse`). La clave se valida con el patrón de claves de issue antes de llamar a Jira (400 `VALIDATION_ERROR` si es inválida). Un issue inexistente o sin permiso responde el mismo 404 `ISSUE_NOT_FOUND_OR_INACCESSIBLE` (mismo estado, cuerpo y headers).
- `GET /jira/issues/:issueKey/transitions` — devuelve opciones válidas desde Jira.
- `POST /jira/issues/:issueKey/transitions` — body con `transitionId`; solo permite ID ofrecido por Jira después de revalidar; requiere confirmación UI explícita.
- `POST /users/me/tracked-issues` y `GET /users/me/tracked-issues[?refresh=true]` y `DELETE /users/me/tracked-issues/:id`: seguimiento de issues por usuario (ver "Issues seguidos" más abajo).
- `GET /users/me/preferences` — devuelve las preferencias del propio usuario.
- `PATCH /users/me/preferences` — actualiza solo campos permitidos con DTO tipado.

## Forma de respuesta

`GET /dashboard/issues/:issueKey` entrega en la fase 3 solo lo que Jira puede completar con datos reales:

```ts
interface DashboardIssueResponse {
  issue: {
    id: string;
    key: string;
    summary: string;
    issueType: { id: string; name: string; hierarchyLevel: number; isSubtask: boolean };
    status: { name: string; categoryKey: 'new' | 'indeterminate' | 'done' | 'unknown'; isCancelled: boolean };
    url: string;
    parentKey: string | null;
    storyPoints: { final: number | null; planned: number | null }; // null = sin estimación, nunca 0
  };
  subtasks: Array<{
    key: string;
    summary: string;
    status: { name: string; categoryKey: string; isCancelled: boolean };
    url: string;
  }>;
  progress: Progress;
  children?: Array<{                       // solo épicas (hijos directos, sin subtareas)
    key: string; summary: string;
    issueType: { id: string; name: string; hierarchyLevel: number; isSubtask: boolean };
    status: { name: string; categoryKey: string; isCancelled: boolean };
    url: string;
    storyPoints: { final: number | null; planned: number | null };
    progress: Progress;                    // avance del hijo por sus propias subtareas
  }>;
  metadata: { fetchedAt: string; isStale: false; warnings: string[] };
}

interface Progress {
  basis: 'subtasks' | 'children' | 'none'; // none: no aplica (p. ej. una subtarea)
  state: 'ok' | 'none' | 'all_cancelled';  // none/all_cancelled => percent null (nunca 0%)
  total: number;                           // denominador (cancelados excluidos por defecto, D-024)
  completed: number; inProgress: number; pending: number;
  cancelled: number;                       // siempre informado aparte
  unknown: number;                         // categoría no reconocida: nunca completado
  percent: number | null;                  // 0-100, un decimal
  isApproximate: boolean;                  // true si la lista de hijos se truncó en el tope (300)
}
```

Las épicas (nivel de jerarquía >= 1) resuelven sus hijos con `parent = "CLAVE"` paginado por `nextPageToken` (hasta 6 páginas de 50). Si se alcanza el tope, `progress.isApproximate = true` y `metadata.warnings` lo indica. Un fallo de Jira al cargar los hijos responde con el error normalizado, nunca con un avance parcial o en 0%. Las 403/404 siguen siendo indistinguibles.

Pendiente para la fase 5 (no se devuelven hasta poder calcularlos con código probado, para no mostrar valores falsos):
- `weeklyStoryPoints` (SP por semana): fase 5.
- `dependencies` (bloqueantes y bloqueados, con `inaccessible`): fase 5.

`isStale` es siempre `false` porque los datos se leen en vivo desde Jira; la caché con datos desactualizados llega con el seguimiento de issues. No incluir datos de issues a los que el usuario no tenga acceso.

## Issues seguidos (fase 6)

Requieren sesión; el usuario sale siempre de la sesión (nunca de un `userId` del cliente) y las listas son por usuario. Solo se guarda la clave del issue: todo lo demás se lee de Jira.

- `POST /users/me/tracked-issues` — body `{ issueKey }` (se recorta y pasa a mayúsculas; 400 `VALIDATION_ERROR` si no cumple el patrón de claves o trae campos extra). Primero verifica que el issue sea legible con `getIssue`: inexistente o sin permiso responde el mismo 404 `ISSUE_NOT_FOUND_OR_INACCESSIBLE`; Jira sin configurar, `JIRA_NOT_CONNECTED` (409); otros fallos usan el mapeo normal (424/429/503) y no se inserta nada. Luego inserta de forma idempotente: alta nueva 201, ya seguido 200 con la entrada existente (sin duplicados, también con altas concurrentes). Más de 50 entradas por usuario responde 409 `TRACKING_LIMIT_REACHED` (una clave ya seguida sigue respondiendo 200). Respuesta: `{ id, issueKey, addedAt }`.
- `GET /users/me/tracked-issues[?refresh=true]` — `{ items: TrackedIssueItem[], metadata: { fetchedAt } }` ordenado por `display_order`. `refresh=true` omite la caché; cualquier otro valor distinto de `true`/`false` es 400.
- `DELETE /users/me/tracked-issues/:id` — `id` es un uuid (400 si no lo es). Responde siempre 204, exista o no la entrada o sea de otro usuario: solo se borra una fila propia y no se revela la existencia de las ajenas.

```ts
interface TrackedIssueItem {
  id: string;            // id de la entrada de seguimiento (no el id de Jira)
  issueKey: string;
  addedAt: string;
  status: 'ok' | 'error';
  fetchedAt: string;     // momento en que se leyó Jira para este ítem (en un ítem cacheado es la lectura original; en un error, el intento)
  // solo con status 'ok':
  issue?: {
    key: string; summary: string;
    issueType: { id: string; name: string; hierarchyLevel: number; isSubtask: boolean };
    status: { name: string; categoryKey: string; isCancelled: boolean };
    url: string;
    storyPoints: { final: number | null; planned: number | null };
  };
  progress?: Progress;   // el mismo Progress del detalle: por subtareas, o por hijos en épicas (con tope y truncado)
  childrenCount?: number; // solo épicas
  warnings?: string[];
  // solo con status 'error':
  error?: { code: string; message: string };
}
```

Semántica de errores por ítem: la lista responde 200 aunque algún ítem falle. Un fallo de Jira al cargar un ítem (404/403 sobre el issue, `JIRA_REAUTH_REQUIRED`, `JIRA_RATE_LIMITED`, `JIRA_UNAVAILABLE`, `JIRA_FORBIDDEN`) se informa como `status: 'error'` con `{ code, message }` normalizados, sin detalles remotos; nunca se inventa un avance en cero ni vacío (un ítem con error no trae `issue` ni `progress`). Si Jira no está configurado, no se puede saber el sitio vigente: se listan todas las entradas del usuario, todas con `error.code = JIRA_NOT_CONNECTED` y sin llamar a Jira. Si el token fue rechazado, cada ítem informa `JIRA_REAUTH_REQUIRED`. Las entradas de un sitio anterior al configurado no se muestran.

Caché: en memoria del proceso, por usuario + sitio + clave, con TTL de 60 s (constante `TRACKING_CONFIG.cacheTtlMs`); nunca se comparte entre usuarios. Solo se cachean lecturas correctas (un error se reintenta en la siguiente consulta) y `fetchedAt` conserva el momento de la lectura original, de modo que un dato cacheado no se presenta como recién consultado. La carga de ítems usa concurrencia acotada (4 lecturas simultáneas).

## Errores normalizados

- `UNAUTHENTICATED`: sesión no válida.
- `JIRA_NOT_CONNECTED` (HTTP 409): faltan las credenciales de Jira (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`) o no hay conexión activa.
- `JIRA_REAUTH_REQUIRED` (HTTP 424): Jira respondió 401; el API token es inválido, venció o fue revocado (o refresh expirado/revocado en modo OAuth). Hay que reemplazar el token.
- `JIRA_FORBIDDEN` (HTTP 424): Jira respondió 403 en una operación que no es de un issue concreto (por ejemplo la búsqueda); la cuenta no tiene permiso.
- `ISSUE_NOT_FOUND_OR_INACCESSIBLE` (HTTP 404): el issue no existe o la cuenta no puede verlo; no se distingue (Jira 404 y 403 sobre un issue concreto producen la misma respuesta).
- `JIRA_RATE_LIMITED` (HTTP 429, con `Retry-After` si Jira lo envía): informar y reintentar según reglas.
- `JIRA_UNAVAILABLE` (HTTP 503): fallo upstream (5xx, red, timeout o respuesta inesperada); conservar respuesta anterior como stale si es seguro.
- `TRACKING_LIMIT_REACHED` (HTTP 409): el usuario ya sigue el máximo de issues (50).
- `INVALID_TRANSITION`: transition ID inválido o ya no disponible.
- `VALIDATION_ERROR`: entrada local inválida.

Los errores de Jira por credenciales (`JIRA_REAUTH_REQUIRED`, `JIRA_FORBIDDEN`) usan HTTP 424 (Failed Dependency) y no 401/403, para que el frontend no los confunda con una sesión de la aplicación vencida (`UNAUTHENTICATED`, 401) ni con un origen rechazado (`FORBIDDEN_ORIGIN`, 403). El cliente debe decidir por `code`, no solo por el estado HTTP.
