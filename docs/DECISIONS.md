# Decisiones de arquitectura (ADR resumidas)

## D-001 — Implementación local primero

**Decisión:** el MVP corre en la máquina del desarrollador con PostgreSQL en Docker. Railway queda para la segunda entrega después de validar comportamiento real.

## D-002 — Vue 3 + Vite y NestJS

**Decisión:** frontend Vue 3 + Vite en TypeScript, backend NestJS. Monorepo pnpm. La lógica de negocio vive en el backend.

## D-003 — PostgreSQL independiente, no Supabase en MVP

**Decisión:** PostgreSQL local como base de datos. Supabase no se incorpora ahora porque no necesitamos sus servicios adicionales y NestJS centraliza API/auth; podemos reevaluar cuando haya necesidades concretas.

## D-004 — Login local en Entrega 1; Microsoft después

**Decisión:** identidad persistente por usuario en la primera entrega con email/contraseña. Microsoft SSO es Entrega 2. El modelo interno debe soportar vincular proveedor externo después sin cambiar el `userId` ni perder datos.

## D-005 — Jira OAuth individual

**Decisión:** una integración Atlassian OAuth 2.0 3LO compartida como aplicación de producto; cada usuario autoriza su propia cuenta/sitio. No recolectar API tokens ni exigir que cada usuario cree su propia app OAuth. Las acciones de Jira se ejecutan con la autorización individual.

> Nota: superada parcialmente por D-023 (modo por defecto); el modo OAuth queda como opción dormida para la adaptación multiusuario.

## D-006 — Métricas deterministas

**Decisión:** progreso, subtareas, SP semanal y dependencia son lógica TypeScript testeable; no requieren LLM en runtime. Claude Code subagents se usan para construir y revisar el software.

## D-007 — Enlaces explícitos para bloqueos

**Decisión:** usar enlaces reales de Jira `blocks` / `is blocked by`, normalizados a bloqueador -> bloqueado. No inferir dependencias a partir de texto.

## D-008 — Preferencias por usuario en PostgreSQL

**Decisión:** persistir seguimiento de issues, preferencias y vistas; no duplicar todos los issues de Jira. Cache scoped por usuario/conexión y con TTL.

## D-009 — Skill de licencias separada

**Decisión:** se definirá como Skill de Claude Code que utiliza el MCP y una plantilla fija. La única entrada variable habitual es la épica destino. No se activa hasta descubrir/verificar la plantilla real; requiere confirmación del borrador antes de crear un ticket real.

## D-010 — PostgreSQL con Prisma

**Decisión inicial:** Prisma para modelado y migraciones TypeScript-friendly. Si el repo existente ya usa otra solución madura, inspeccionar antes de cambiarla.

## D-011 — Kit en la raíz del repositorio

**Fecha:** 2026-10-09.

**Decisión:** el kit de documentación y el monorepo viven en la raíz del repositorio, no en una subcarpeta.

## D-012 — Dos campos de story points

**Fecha:** 2026-10-09. **Evidencia:** `docs/JIRA_DISCOVERY.md` § Story points.

**Decisión:** la métrica de SP consumidos/completados usa `customfield_10204` "StoryPoint Finales". `customfield_10023` "Story Points" es la estimación planificada y se usa solo para mostrar el desvío de planificación (finales vs planificados). Un valor nulo significa "sin estimación" y nunca se trata como 0.

## D-013 — SP sumados solo desde subtareas

**Fecha:** 2026-10-09.

**Decisión:** los SP se suman únicamente desde subtareas (tipos con `subtask = true` / `hierarchyLevel = -1`). Los valores de SP de historias, épicas y demás issues de nivel 0 nunca se suman, para evitar doble contabilización.

## D-014 — Cancelado no es completado

**Fecha:** 2026-10-09. **Evidencia:** `docs/JIRA_DISCOVERY.md` § Estados y categorías.

**Decisión:** "completado" = `statusCategory.key = done` **y** estado distinto de Cancelado (status id `10000`, configurable, obtenido del descubrimiento). Los issues cancelados se excluyen del avance completado y de los SP semanales consumidos, y se informan como una métrica separada de "cancelados".

**Resuelto por D-024:** los cancelados se excluyen del denominador del avance por defecto.

## D-015 — Rama de trabajo

**Fecha:** 2026-10-09.

**Decisión:** el trabajo se realiza en la rama `feat/jira-dashboard-mvp`; nada se integra a `main` hasta verificar las fases.

