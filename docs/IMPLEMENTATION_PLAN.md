# Plan de implementación por fases

La regla es completar y verificar cada fase antes de iniciar una nueva. Claude debe actualizar el checklist, ejecutar tests y reportar resultados reales en cada cierre.

## Fase 0 — Descubrimiento, repositorio y contrato Jira

**Objetivo:** eliminar supuestos sobre la instancia Jira y preparar contratos antes de programar.

Tareas (estado al 2026-10-09):
- [x] Inspeccionar el repositorio existente antes de crear/reemplazar archivos.
- [x] Detectar herramientas MCP Jira disponibles; usar solo lectura.
- [ ] Confirmar operaciones de búsqueda, lectura issue, changelog, issue links y transiciones disponibles por REST/scopes. Parcial: confirmado vía MCP; paginación REST de changelog, `to` de transiciones y scopes quedan PENDIENTES (Fases 2 y 3).
- [x] Descubrir campos reales de story points, parent/epic relation, subtareas, categorías de estado, tipos de issue y dirección de links `blocks`/`is blocked by`.
- [x] Revisar cómo recuperar sitios accesibles/cloudId con OAuth 3LO (`accessible-resources`; creación de la app OAuth pendiente como paso manual).
- [x] Registrar `docs/JIRA_DISCOVERY.md` con lo descubierto, evidencia, campos pendientes y consultas usadas sin guardar datos sensibles.
- [x] No crear ni modificar issues reales.

**Gate:** ningún field ID, nombre de estado o tipo de issue se hardcodea sin evidencia.

## Fase 1 — Fundación y login local

- Crear monorepo pnpm con `apps/web`, `apps/api`, Prisma, Docker Compose y `.env.example`.
- Configurar TypeScript estricto, lint, format, typecheck, tests y scripts root.
- Crear PostgreSQL schema/migración inicial.
- Implementar registro/login/logout/me con hash de password seguro y sesión de servidor en PostgreSQL.
- Implementar guards de sesión, DTO validation, rate limit en login y aislamiento básico de usuarios.
- Crear layout base de Vue y estados de conexión.

**Gate de aceptación:** dos usuarios locales independientes no pueden leer/modificar preferencias ajenas; tests de sesión/autorización pasan.

## Fase 2 — Conexión a Jira (API token local; OAuth opcional)

**Contexto (D-023, 2026-10-09):** la app es local y de un solo usuario. La conexión por defecto usa las mismas credenciales del MCP local de Jira: API token de Jira Cloud con Basic auth contra la URL del sitio (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`; las de Confluence no se necesitan). El `.env` lo completa el usuario a mano. Con una sola identidad Jira por instancia, el registro local se deshabilita tras crear la cuenta del dueño (`LOCAL_REGISTRATION_ENABLED=false`).

**Bloques OAuth ya construidos (dormidos, modo opcional para la adaptación multiusuario):**
- [x] F2.1 Cifrado AES-256-GCM de tokens, variables de Atlassian opcionales y tablas `jira_connections`/`oauth_states`.
- [x] F2.2 Servicio de `state` OAuth de un solo uso y cliente Atlassian detrás de un puerto HTTP, con Atlassian falso para pruebas.
- [ ] F2.3 Servicio de conexiones: tokens cifrados por usuario+cloudId, refresh rotatorio serializado, estado `reauthorization_required` y desconexión con revocación (en construcción; queda dormido).

**Nuevas rebanadas del modo por defecto:**
- [ ] F2.4 Interfaz `JiraCredentialProvider.resolve(userId)` + `ApiTokenCredentialProvider` (credenciales de instancia desde el entorno; el token solo en memoria, nunca en logs ni respuestas; `Authorization` armado por request) + validación de entorno (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` opcionales: sin definir = "no configurada") + `GET /jira/connection` y acción "verificar" que llama a Jira `GET /rest/api/3/myself` (solo lectura) y devuelve únicamente `connected`, `siteUrl` y `displayName`, nunca el token. OpenAPI regenerado.
- [ ] F2.5 Panel de conexión en el frontend con estados: no configurada, verificando, conectada, error y token no autorizado.
- [ ] F2.6 Documentación: cómo crear y rotar el token en id.atlassian.com → Security → API tokens, configuración de `.env` y resolución de problemas.

