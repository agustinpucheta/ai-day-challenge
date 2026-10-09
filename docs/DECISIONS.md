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

**Pendiente (resolver antes de Fase 4):** si los issues cancelados permanecen en el denominador del avance.

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