## D-016 — Proyectos independientes `backend/` y `frontend/` (sin workspace)

**Fecha:** 2026-10-09. **Reemplaza:** la parte "Monorepo pnpm workspaces" de D-002 y la estructura `apps/` + `packages/contracts` de `docs/ARCHITECTURE.md`.

**Decisión:** el repositorio contiene dos proyectos independientes, `backend/` (NestJS) y `frontend/` (Vue), cada uno con su propio `package.json`, lockfile, dependencias, scripts, `tsconfig` y lint. No hay `pnpm-workspace.yaml`. El `package.json` de la raíz (`jira-dashboard`, privado) es solo un orquestador: no tiene dependencias de aplicación (únicamente `concurrently` como devDependency) y expone `dev`, `dev:backend`, `dev:frontend`, `install:all`, `lint`, `typecheck`, `test` (con variantes `*:backend` / `*:frontend`), `db:up` y `db:down`. Se usa pnpm 10 (`packageManager` fijado en cada `package.json`).

**Consecuencia / tradeoff:** los contratos de la API ya no se comparten mediante un paquete (`packages/contracts`), por lo que backend y frontend podrían divergir en tipos. **Mitigación (implementada en la Fase 1):** el backend documenta todos los endpoints con `@nestjs/swagger` (DTOs de request/response y el cuerpo de error normalizado `{ code, message }`). Swagger UI se sirve en `/api/docs` y el JSON en `/api/docs-json` cuando `NODE_ENV` no es `production` o `SWAGGER_ENABLED=true`. `pnpm --dir backend openapi:export` escribe `backend/openapi.json` (versionado, sin conexión a la base) y el frontend genera sus tipos desde ese archivo con openapi-typescript. Mientras Swagger está habilitado, el chequeo de Origin también acepta el origen de la propia API (`API_ORIGIN`, por defecto `http://localhost:<API_PORT>`) para que funcione "Try it out"; los orígenes ajenos se siguen rechazando.

## D-017 — Herramientas del backend (Fase 1)

**Fecha:** 2026-10-09.

**Decisión:**
- **Tests:** Jest 30 + ts-jest (runner establecido por NestJS). Unitarios en `backend/src/**/*.spec.ts`; e2e con supertest en `backend/test/*.e2e-spec.ts` contra el PostgreSQL local, usando una base separada `<POSTGRES_DB>_test` (o `TEST_DATABASE_URL`) que el setup crea y migra con `prisma migrate deploy`.
- **TypeScript 5.9** (no 7.x): `ts-jest` y `typescript-eslint` aún no soportan TypeScript 7.
- **Prisma 7.10** (estable; la etiqueta `latest` de npm apunta a una RC de Prisma 8). Configuración en `backend/prisma.config.ts`; la URL ya no va en `schema.prisma`. Cliente generado con el generador `prisma-client` en `backend/src/generated/prisma` (ignorado por Git, se genera en `postinstall`), `moduleFormat = "cjs"` e `importFileExtension = "js"` para el build CommonJS de Nest; conexión mediante el driver adapter `@prisma/adapter-pg`.
- **Sesiones:** `express-session` + `connect-pg-simple` sobre la tabla `user_sessions`, creada por la migración de Prisma (`createTableIfMissing: false`). Cookie `jd.sid`, `HttpOnly`, `SameSite=Lax`, `Secure` solo con `NODE_ENV=production`, duración 8 h.
- **Variables de entorno:** el backend lee el `.env` de la raíz y lo valida con zod al arrancar (falla rápido sin mostrar valores). `SESSION_SECRET` requiere al menos 32 caracteres.
- **CSRF:** las solicitudes `POST`/`PUT`/`PATCH`/`DELETE` deben traer `Origin` (o `Referer`) igual a `WEB_ORIGIN`; si falta, se rechazan (`403 FORBIDDEN_ORIGIN`).

## D-018 — Cifrado de tokens Jira en reposo (Fase 2)

**Fecha:** 2026-10-09.

**Decisión:** los tokens de acceso y de refresco se cifran con AES-256-GCM usando `crypto` de Node (sin dependencias nuevas), con IV aleatorio de 12 bytes, formato versionado `v1.<versionClave>.<iv>.<tag>.<ciphertext>` y AAD igual al identificador de la conexión. La clave vigente sale de `TOKEN_ENCRYPTION_KEY` / `TOKEN_ENCRYPTION_KEY_VERSION`; las versiones anteriores, solo para descifrar, de `TOKEN_ENCRYPTION_PREVIOUS_KEYS`. La clave es obligatoria únicamente cuando Jira OAuth está configurado (cliente, secreto y redirect URI), de modo que la API arranca sin Jira.