**Gate de aceptación:** con un Jira falso (puerto HTTP), el token no aparece en logs, errores ni respuestas; un token inválido o vencido produce un error normalizado tipo `JIRA_REAUTH_REQUIRED`, distinto de "sin datos"; la conexión no configurada es un estado distinto; 401, 403 y 429 se mapean a errores diferenciados.

## Backlog post-MVP: modo multiusuario con OAuth

Se activa cuando la app se adapte a más personas. Reutiliza F2.1–F2.3.

- Endpoints OAuth (start/callback/connections/disconnect), `/auth/me` con estado Jira y OpenAPI regenerado.
- Flujo OAuth en el frontend: botón Conectar Jira, estados conectado/reautorización/no configurado y desconexión.
- Registrar una única integración OAuth Atlassian 3LO del producto (configuración manual de developer console documentada), scopes mínimos y `offline_access` justificado.
- Proveedor `OAuthCredentialProvider` por usuario para `JiraCredentialProvider`.
- Pruebas de aislamiento multiusuario: usuario A conecta su Jira; usuario B no puede usar la conexión de A ni inspeccionar tokens; callback inválido, state replay, expiración, rotación de refresh y revocación.
- Nunca pedir a cada usuario que cree su propia aplicación OAuth.

## Fase 3 — Jira Gateway y búsqueda/lectura

- Definir el adapter a partir del contrato validado en Fase 0. El gateway obtiene credenciales resueltas por `JiraCredentialProvider`; la base URL es la URL del sitio en modo API token y `api.atlassian.com/ex/jira/{cloudId}` en modo OAuth.
- Implementar búsqueda paginada, lectura de campos necesarios, URL de issue, error mapping y rate limit.
- Construir `DashboardModule` que devuelve el modelo normalizado.
- Añadir carga, error, vacío, permisos insuficientes y timestamps en frontend.

**Ajustes post-descubrimiento:**
- Fixtures y tests de contrato con forma REST v3, no con la forma simplificada del MCP.
- Mapear tipos de issue por id / `hierarchyLevel` / `subtask`, no por nombre (`issuetype = Historia` falla en JQL sin error).
- Búsqueda paginada con `nextPageToken` (sin `total` fiable); verificar el impacto de tokens con `UNSUPPORTED_JQL`.
- Changelog vía `/rest/api/3/issue/{key}/changelog` paginado; verificar paginación real (el MCP corta en 100 entradas).

**Gate de aceptación:** el usuario ve un issue real permitido; un issue no accesible no filtra detalles y los errores no se transforman en listas vacías/0%.

## Fase 4 — Métricas, subtareas y SP semanal

- Implementar servicios puros de métricas y tests unitarios con casos de frontera.
- Resolver jerarquía real de Jira sin duplicar issues.
- Consultar changelog y story points históricos para cálculo semanal.
- Aplicar semana lunes-domingo, política de reabiertos y fallback claramente marcado como aproximado.
- Mostrar SP completados por semana y avance con conteos absolutos.

**Ajustes post-descubrimiento:**
- Completado = `statusCategory.key = done` y no Cancelado (D-014); métrica separada de cancelados.
- SP sumados solo desde subtareas (D-013); SP consumidos desde `customfield_10204` "StoryPoint Finales" (D-012).
- Semana asignada por la primera entrada real a completado, ignorando entradas `from == to` de automatización.
- Métrica de desvío de planificación (`customfield_10023` vs `customfield_10204`) por subtarea y agregada, con nulos reportados.
- Resolver antes de empezar: si los cancelados permanecen en el denominador del avance.

**Gate de aceptación:** tests para historia sin subtareas, épica vacía, campos nulos, cambios de estimación, ticket completado dentro/fuera del periodo, reapertura, paginación y duplicados.

## Fase 5 — Dependencias de bloqueos

