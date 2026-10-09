# Jira Dashboard — paquete de proyecto para Claude Code

Este paquete contiene el plan funcional y técnico acordado para implementar el MVP local. Incluye instrucciones globales para Claude Code, arquitectura, pipelines, modelo de datos, API propuesta, fases, criterios de aceptación, agentes de desarrollo y una Skill de licencias en borrador.

## Objetivo

Construir un dashboard personal sobre Jira Cloud (`*.atlassian.net`) con Vue 3 + Vite, NestJS y PostgreSQL. La primera entrega es una app local para una sola persona: se conecta a Jira con el API token de su propia cuenta (D-023), ve los datos que los permisos de esa cuenta le permiten consultar y puede ejecutar transiciones autorizadas con esa identidad. La adaptación multiusuario con OAuth 2.0 (3LO) queda como modo opcional posterior. Microsoft SSO y Railway se dejan para una segunda entrega.

## Cómo usar este paquete

1. Descomprimí el ZIP en la raíz del repositorio que quieras utilizar (o copiá todo el contenido, incluidos los archivos ocultos `.claude/` y `CLAUDE.md`).
2. Abrí esa carpeta en Claude Code.
3. Verificá que el MCP de Jira esté disponible en tu sesión de Claude Code. No se deben copiar credenciales ni archivos de configuración personales al repositorio.
4. Enviá el prompt inicial que figura abajo.
5. Pedile a Claude que trabaje por fases y que cierre cada fase con tests, resumen y criterios de aceptación cumplidos.

## Prompt inicial para Claude Code

> Leé `CLAUDE.md` y toda la documentación de `docs/`. Empezá por la Fase 0 de `docs/IMPLEMENTATION_PLAN.md`: inspeccioná el repositorio actual y las herramientas MCP de Jira disponibles en modo solo lectura. Descubrí los campos reales, nombres de estados, relaciones épica-historia-subtarea, campo de story points, enlaces `blocks`/`is blocked by`, historial de cambios y capacidades de transición de esta instancia. No crees, edites ni transiciones tickets reales durante la exploración. No inventes field IDs ni estados. Después entregá un informe de descubrimiento, las decisiones pendientes estrictamente necesarias y un plan técnico actualizado. Una vez aprobado ese informe, implementá las fases en orden; no intentes construir todo de una sola vez. Ejecutá tests, lint y typecheck al final de cada fase.

## Decisiones principales

- Frontend: Vue 3, Vite, TypeScript.
- Backend: NestJS, TypeScript.
- Repositorio: proyectos independientes `backend/` y `frontend/` con pnpm 10, sin workspaces (D-016).
- Persistencia: PostgreSQL local mediante Docker Compose; Prisma como ORM y migraciones.
- Primera entrega: login local email/contraseña, conexión a Jira con API token (OAuth opcional posterior), preferencias por usuario, dashboard de métricas, dependencias y transiciones autorizadas.
- SSO de Microsoft: segunda entrega.
- Despliegue en Railway: segunda entrega, después de validar el MVP local.
- Claude Code subagents: herramientas de desarrollo y revisión. Los cálculos de métricas del producto son deterministas; no requieren un agente LLM en runtime.
- MCP: útil para investigación durante el desarrollo; no se asume que el MCP local de Claude Code esté disponible para el backend ejecutándose.

## Desarrollo local

El repositorio tiene dos proyectos independientes, `backend/` y `frontend/`, y un `package.json` raíz que solo orquesta scripts (D-016).

**Requisitos:** Node 22.12 o superior, pnpm 10 y Docker.

1. Copiá `.env.example` a `.env` en la raíz y completá los valores. `SESSION_SECRET` debe tener al menos 32 caracteres aleatorios (por ejemplo, `openssl rand -base64 48`). El `.env` nunca se versiona.
2. Instalá dependencias: `pnpm install:all`.
3. Levantá PostgreSQL: `pnpm db:up` (espera a que el contenedor esté sano). Para detenerlo: `pnpm db:down`.
4. Aplicá las migraciones: `pnpm --dir backend prisma:migrate` (desarrollo) o `pnpm --dir backend prisma:deploy` (solo aplicar las existentes).
5. Iniciá la API: `pnpm dev:backend`. Queda en `http://localhost:3000/api/v1` (salud: `GET /api/v1/health`).
6. Documentación de la API: Swagger UI en `http://localhost:3000/api/docs` y especificación JSON en `http://localhost:3000/api/docs-json` (deshabilitada en producción salvo `SWAGGER_ENABLED=true`). Para regenerar `backend/openapi.json`, que usa el frontend para generar tipos: `pnpm --dir backend openapi:export`.
7. Iniciá la web: `pnpm dev:frontend` (o `pnpm dev` para levantar API y web juntas). Queda en `http://localhost:5173`. El servidor de Vite redirige `/api` a `http://localhost:3000` (proxy), así el navegador trabaja en un único origen, la cookie de sesión `HttpOnly` funciona sin CORS y el `Origin` enviado (`http://localhost:5173`) coincide con `WEB_ORIGIN`. Para usar otra dirección de la API: variable `VITE_API_PROXY_TARGET` al iniciar Vite.
8. Después de cambiar la API: `pnpm --dir backend openapi:export` y luego `pnpm --dir frontend api:types`, que regenera `frontend/src/api/schema.d.ts` (versionado). Si el contrato cambió, `pnpm --dir frontend typecheck` señala los usos a corregir.