**Tradeoff:** sin KMS externo, la seguridad depende de custodiar la variable de entorno; la rotación es manual pero sin reescritura masiva. El AAD exige conocer el id de la conexión antes de cifrar (se genera el UUID en la aplicación al crear la fila).

## D-019 — Puerto HTTP y Atlassian falso para las pruebas de OAuth (Fase 2)

**Fecha:** 2026-10-09.

**Decisión:** el cliente OAuth de Atlassian (`AtlassianOAuthClient`) recibe un `HttpPort` (`postJson` / `getJson`, devuelve `{ status, headers, body }`) en lugar de usar `fetch` directamente. La implementación por defecto (`FetchHttpPort`) usa `fetch` global con timeout de 10 s, sin redirecciones y sin reintentos. Las pruebas usan `FakeAtlassian` (`backend/test/utils/fake-atlassian.ts`), un doble en memoria con códigos de autorización de un solo uso, refresh token rotatorio (cada refresh invalida el anterior), revocación y fallos programables (`invalid_grant`, 429 con `Retry-After`, 500, cuerpo mal formado, error de red). Los errores del cliente son tipados y de mensaje fijo, sin tokens, secreto, códigos ni cuerpos remotos.

**Tradeoff:** el doble reproduce el contrato documentado, no el comportamiento real de Atlassian, por lo que la verificación con credenciales reales sigue siendo manual (F2.6). A cambio, las pruebas son deterministas, no usan red y se reutilizan en F2.3 y F2.4.

## D-020 — Flujo de licencias dentro del MVP como Fase 9

**Fecha:** 2026-10-09.

**Decisión:** el flujo de licencias pasa a ser la última fase del MVP (Fase 9). El usuario registra las vacaciones en el dashboard; la app crea el ticket de licencia en Jira con el token OAuth del propio usuario (solo con confirmación explícita) y entrega un `.ics` descargable como entrada de calendario. Proyecto local. La Fase 8 queda como E2E base de las fases 1–7 y el cierre del MVP ocurre al terminar la Fase 9. La Skill de Claude Code sigue como herramienta opcional de desarrollo.

**Por qué `.ics` y no escritura en Outlook:** el conector Microsoft 365 disponible en Claude Code es de solo lectura y el backend no puede usar los MCP de Claude Code. Crear o leer eventos de Outlook desde la app exige Microsoft Graph y un registro de aplicación en Microsoft Entra (posiblemente con consentimiento de administrador).

**Tradeoff:** el `.ics` requiere importar el archivo a mano y no crea el evento dentro de Outlook. A cambio no depende de Entra. Microsoft Graph queda como mejora opcional posterior (9.5), reutilizando el patrón de estado OAuth y tokens cifrados de la Fase 2.

## D-021 — Agente de IA en runtime solo para borradores de licencias

**Fecha:** 2026-10-09.

**Decisión:** se permite un agente de IA en runtime (Claude API) ÚNICAMENTE para redactar borradores de solicitudes de licencia a partir de texto libre. El agente produce un borrador estructurado y nunca escribe en Jira ni en calendarios. Es opcional por entorno (apagado si `ANTHROPIC_API_KEY` no está definida), el backend re-valida todo de forma determinista y una persona confirma antes de cualquier escritura. Las métricas siguen siendo deterministas (D-006); el LLM no participa en ningún cálculo.

**Condiciones:** clave solo en el backend; sin secretos, tokens ni PII adicional enviados al modelo; límites de tamaño y de tasa; logs sin contenido; degradación al formulario manual; los datos provenientes de Jira (títulos de épicas, notas) se tratan como no confiables frente a prompt injection; tests con cliente de modelo falso.

**Tradeoff:** agrega una dependencia externa y costo por uso a cambio de una entrada más cómoda; el riesgo se acota porque el agente no tiene capacidad de escritura.

## D-022 — Evento de Outlook mediante agente + MCP (opción 3), con spike previo y `.ics` como respaldo

**Fecha:** 2026-10-09.

