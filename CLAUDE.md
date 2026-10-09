# Instrucciones de Claude Code

## Objetivo del proyecto

Implementar un dashboard personal de Jira Cloud, primero en local, con Vue 3 + Vite, NestJS, PostgreSQL, login local y conexión a Jira con el API token del dueño de la instancia (app local de un solo usuario, D-023; el modo OAuth Atlassian queda opcional para la adaptación multiusuario). Consultá `docs/` para el detalle funcional.

## Reglas no negociables

1. **Jira es la fuente de verdad** para issues, estados, story points, jerarquía y enlaces de dependencia.
2. **Identidad y aislamiento:** el MVP es local y de un solo usuario; las credenciales de Jira se resuelven en el backend mediante `JiraCredentialProvider` y nunca se confía en un `userId` enviado por el cliente. El aislamiento por usuario de los datos de Jira vuelve con la adaptación multiusuario y el modo OAuth dormido (D-023).
3. **Credenciales de Jira:** en el MVP se usa el API token del propio dueño de la instancia (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, D-023). No pedir ni almacenar API tokens de otras personas; en el modo multiusuario cada usuario autoriza con su cuenta Atlassian mediante una única integración OAuth 2.0 (3LO) del producto.
4. **No filtrar secretos:** tokens, `JIRA_API_TOKEN`, `ATLASSIAN_CLIENT_SECRET`, claves de cifrado, contraseñas y secretos de sesión nunca en frontend, logs, tests versionados ni respuestas API.
5. **No modificar Jira real durante investigación o pruebas.** Por defecto, las herramientas MCP de Jira se usan en modo solo lectura. Para probar escrituras, usar mocks o un entorno de pruebas explícitamente autorizado.
6. **No inventar la configuración de Jira.** Descubrí los IDs de campos, tipos de issue, jerarquías y estados reales por el MCP/documentación y registralos en `docs/JIRA_DISCOVERY.md` o en una configuración tipada; no hardcodees IDs supuestos.
7. **No usar Claude para cálculos deterministas.** Porcentajes, SP semanales, subtareas y dependencias se calculan con código probado. Claude Code subagents ayudan a construir y revisar el código; no son agentes runtime obligatorios. La única excepción runtime es el borrador de licencias de la Fase 9 (D-021).
8. **Las escrituras requieren validación del backend.** Para transiciones de estado, consultá las transiciones válidas para ese issue y aceptá solamente una transición que Jira haya ofrecido. Jira sigue aplicando sus permisos efectivos (los de la cuenta cuyas credenciales se usan).
9. **OAuth seguro (aplica al modo OAuth cuando se habilite):** validar `state`, callbacks exactos, scopes mínimos, tokens cifrados, renovación rotatoria, revocación/desconexión y manejo de errores de autorización.
10. **No presentar datos obsoletos como actuales.** Incluir cuándo se consultó Jira y distinguir errores, respuestas vacías y caché desactualizada.
11. Usá TypeScript estricto, DTOs validados, migraciones, logs sin secretos, pruebas unitarias y de integración.
12. No agregues infraestructura distribuida, colas o agentes runtime sin una necesidad verificada (el agente de borradores de licencias de la Fase 9 es el caso verificado, D-021). Priorizá un monolito modular claro.

## Stack preferido

- Dos proyectos independientes, `backend/` y `frontend/`, cada uno con su `package.json`, lockfile y scripts, más un `package.json` raíz que solo orquesta (pnpm 10, sin workspaces; D-016). Los tipos del frontend se generan desde `backend/openapi.json`.
- Frontend: Vue 3, Vite, TypeScript, Vue Router. Usar Pinia solo para estado cliente que realmente lo necesite.
- Backend: NestJS, TypeScript, REST JSON, validación de DTOs.
- Datos: PostgreSQL y Prisma; migraciones versionadas.
- Local: Docker Compose para PostgreSQL; frontend y API ejecutados en modo desarrollo.
- Tests: Vitest para frontend/dominio donde encaje, Jest o runner establecido por NestJS para backend, y Playwright para flujos E2E cuando la base esté estable.

Si el repositorio existente ya tiene una elección equivalente bien establecida, inspeccionala antes de sustituirla.

## Flujo de trabajo

1. Leé `docs/IMPLEMENTATION_PLAN.md` y trabajá una fase por vez.
2. Antes de programar, explorá el repo y la configuración de Jira en solo lectura.
3. Definí contratos y DTOs antes de repartir trabajo en módulos que los compartan.
4. Usá subagents de `.claude/agents/` para áreas con límites claros; evitá edición concurrente del mismo archivo.
5. Después de cada fase ejecutá format/lint, typecheck y tests relevantes.
6. Informá archivos cambiados, decisiones, comandos ejecutados, resultados de pruebas y pendientes reales. No afirmes que un test pasó si no lo ejecutaste.
7. Si una credencial o configuración externa falta, dejá `.env.example` y documentá el paso manual; nunca inventes valores.

## Fuera del alcance del MVP

- Inicio de sesión con Microsoft (segunda entrega).
- Despliegue en Railway (segunda entrega).
- Cambio masivo de estados o edición arbitraria de issues.
- Escritura de eventos en Outlook vía Microsoft Graph (opcional posterior, 9.5). La creación de tickets de licencia SÍ está dentro del MVP como Fase 9 (D-020), y no se crea ningún ticket real hasta verificar la plantilla y obtener confirmación explícita. La Skill local de licencias es una herramienta opcional de desarrollo y permanece en borrador hasta verificar la plantilla real de Jira.
- LLM/Claude API en runtime: permitido únicamente para redactar borradores de solicitudes de licencia (Fase 9, D-021); nunca para métricas ni cálculos.
