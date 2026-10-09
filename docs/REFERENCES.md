# Referencias oficiales

Consultar estas páginas durante implementación y volver a verificar cambios en las APIs/documentación, especialmente antes de configurar OAuth/scopes.

## Claude Code

- Extensiones: `CLAUDE.md`, Skills, subagents y MCP: https://code.claude.com/docs/en/features-overview
- Subagents personalizados: https://code.claude.com/docs/en/sub-agents
- Skills: https://code.claude.com/docs/en/skills
- Memoria/CLAUDE.md: https://code.claude.com/docs/en/memory

Uso previsto: `CLAUDE.md` guarda reglas permanentes; subagents separan tareas de desarrollo; una Skill almacena un flujo reutilizable; el MCP aporta conexión al servicio externo. No confundir estas capacidades de Claude Code con agentes runtime de la aplicación.

## Jira Cloud

- OAuth 2.0 (3LO) apps: https://developer.atlassian.com/cloud/jira/software/oauth-2-3lo-apps/
- Seguridad de integraciones REST: https://developer.atlassian.com/cloud/jira/platform/security-for-other-integrations/
- Scopes OAuth 2.0 de Jira Software: https://developer.atlassian.com/cloud/jira/software/scopes-for-oauth-2-3LO-and-forge-apps/
- REST API v3 - issues/search/documentación general: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
- JQL y búsqueda de issues: consultar la sección vigente de Issue Search REST API desde el índice oficial.
- Issue links y transiciones: consultar las operaciones vigentes de Issue Links y Issues REST API.

Requisitos a recordar: 3LO actúa en nombre de la persona que autoriza; los permisos efectivos de Jira de esa persona siguen limitando las operaciones aunque la app solicite scopes. Para refresh tokens rotatorios, guardar el token nuevo y evitar renovar el mismo refresh token concurrentemente. Solicitar scopes mínimos para los endpoints realmente implementados.

## Referencias verificadas durante la preparación del paquete

- La guía de 3LO de Atlassian explica registro de app, callback, `state`, intercambio de código, `cloudId`, scopes y refresh token rotatorio.
- La guía de subagents de Claude Code establece archivos Markdown con YAML frontmatter en `.claude/agents/` y permisos/herramientas por agente.
- La guía de Skills establece el uso de `SKILL.md` y la distinción respecto de `CLAUDE.md` y MCP.