**Decisión:** para el paso de calendario de la Fase 9, el usuario eligió que el agente de IA cree el evento usando el conector Microsoft 365 / Outlook MCP (9.2b), precedido por un spike de viabilidad (9.0b). La descarga de `.ics` (9.2) se mantiene como respaldo garantizado y automático.

**Enmienda a D-021 (D-021 no se edita):** D-021 establece que el agente nunca escribe en calendarios. Esa restricción queda superada ÚNICAMENTE para la creación de eventos de calendario, solo con confirmación explícita del usuario (vista previa en la UI y `canUseTool`/hook) y solo si el spike 9.0b lo valida. El agente sigue sin escribir en Jira: el ticket lo crea el backend NestJS con el OAuth individual del usuario (D-005) tras la confirmación.

**Hechos verificados (documentación oficial, 2026-10-09):**

- El Agent SDK (TypeScript) acepta servidores MCP vía `mcpServers` (stdio, http) o `.mcp.json` con `settingSources`. Fuentes: https://code.claude.com/docs/en/agent-sdk/mcp.md , https://code.claude.com/docs/en/agent-sdk/claude-code-features.md
- Los conectores alojados en claude.ai (Microsoft 365) se obtienen en sesiones del Agent SDK SOLO con login de suscripción de claude.ai; se omiten con `ANTHROPIC_API_KEY`. El SDK no ejecuta OAuth interactivo para servidores remotos. Fuentes: https://code.claude.com/docs/en/mcp.md , https://code.claude.com/docs/en/authentication.md
- Política: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK." Fuente: https://code.claude.com/docs/en/agent-sdk/quickstart.md
- El conector Microsoft 365 es de solo lectura por defecto (`outlook_calendar_search`, `find_meeting_availability`, ...); las herramientas de escritura de calendario (crear/actualizar/eliminar eventos) solo existen si el administrador de la organización las habilitó y aprobó los permisos. Fuentes: https://support.claude.com/en/articles/12542951-enabling-and-using-the-microsoft-365-connector , https://claude.com/docs/connectors/microsoft/365.md
- Permisos: `allowedTools` + `permissionMode: "dontAsk"` como allowlist estricta, `disallowedTools` para herramientas de escritura de Jira, `canUseTool`/hook `PreToolUse` para confirmación humana y validación de argumentos; nunca `bypassPermissions`. Los títulos y notas de Jira son datos no confiables (prompt injection). Fuentes: https://code.claude.com/docs/en/agent-sdk/permissions.md , https://code.claude.com/docs/en/agent-sdk/user-input.md , https://code.claude.com/docs/en/agent-sdk/secure-deployment.md
- El conector MCP de la Messages API (cabecera beta `mcp-client-2025-11-20`) solo funciona con servidores MCP HTTP públicos; un servidor stdio local (`mcp-atlassian`) no puede usarlo.

**PENDIENTE (sin verificar):**

- Si una app personal, local y de un solo usuario cuenta como "tercero" bajo la política de login de suscripción (revisar Términos o consultar a Anthropic).
- Si el administrador habilitó las herramientas de escritura del conector; en la sesión del usuario solo se listaron herramientas de lectura, por lo que es probable que estén apagadas.
- Si las entradas de `~/.claude.json` (alcance local) se cargan en una sesión del SDK; por eso el MCP de Jira se declara explícitamente.

**Consecuencias:**

- Conflicto de modo de autenticación: el login de suscripción habilita el conector Microsoft 365 pero tiene riesgo de política; `ANTHROPIC_API_KEY` es el modo habitual del backend (9.4) pero no carga el conector. Con la clave de API, el paso de calendario queda en `.ics`.
- La creación del ticket permanece en el backend con OAuth individual; el agente nunca escribe en Jira (herramientas de escritura de Jira en `disallowedTools`).
- Punto de decisión tras el spike 9.0b: mantener 9.2b, pasar a Microsoft Graph (9.5) o quedarse con `.ics`.

## D-023 — App local de un solo usuario con API token de Jira (reemplaza a D-005 como modo por defecto)

**Fecha:** 2026-10-09.

**Decisión:** por ahora la aplicación es local y para un único usuario (el dueño de la instancia). La conexión a Jira usa las mismas credenciales que ya tiene en su MCP local de Jira: un API token de Jira Cloud con autenticación Basic (`Authorization: Basic base64(email:api_token)`) contra la URL del sitio (`https://<sitio>.atlassian.net/rest/api/3/...`). Variables de entorno, con los mismos nombres que usa el MCP: `JIRA_URL`, `JIRA_USERNAME` (email de la cuenta) y `JIRA_API_TOKEN`. Las variables de Confluence no se necesitan. El usuario completa `.env` a mano. Más adelante se adaptará para más personas.

