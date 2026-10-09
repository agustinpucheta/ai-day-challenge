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

## Fase 2 — OAuth individual de Jira Cloud

- Registrar una única integración OAuth Atlassian 3LO del producto (configuración manual de developer console documentada).
- Implementar start/callback, `state` one-time, intercambio de code, `accessible-resources`/cloudId, tokens cifrados y conexión asociada al userId de sesión.
- Implementar refresh token rotatorio con control de concurrencia, estado de reautorización y desconexión.
- Seleccionar scopes mínimos según endpoints usados; incluir `offline_access` si se precisa refresh token y justificar scopes de lectura/escritura.
- Nunca pedir a cada usuario que cree su propia aplicación OAuth ni recopilar API tokens.

**Gate de aceptación:** usuario A conecta su Jira; usuario B no puede usar A's connection ni inspeccionar tokens. Los tests simulan callback inválido, state replay, token expiry, refresh rotation y revocación.

## Fase 3 — Jira Gateway y búsqueda/lectura

- Definir el adapter a partir del contrato validado en Fase 0.
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
- Backend verifica sesión y conexión propia; obtiene las transiciones disponibles y valida el ID antes de aplicar.
- Escribir con token OAuth individual; recargar issue y métricas tras éxito.
- Auditar resultado sin secretos; manejar expiración, 403, rate limit y transiciones desactualizadas.

**Ajustes post-descubrimiento:**
- Los IDs de transición dependen del estado origen: consultarlos siempre por issue.
- Obtener la `statusCategory` del estado destino desde el campo `to` de la respuesta REST (el MCP no lo expone; verificar en Fase 3).

**Gate de aceptación:** un usuario sin permiso no puede cambiar el estado; no se puede enviar cualquier transition ID; la operación queda registrada.

## Fase 8 — End-to-end y cierre del MVP

- Tests de integración de API con Jira mock.
- E2E del flujo login -> connect (OAuth simulado o sandbox) -> search -> track -> metrics -> dependency -> transition (mock/sandbox).
- Validación de accesibilidad básica, manejo de errores, carga y responsive desktop.
- Revisión de seguridad por QA agent y corrección de findings altos/críticos.
- Documentar setup local, variables, configuración OAuth y troubleshooting.

**Gate de aceptación final:** el MVP puede levantarse desde cero siguiendo README; typecheck/lint/tests pasan; no hay secretos en repo; métricas reales verificadas contra Jira.

## Segunda entrega (fuera del MVP)

1. Microsoft Entra ID / OIDC como proveedor adicional vinculado al usuario interno existente.
2. Deploy de web/API/PostgreSQL en Railway, migraciones y configuración de dominio/callbacks.
3. Hardening de producción, backups, monitorización y política de registro/invitaciones.
4. Activar/promover la Skill de licencias después de descubrir la plantilla real.

## Definition of Done por fase

- Código compilable y tipado.
- Tests relevantes ejecutados; reportar comandos y resultado real.
- Migraciones versionadas y reproducibles.
- README/env docs actualizados.
- Ningún secreto o dato real de Jira en fixtures/logs.
- No se toca Jira real desde tests automatizados.
- Criterios de aceptación marcados con evidencia, no solo declarados.