**Conexión a Jira (variables de entorno):**

- `JIRA_URL` (por ejemplo `https://fpatronal.atlassian.net`), `JIRA_USERNAME` (email de tu cuenta Atlassian) y `JIRA_API_TOKEN` (API token de Jira Cloud, creado en id.atlassian.com → Security → API tokens). Son las mismas credenciales que usa tu MCP local de Jira; las de Confluence no se necesitan (D-023).
- Son opcionales: si faltan las tres, la conexión figura como "no configurada". Si definís solo algunas, el backend no arranca y el error nombra las variables que faltan (nunca sus valores).
- Pueden estar en el `.env` o como variables de entorno del sistema; las del sistema tienen prioridad. Solo las ven los procesos que se abren después de definirlas, y el backend las lee al arrancar: reiniciá `pnpm dev` tras cambiarlas.
- Completá el archivo `.env` a mano; nunca se versiona ni debe compartirse.
- Para verificar la conexión, abrí el panel "Jira" de la pantalla principal (hace una única lectura a `/myself`) o usá `POST /api/v1/jira/connection/verify` desde Swagger (`http://localhost:3000/api/docs`).
- Para rotar el token: creá uno nuevo en id.atlassian.com → Security → API tokens, actualizá `JIRA_API_TOKEN`, reiniciá el backend y revocá el anterior.

**Problemas frecuentes con la conexión a Jira:**

| Síntoma en el panel | Causa probable | Qué hacer |
|---|---|---|
| "Not configured" | Faltan las variables o el proceso no las ve | Definí las tres variables y reiniciá desde una terminal nueva |
| El backend no arranca y nombra variables | Configuración parcial | Completá o quitá las tres variables juntas |
| "Jira rejected the API token" (`JIRA_REAUTH_REQUIRED`) | Token inválido, vencido o revocado, o email incorrecto | Creá un token nuevo y revisá `JIRA_USERNAME` |
| Permiso denegado (`JIRA_FORBIDDEN`) | La cuenta no tiene permiso sobre el recurso | Revisá los permisos de tu cuenta en Jira |
| Límite de peticiones (`JIRA_RATE_LIMITED`) | Demasiadas llamadas a Jira | Esperá los segundos indicados y reintentá |
| Jira no disponible (`JIRA_UNAVAILABLE`) | Caída de Jira o de la red | Reintentá más tarde |
- Las variables `ATLASSIAN_*` (OAuth) solo se usan en el modo OAuth opcional, previsto para una futura adaptación multiusuario.
- Tras crear tu cuenta local, deshabilitá el registro con `LOCAL_REGISTRATION_ENABLED=false`.

**Calidad y pruebas (backend):**

- `pnpm lint:backend`, `pnpm typecheck:backend`, `pnpm --dir backend format`.
- `pnpm --dir backend test`: pruebas unitarias.
- `pnpm --dir backend test:e2e`: pruebas e2e contra el PostgreSQL local (requiere `pnpm db:up`). Usan una base separada `<POSTGRES_DB>_test` (o `TEST_DATABASE_URL`) que se crea y migra automáticamente; nunca tocan la base de desarrollo.
- `pnpm test:backend` ejecuta ambas. Los scripts agregados `pnpm lint`, `pnpm typecheck` y `pnpm test` incluyen también el frontend.

**Calidad y pruebas (frontend):**

- `pnpm lint:frontend`, `pnpm typecheck:frontend`, `pnpm --dir frontend format` / `format:check`.
- `pnpm test:frontend`: pruebas unitarias y de componentes con Vitest y jsdom (no requieren la API ni la base).
- `pnpm --dir frontend build`: chequeo de tipos y build de producción en `frontend/dist`.

## Contenido

- `CLAUDE.md`: reglas permanentes para Claude Code.
- `docs/PRODUCT_SPEC.md`: propósito, usuarios, alcance y requisitos.
- `docs/ARCHITECTURE.md`: componentes, módulos, estructura y límites.
- `docs/PIPELINES.md`: pipelines operativos y cálculos.
- `docs/DATA_MODEL.md`: entidades, aislamiento y persistencia.
- `docs/API_CONTRACTS.md`: endpoints iniciales propuestos.
- `docs/IMPLEMENTATION_PLAN.md`: fases, entregas y criterios de aceptación.
- `docs/SECURITY.md`: controles de autenticación, OAuth, permisos y secretos.
- `docs/JIRA_DISCOVERY.md`: checklist de descubrimiento para el MCP.
- `docs/DECISIONS.md`: decisiones de arquitectura y supuestos.
- `docs/REFERENCES.md`: documentación oficial de referencia.
- `docs/future/crear-ticket-licencia-SKILL.md`: borrador de Skill que no debe activarse hasta verificar la plantilla real.
- `.claude/agents/`: agentes especializados de desarrollo.

## Importante

Este paquete es una especificación inicial, no una implementación ya ejecutada ni una garantía de compatibilidad con los campos de una instancia Jira concreta. La Fase 0 debe comprobar las particularidades de la instancia antes de fijar JQL, IDs de campos o reglas de estado.