**Motivos:** simplicidad; no requiere crear una aplicación OAuth, redirect ni dependencia de un administrador de Atlassian; reutiliza credenciales ya existentes y los permisos son los de esa cuenta.

**Consecuencias:**

- Hay una sola identidad Jira por instancia. El aislamiento por usuario local deja de proteger los datos de Jira: cualquier usuario local autenticado vería los datos de esa cuenta.
- Mitigaciones: ejecutar solo en `localhost`, deshabilitar el registro (`LOCAL_REGISTRATION_ENABLED=false`) una vez creada la cuenta del dueño y mantener el token únicamente en `.env` (nunca en frontend, logs, tests ni respuestas API).
- `JiraGateway` resuelve credenciales mediante la interfaz `JiraCredentialProvider.resolve(userId)`. El proveedor por defecto es `ApiTokenCredentialProvider` (credenciales de instancia desde el entorno; el token vive solo en memoria y el header `Authorization` se arma por request). Un proveedor OAuth por usuario podrá enchufarse después.
- Las escrituras en Jira (transiciones de la Fase 7, ticket de licencia de la Fase 9) siguen exigiendo validación del backend y confirmación explícita; con API token actúan como la cuenta del dueño.

**Qué se mantiene:** los módulos OAuth ya construidos (F2.1 cifrado de tokens y tablas `jira_connections`/`oauth_states`; F2.2 servicio de `state` y cliente Atlassian; F2.3 servicio de conexiones con refresh rotatorio) quedan como "modo OAuth" opcional y dormido.

**Qué pasa a post-MVP:** endpoints OAuth (start/callback/connections/disconnect), flujo OAuth del frontend, pruebas de aislamiento multiusuario y la adaptación a varias personas (ver "Backlog post-MVP: modo multiusuario con OAuth" en `docs/IMPLEMENTATION_PLAN.md`). Con OAuth la base URL del gateway sería `api.atlassian.com/ex/jira/{cloudId}`.

## D-024 — Cancelados fuera del denominador del avance (configurable)

**Fecha:** 2026-10-09. **Resuelve:** el pendiente de D-014.

**Decisión:** por defecto, los issues cancelados (estado Cancelado, D-014) se **excluyen del denominador** del avance y se informan aparte en `cancelled`. El porcentaje es `completados / total * 100`, con un decimal (`Math.round(x * 10) / 10`), donde `total = completados + en curso + pendientes + desconocidos`. Es configurable mediante la constante tipada `cancelledCountsInDenominator` (por defecto `false`) en `backend/src/jira/jira.config.ts`: con `true`, los cancelados suman al `total` como no completados.

**Motivos:** un issue cancelado ya no es trabajo por hacer; contarlo como pendiente impediría llegar a 100 %. Sigue visible en `cancelled`, así que no se oculta.

**Consecuencias:** si todos los elementos están cancelados, `total = 0`, `percent = null` y `state = all_cancelled` (no 0 %). Sin elementos, `state = none`. Las categorías desconocidas cuentan en `unknown`, nunca como completadas, y generan una advertencia.

## D-025 — Issues “disponibles para tomar” por id de estado

**Fecha:** 2026-10-09.

**Decisión:** un issue está disponible para tomar si su estado tiene un id incluido en `availableStatusIds` (`backend/src/jira/jira.config.ts`, hoy `['10068']`, “Esperar Recurso”), no es el estado Cancelado y su categoría no es `done`. Se expone como `status.isAvailable` en todos los estados del API. En el avance, `available` cuenta los elementos contados cuyo estado es disponible y su categoría es `new`; es un **subconjunto de `pending`**, por lo que el invariante `completados + en curso + pendientes + desconocidos = total` no cambia.

**Motivos:** el nombre del estado está localizado y puede cambiar; el id es estable (misma regla que D-014). Las reglas defensivas evitan que un issue cerrado o cancelado figure como disponible aunque se reconfigure el id.

**Consecuencias:** la lista es configurable y debe reverificarse contra el sitio real (el id sale del descubrimiento del 2026-10-09). No afecta al porcentaje ni a los cancelados.