- Leer `issuelinks` y validar dirección en instancia real.
- Normalizar `blocks` e `is blocked by` como bloqueador -> bloqueado.
- Cargar metadatos accesibles de issues relacionados, incluso fuera de la épica seleccionada.
- Mostrar blockers, blocked issues, estado y enlaces; gestionar issue inaccesible, ciclos y duplicados.

**Ajustes post-descubrimiento:**
- Identificar bloqueos por id de tipo de link `10000` (`Blocks`), no por nombre; outward en X = X bloquea a Y.
- Contemplar bloqueadores en otras épicas y otros proyectos (p. ej. MAART, MAADM, RSF).
- El escenario de issue enlazado inaccesible sigue PENDIENTE de verificar con una segunda cuenta.

**Gate de aceptación:** fixture para ambos sentidos del link y un bloqueador externo al conjunto principal; tests aseguran que la dirección no está invertida.

## Fase 6 — Preferencias y seguimientos por usuario

- Guardar/quitar seguimiento de épicas/historias.
- Guardar/restaurar filtros, orden y preferencia de indicadores.
- Al iniciar sesión, cargar la configuración del usuario actual y obtener métricas según cache/refresh.
- Añadir constraint de unicidad para no duplicar el mismo issue seguido.

**Gate de aceptación:** dos usuarios tienen listas de seguimiento diferentes; los datos y configuración no se cruzan.

## Fase 7 — Cambios de estado con permisos del usuario

- UI de transiciones válidas recuperadas de Jira.
- Backend verifica la sesión y usa las credenciales resueltas por `JiraCredentialProvider`; obtiene las transiciones disponibles y valida el ID antes de aplicar.
- Escribir con esas credenciales (API token del dueño en el MVP; actúa como su cuenta); recargar issue y métricas tras éxito.
- Auditar resultado sin secretos; manejar expiración, 403, rate limit y transiciones desactualizadas.

**Ajustes post-descubrimiento:**
- Los IDs de transición dependen del estado origen: consultarlos siempre por issue.
- Obtener la `statusCategory` del estado destino desde el campo `to` de la respuesta REST (el MCP no lo expone; verificar en Fase 3).

**Gate de aceptación:** un usuario sin permiso no puede cambiar el estado; no se puede enviar cualquier transition ID; la operación queda registrada.

## Fase 8 — End-to-end base de las fases 1–7

Esta fase es el endurecimiento E2E base de las fases 1–7. El cierre del MVP ocurre al final de la Fase 9 (D-020): el "Gate de aceptación final" se da por satisfecho recién allí. Se mantiene la numeración.

- Tests de integración de API con Jira mock.
- E2E del flujo login -> connect (OAuth simulado o sandbox) -> search -> track -> metrics -> dependency -> transition (mock/sandbox).
- Validación de accesibilidad básica, manejo de errores, carga y responsive desktop.
- Revisión de seguridad por QA agent y corrección de findings altos/críticos.
- Documentar setup local, variables, configuración OAuth y troubleshooting.

**Gate de aceptación (Fase 8):** las fases 1–7 levantan desde cero siguiendo README; typecheck/lint/tests pasan; no hay secretos en repo; métricas reales verificadas contra Jira. El gate final del MVP se cumple al cierre de la Fase 9.

## Fase 9 — Licencias desde el dashboard (última fase del MVP)

**Objetivo:** registrar vacaciones en un solo lugar: la app crea el ticket de licencia en Jira y entrega la entrada de calendario (D-020). Un agente de IA opcional ayuda a redactar el borrador (D-021). Proyecto local; sin dependencia de Outlook ni de Microsoft Entra.

### 9.0 Discovery (solo lectura, antes de programar)

- Descubrir la plantilla real del ticket de licencia. La Fase 0 observó un tipo de issue llamado `Licencias` en nivel de jerarquía 0 en MASIN (solo evidencia; detalles de campos y pantallas: PENDIENTE).
- Obtener campos requeridos, valores permitidos y relación con la épica (`parent`) vía REST createmeta del proyecto/tipo: `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}`, sin crear issues reales.
- Registrar el resultado en `docs/JIRA_DISCOVERY.md` y en una configuración tipada. El contenido fijo de la plantilla se versiona y se marca "verificada" solo después de la revisión del usuario.

