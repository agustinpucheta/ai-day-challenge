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
