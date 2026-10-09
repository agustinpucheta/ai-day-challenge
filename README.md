# Jira Dashboard — paquete de proyecto para Claude Code

Este paquete contiene el plan funcional y técnico acordado para implementar el MVP local. Incluye instrucciones globales para Claude Code, arquitectura, pipelines, modelo de datos, API propuesta, fases, criterios de aceptación, agentes de desarrollo y una Skill de licencias en borrador.

## Objetivo

Construir un dashboard personal sobre Jira Cloud (`*.atlassian.net`) con Vue 3 + Vite, NestJS y PostgreSQL. En la primera entrega cada persona tendrá su usuario local, conectará su propio Jira mediante OAuth 2.0 (3LO), verá únicamente los datos que sus permisos de Jira le permiten consultar, y podrá ejecutar transiciones autorizadas con su propia identidad. Microsoft SSO y Railway se dejan para una segunda entrega.

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
- Monorepo: pnpm workspaces.
- Persistencia: PostgreSQL local mediante Docker Compose; Prisma como ORM y migraciones.
- Primera entrega: login local email/contraseña, OAuth individual de Atlassian, preferencias por usuario, dashboard de métricas, dependencias y transiciones autorizadas.
- SSO de Microsoft: segunda entrega.
- Despliegue en Railway: segunda entrega, después de validar el MVP local.
- Claude Code subagents: herramientas de desarrollo y revisión. Los cálculos de métricas del producto son deterministas; no requieren un agente LLM en runtime.
- MCP: útil para investigación durante el desarrollo; no se asume que el MCP local de Claude Code esté disponible para el backend ejecutándose.

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