### 9.0b Spike de viabilidad (antes de construir 9.2b/9.4)

Ejecutar una corrida headless de `query()` del Claude Agent SDK en la máquina del usuario e inspeccionar el mensaje `system/init` (estado de `mcp_servers` y lista de `tools`), una vez con el login de suscripción de claude.ai y otra con `ANTHROPIC_API_KEY`. Debe confirmar:

- (a) si el conector Microsoft 365 se carga en la sesión del SDK (según la documentación, los conectores alojados en claude.ai solo se obtienen con login de suscripción y se omiten con `ANTHROPIC_API_KEY`);
- (b) si existen herramientas de creación de eventos (dependen de que el administrador de la organización haya habilitado las herramientas de escritura; por defecto el conector es de solo lectura);
- (c) los nombres exactos de las herramientas (para la allowlist);
- (d) los nombres de herramientas de `mcp-atlassian` en la versión instalada;
- (e) si las entradas de `~/.claude.json` (alcance local) se cargan en una sesión del SDK. Hasta verificarlo, el MCP de Jira se declara explícitamente en `mcpServers`.

Resultado: registrar la evidencia en `docs/DECISIONS.md` (D-022). Sin escrituras en Jira ni en Outlook durante el spike.

### 9.1 Backend

- `POST /licenses/drafts`: construye un borrador determinista a partir de la plantilla fija y los campos variables (rango de fechas, clave de épica accesible para el usuario, notas opcionales). Valida fechas, solapamiento con un borrador o ticket existente y que la épica sea legible con la conexión Jira del propio usuario.
- `POST /licenses`: crea el issue en Jira con el token OAuth del usuario SOLO con confirmación explícita ligada al borrador (id del borrador + hash del contenido). Idempotente (mismo usuario + épica + fechas nunca crea dos tickets) y auditado sin secretos.
- Mapea errores de Jira (403, 400 por campo requerido, 429). Requiere el scope `write:jira-work` (ya previsto en los scopes).

### 9.2 Entrada de calendario

- Generar un `.ics` descargable (RFC 5545, evento de día completo "Vacaciones", UID estable por solicitud), importable en Outlook o cualquier calendario. Funciona sin Microsoft Entra.
- Limitación documentada: no crea el evento automáticamente dentro de Outlook.
- El `.ics` es la opción por defecto y el respaldo automático cuando el conector, las herramientas de escritura o el modo de autenticación no estén disponibles (ver 9.2b).

### 9.2b Crear el evento en Outlook mediante el agente y el MCP de Outlook (opción elegida, D-022; depende del spike 9.0b)

El agente crea el evento con el conector Microsoft 365 / Outlook MCP. Reglas de seguridad:

- El agente propone; el backend/UI muestra la vista previa del evento y la persona confirma antes de cualquier escritura (`canUseTool` o hook `PreToolUse`, con validación de argumentos: fechas, título, día completo).
- Allowlist de herramientas exactas (`allowedTools` + `permissionMode: "dontAsk"`); nunca `bypassPermissions`.
- Ninguna herramienta de escritura de Jira alcanzable por el agente (`disallowedTools`: `jira_create_issue`, `jira_transition_issue`, `jira_update_issue`, `jira_add_comment`).
- Aislamiento de corridas: una corrida que lee contenido de Jira (títulos y notas, datos no confiables frente a prompt injection) no puede invocar herramientas de escritura de calendario sin pasar por la UI de confirmación.
- El `.ics` (9.2) sigue siendo el respaldo automático si el conector, las herramientas de escritura o el modo de autenticación no están disponibles.
- Riesgo abierto: la política de uso del login de suscripción por aplicaciones de terceros (SIN VERIFICAR para una app personal local) y la dependencia de que el administrador habilite las herramientas de escritura. Punto de decisión tras el spike: mantener 9.2b, pasar a Microsoft Graph (9.5) o quedarse con `.ics`.

