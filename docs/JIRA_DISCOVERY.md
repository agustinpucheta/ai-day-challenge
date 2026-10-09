# Descubrimiento de la instancia Jira

Completar en la Fase 0 usando el MCP local disponible y/o documentación de la instancia. No adjuntar secretos ni datos personales innecesarios.

Estado al 2026-10-09: descubrimiento inicial realizado en solo lectura mediante el MCP `mcp-atlassian`. Solo se usaron `jira_search`, `jira_get_issue` y `jira_get_transitions`; no se ejecutó ninguna escritura. El detalle está en [Hallazgos y evidencia](#hallazgos-y-evidencia-2026-10-09).

## Conectividad y OAuth

- [x] Confirmar Jira Cloud y URL de sitio. Confirmado: Jira Cloud en `fpatronal.atlassian.net`. El valor concreto se configura por entorno, no se hardcodea.
- [ ] Confirmar que la app OAuth 3LO de producto puede crearse/configurarse en Atlassian Developer Console. PENDIENTE: paso manual del usuario.
- [x] Identificar las herramientas MCP disponibles en esta sesión y qué operaciones permiten. MCP es para desarrollo/Claude Code; NestJS tendrá cliente OAuth REST independiente.
- [ ] Identificar los endpoints REST y scopes mínimos actuales para búsqueda, issue, changelog, issue links, transitions y perfil/sitio si hace falta. PENDIENTE: confirmar contra documentación oficial en Fase 2.
- [ ] Verificar callback local permitido y registrar URI exacta en env/config. Propuesta: `http://localhost:3000/api/v1/jira/oauth/callback`; PENDIENTE de registrar en la app OAuth.

## Modelo real de issues

- [x] Proyecto(s) relevantes y key(s), sin guardarlos como secreto.
- [x] Tipo(s) de issue de épica, historia, task, bug y subtarea (los que existan).
- [x] Campo/relación de parent de un issue a épica, incluido si usa jerarquía moderna o campo personalizado.
- [x] Campo exacto de story points (field ID + tipo); no dar por hecho `customfield_10016` ni otro. Ver D-012.
- [x] Estados y categorías de estado; definición acordada de Done y tratamiento de resolución. Ver D-014. Categorías de algunos estados siguen PENDIENTES.
- [x] Campo(s) requeridos para recuperar subtareas e hijos; queries JQL de prueba.
- [x] Paginación y límites de la API observados (vía MCP; la paginación REST se verifica en Fase 3).

## Historial semanal

- [ ] Endpoint y permisos para leer changelog de los issues. Parcial: el MCP expone changelog; PENDIENTE verificar paginación de `/rest/api/3/issue/{key}/changelog` en Fase 3.
- [x] Confirmar si changelog contiene el cambio de status y del campo story points, incluyendo from/to.
- [ ] Determinar cómo interpretar cambios de estimación, reaperturas y issues que pasaron a Done varias veces. Parcial: política definida en D-012 a D-014 y PRODUCT_SPEC §4; PENDIENTE un ejemplo real de reapertura.
- [x] Definir zona horaria del gráfico y límites lunes-domingo. SUPUESTO inicial: `America/Argentina/Buenos_Aires` (`APP_TIMEZONE`).
- [ ] Verificar con varios issues conocidos que el conteo semanal coincide con Jira. PENDIENTE para Fase 4.

## Dependencias

- [x] Obtener un ejemplo de `issuelinks` para `blocks` y otro para `is blocked by`.
- [x] Confirmar `link type name`, inward/outward description y dirección exacta.
- [x] Confirmar si el issue relacionado puede quedar fuera de la épica o proyecto de origen.
- [ ] Probar escenario donde el usuario no tiene permiso para leer el issue enlazado. PENDIENTE: requiere una segunda cuenta.

## Transiciones

- [x] GET de transiciones válidas sobre un issue que se pueda cambiar.
- [x] Identificar transiciones y permisos según el workflow; no hardcodear estados objetivo.
- [ ] Verificar comportamiento 401/403, refresh token, rate limit y transition obsoleta. PENDIENTE para Fases 2, 3 y 7 (requiere cliente REST propio).
- [x] No enviar una transición de producción durante el descubrimiento.

## Hallazgos y evidencia (2026-10-09)

Fuente: MCP `mcp-atlassian`, solo lectura. Etiquetas: **CONFIRMADO** (observado con evidencia), **SUPUESTO** (inferencia razonable no verificada), **PENDIENTE** (falta verificar). Los IDs y nombres descubiertos se deben convertir en configuración tipada/tests, no dejarlos solo en memoria de Claude.

### Sitio y proyectos

- **CONFIRMADO** — Jira Cloud, sitio `fpatronal.atlassian.net`.
- **CONFIRMADO** — Proyecto principal `MASIN` ("Mars-Siniestros"). Existen referencias cruzadas a `MAART`, `MAADM` y `RSF` mediante parent/epic link e issue links.

### Herramientas MCP y forma de las respuestas

- **CONFIRMADO** — Herramientas de lectura: `jira_search`, `jira_get_issue`, `jira_get_transitions`. Existen herramientas de escritura que **no deben usarse**: `jira_transition_issue`, `jira_update_issue`, `jira_create_issue`, `jira_add_comment`.
- **CONFIRMADO** — No hay herramienta para listar todos los campos, ni lista de tipos de link, ni changelog paginado.
- **CONFIRMADO** — El MCP es solo para desarrollo. El backend NestJS usa su propio cliente REST con OAuth 3LO.
- **CONFIRMADO** — La salida del MCP está simplificada respecto de REST:
  - `status` llega como `{name, category (en español), color}`; `statusCategory.key` (`new`/`indeterminate`/`done`) solo se ve en `parent`/`subtasks` anidados.
  - Los campos nulos se omiten.
  - Los ítems de changelog traen nombre de campo, `fieldtype`, `from`/`to` (string e id), pero **no** `fieldId`.
  - Las transiciones solo devuelven `{id, name}`.
  - La búsqueda devuelve `total = -1` y pagina con `next_page_token`; `limit` entre 1 y 50. Algunos tokens contienen el texto `UNSUPPORTED_JQL` (impacto PENDIENTE).
- **SUPUESTO** — El changelog del MCP parece limitado a 100 entradas: MASIN-8181 devolvió exactamente 100 sin llegar a la creación; MASIN-10730 devolvió 59 completas.
- **PENDIENTE (Fase 3)** — Paginación de REST `/rest/api/3/issue/{key}/changelog` y presencia del estado destino (`to`) en REST de transiciones.
- **Consecuencia:** los fixtures y tests de contrato se basan en respuestas REST v3, no en la forma del MCP.

### Tipos de issue

- **CONFIRMADO** — `Epic` (hierarchyLevel 1).
- **CONFIRMADO** — Nivel 0: Historia, Tarea, Mejora, Error, Licencias, Reunion, Analisis - Tarea, Prototipado, Deploy, Bug-test.
- **CONFIRMADO** — Subtareas (`subtask: true`, hierarchyLevel -1): Subtarea, Analisis, TEST.
- **CONFIRMADO** — Trampa de JQL: `issuetype = Historia` devuelve vacío sin error; `issuetype = Story` funciona. `Epic`, `Subtarea` y `Tarea` funcionan por nombre; el resto no se verificó.
- **Recomendación:** mapear tipos de issue por id / `hierarchyLevel` / `subtask`, nunca por nombre visible.

### Jerarquía

- **CONFIRMADO** — Jerarquía moderna con `parent`. `parent = MASIN-10713` devolvió 33 hijos directos (sin subtareas).
- **CONFIRMADO** — `"Epic Link" = MASIN-10713` también funciona. `customfield_10013` ("Enlace de epic") está poblado en historias/tareas y es nulo en subtareas.
- **CONFIRMADO** — Subtareas: el padre expone `subtasks[]` (con estado y `statusCategory.key`); el hijo expone `parent` (ej. MASIN-13360 -> MASIN-13087).

### Story points

- **CONFIRMADO** — `customfield_10023` "Story Points" (number): poblado en historias (13/21/33: MASIN-12238, MASIN-8181, MASIN-10730, MASIN-12235), en subtareas (1 a 5), a veces en tareas/errores; la épica MASIN-12056 tiene 0.0.
- **CONFIRMADO** — `customfield_10204` "StoryPoint Finales" (number): normalmente igual a 10023, pero difiere en MASIN-13347, MASIN-13160 y MASIN-3005 (2 vs 1); nulo en MASIN-13346 mientras 10023 = 1.
- **CONFIRMADO** — `customfield_10015` "Estimación de puntos de historia": mayormente nulo, 2.0 en algunas subtareas. No se usa.
- Decisiones derivadas: D-012 (dos campos de SP) y D-013 (SP solo desde subtareas).

### Estados y categorías

| Categoría | Estados (id) |
|---|---|
| `new` ("Por hacer") | Abierto (1), En espera (10078), Esperar Recurso (10068), DEV Imp. Pendiente (10179), Bloqueado por BUG (10180), TEST Imp. Pendiente, PROD Implementado, Pendiente Deploy |
| `indeterminate` ("En curso") | En progreso (3), TEST Prueba (10183) |
| `done` ("Listo") | Cerrado (10016), Resuelto, Cancelado (10000) |
| PENDIENTE | DEV Implementado (10083), DEV Prueba (10065), TEST Implementado (10182), test uat pend (10184), test uat (10185), PROD Imp. Pendiente (10186), prod uat pend (10188), UAT PROD (10189) |

- **Regla:** leer `statusCategory.key` desde Jira en runtime; nunca hardcodear listas de estados.
- **CONFIRMADO** — `resolution` casi no se usa (3 de 23 issues en Cerrado; ids 10000 y 10004). No se usa `resolution` para definir completado.
- Decisión derivada: D-014 (Cancelado no cuenta como completado).
- **Disponible para tomar (D-025):** se usa el id `10068` (“Esperar Recurso”, categoría `new`) tomado de la tabla anterior, configurado en `availableStatusIds`. Debe reverificarse contra el sitio real antes de depender de él; si el id difiere, se corrige solo la configuración.

### Changelog

- **CONFIRMADO** — Los cambios de estado incluyen ids y nombres from/to con timestamp (MASIN-8181: 13 transiciones; MASIN-10730).
- **CONFIRMADO** — Los cambios de SP se identifican por nombre de campo ("Story Points", "StoryPoint Finales", `fieldtype` custom). Ej.: MASIN-10730 Story Points None -> 13; MASIN-13375 1 -> "" y luego -> 1.
- **CONFIRMADO** — Ruido: unas 67 de 100 entradas son de worklog; también aparecen `IssueParentAssociation` y cambios de links.
- **CONFIRMADO** — Una automatización de Jira escribe entradas Cerrado -> Cerrado (MASIN-13375, MASIN-13218): filtrar entradas con `from == to`.
- **PENDIENTE** — Ejemplo real de reapertura (Done -> no Done -> Done).

### Dependencias (links)

- **CONFIRMADO** — Tipo `Blocks`, id `10000`, inward "is blocked by", outward "blocks".
- **CONFIRMADO** — En el issue X, un `outward_issue` Y bajo `Blocks` significa que X bloquea a Y. Verificado: MASIN-13412 outward MASIN-13414 (con espejo inward en MASIN-13414); MASIN-8181 -> MASIN-2820; MASIN-13346 -> MASIN-13347.
- **CONFIRMADO** — Hay bloqueos entre épicas (MASIN-8181 en épica MASIN-6774 bloquea a MASIN-2820 en épica MASIN-12899) y una épica que bloquea una mejora (MASIN-6578 -> MASIN-8638).
- **CONFIRMADO** — Otros tipos: Cloners (10001), Relates (10003), a veces entre proyectos.
- **PENDIENTE** — Issue enlazado inaccesible (requiere una segunda cuenta).

### Transiciones (solo lectura, ninguna ejecutada)

- **CONFIRMADO** — MASIN-13439 (Abierto): 71 Cancelado, 81 En espera, 211 Esperar Recurso, 11 A En Progreso.
- **CONFIRMADO** — MASIN-12238 (TEST Prueba): 351 Cancelado, 361 En espera, 251 NO OK, 261 OK.
- **Regla:** los IDs de transición dependen del estado origen; consultarlos siempre por issue.

### OAuth y sitio

- **CONFIRMADO (documentación)** — `cloudId` se obtiene vía `accessible-resources`.
- **SUPUESTO** — Callback local `http://localhost:3000/api/v1/jira/oauth/callback`.
- **PENDIENTE** — Creación de la app en Atlassian Developer Console (paso manual del usuario) y scopes mínimos a confirmar en Fase 2 contra la documentación oficial.

### Zona horaria

- **SUPUESTO** — Valor inicial `America/Argentina/Buenos_Aires` (`APP_TIMEZONE` en `.env`).

### JQL utilizados

```text
assignee = currentUser() OR reporter = currentUser() ORDER BY updated DESC
project = MASIN AND updated >= -90d ORDER BY updated DESC
project = MASIN AND issuetype = Story AND statusCategory = Done ORDER BY updated DESC
project = MASIN AND status CHANGED FROM Cerrado ORDER BY updated DESC
parent = MASIN-10713 ORDER BY key ASC
"Epic Link" = MASIN-10713
project = MASIN AND issueLinkType in ("blocks", "is blocked by") ORDER BY updated DESC
```

Variantes con `issuetype = Historia` devolvieron vacío sin error (ver Tipos de issue).

## Configuración tipada

Los ids confirmados arriba viven en `backend/src/jira/jira.config.ts` (campos de story points `customfield_10204` finales y `customfield_10023` planificados, `customfield_10013` Epic Link informativo, categorías de estado `new|indeterminate|done` y el id del estado Cancelado `10000`, D-014). Los issues se normalizan por id, `hierarchyLevel` y `subtask`, nunca por nombre; un valor nulo de story points se conserva como `null`.

Forma REST v3 de la búsqueda, verificada contra la documentación oficial de Jira Cloud (https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/) el 2026-10-09:

- **Verificado en documentación** — `POST /rest/api/3/search/jql` recibe en el cuerpo `jql`, `fields`, `maxResults` y `nextPageToken`; el `/rest/api/3/search` clásico figura como "currently being removed".
- **Verificado en documentación** — `GET /rest/api/3/issue/{issueIdOrKey}` acepta `fields` como parámetro de consulta.
- **CONFIRMADO (verificación real, 2026-10-09, solo lectura)** — Con la REST v3 real (`POST /rest/api/3/search/jql`, credenciales de API token) la búsqueda por clave y por texto devuelve `issues` y `nextPageToken` (la primera página trae un token opaco; la segunda página se obtiene con él y funciona). Se observó en el sitio real: tipo `Epic` con `hierarchyLevel` 1, tipos de nivel 0 `Tarea`, `Historia` y `Licencias` (id `10127`, relevante para la Fase 9), un estado `Cancelado` con categoría `done` (se marca como cancelado y no como completado) y resultados de otros proyectos (MAADM, MAART, INC). El detalle de una historia con 6 subtareas devolvió los puntos planificados (`customfield_10023` = 13) y los finales en `null`; una clave inexistente da 404 y una clave inválida 400 sin llamar a Jira.
- **PENDIENTE** — La presencia y el valor del campo `isLast` no se inspeccionaron en las pruebas reales, y el impacto del texto `UNSUPPORTED_JQL` dentro de algunos tokens solo se probó con 2 páginas (sin problemas); falta recorrer una búsqueda completa hasta la última página.