### 9.3 Frontend

- Vista "Licencias": formulario (rango de fechas, búsqueda de épica, notas), vista previa del borrador, botón de confirmación explícita y resultado con enlace al issue de Jira y "Descargar .ics".
- Estados: carga, error, vacío, sin permiso y duplicado.

### 9.4 Agente de IA (opcional, feature flag; apagado si `ANTHROPIC_API_KEY` no está definida)

- El usuario escribe texto libre ("me voy del 3 al 14 de noviembre, épica X") y el agente (Claude Agent SDK) PRODUCE un borrador estructurado (fechas, épica candidata, notas). El agente nunca escribe en Jira: el ticket lo crea el backend NestJS con el token OAuth del usuario tras la confirmación (9.1), NO el agente por MCP. La única escritura permitida al agente es el evento de Outlook de 9.2b, solo con confirmación y si el spike 9.0b lo valida.
- El MCP de Jira (`mcp-atlassian`) se declara explícitamente en `mcpServers` con herramientas de solo lectura en la allowlist y las de escritura en `disallowedTools`. No se asume que las entradas de `~/.claude.json` se carguen (spike 9.0b).
- El modo de autenticación condiciona el diseño: con `ANTHROPIC_API_KEY` el conector Microsoft 365 no se carga (queda `.ics`); con login de suscripción se carga, sujeto a la política de terceros (SIN VERIFICAR). El conector de Messages API (`mcp-client-2025-11-20`) solo funciona con servidores MCP HTTP públicos y no sirve para `mcp-atlassian` local (stdio).
- Requisitos: clave solo en el entorno del backend; al modelo no se envían secretos, tokens ni PII más allá de lo que el usuario escribió; límites de tamaño y de tasa; logs sin contenido; degradación elegante al formulario manual; nota de prompt injection (títulos de épicas y notas provenientes de Jira son datos no confiables).
- Los tests usan un cliente de modelo falso; nunca se llama a la API real en tests.

### 9.5 Opcional, post-MVP

- Leer eventos de Outlook con Microsoft Graph (`Calendars.Read`, app Entra, posible consentimiento de administrador) para listar eventos de vacaciones con un botón "Generar ticket de licencia". Reutiliza el patrón de estado OAuth y tokens cifrados de la Fase 2.

**Gate de aceptación:** tests con un Jira mock demuestran que (a) no se crea ningún ticket sin confirmación, (b) se previenen los duplicados, (c) los usuarios están aislados, (d) una épica inválida o inaccesible se rechaza sin filtrar detalles, (e) los borradores son deterministas, (f) con la IA apagada o fallando el flujo manual sigue funcionando, (g) no hay escrituras reales a Jira en tests automatizados. Un ticket real se crea una sola vez, manualmente, en un entorno/proyecto explícitamente autorizado por el usuario.

**Gate de aceptación final del MVP (se cumple aquí):** el MVP puede levantarse desde cero siguiendo README; typecheck/lint/tests pasan; no hay secretos en repo; métricas reales verificadas contra Jira; gate de la Fase 9 cumplido.

## Segunda entrega (fuera del MVP)

1. Microsoft Entra ID / OIDC como proveedor adicional vinculado al usuario interno existente.
2. Deploy de web/API/PostgreSQL en Railway, migraciones y configuración de dominio/callbacks.
3. Hardening de producción, backups, monitorización y política de registro/invitaciones.
4. Lectura/escritura de eventos de Outlook vía Microsoft Graph (ver 9.5); la Skill de Claude Code de licencias sigue como herramienta opcional de desarrollo.

## Definition of Done por fase

- Código compilable y tipado.
- Tests relevantes ejecutados; reportar comandos y resultado real.
- Migraciones versionadas y reproducibles.
- README/env docs actualizados.
- Ningún secreto o dato real de Jira en fixtures/logs.
- No se toca Jira real desde tests automatizados.
- Criterios de aceptación marcados con evidencia, no solo declarados.
