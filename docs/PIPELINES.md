# Pipelines de negocio

## Pipeline A — Autenticación de usuario local

1. Registrar usuario (si el registro local está habilitado) o iniciar sesión.
2. Normalizar email y verificar password hash con comparación segura.
3. Crear sesión de servidor y cookie segura según entorno.
4. En cada request privada, resolver la identidad desde la sesión; no aceptar el propietario desde el payload.
5. Logout invalida la sesión en el store y borra la cookie.

## Pipeline B — Conectar Jira por usuario

1. Usuario ya autenticado en el dashboard pulsa “Conectar Jira”.
2. NestJS crea un `state` aleatorio, de un solo uso, vinculado a la sesión del usuario y con expiración breve.
3. Redirige al endpoint de autorización Atlassian con `client_id`, `redirect_uri`, scopes mínimos, `response_type=code`, `state` y `prompt=consent` según documentación vigente.
4. Callback verifica `state`, expiración, usuario y uso único; maneja cancelación y errores.
5. Backend intercambia el code por access/refresh tokens; pide los sitios autorizados y resuelve `cloudId`.
6. Cifra tokens y los persiste asociados al usuario y al sitio autorizado.
7. En renovación, serializar renovaciones concurrentes y guardar el nuevo refresh token rotatorio antes de considerar completada la operación.
8. Si el refresh token revocado/expirado no puede renovarse, marcar conexión como `reauthorization_required` y pedir reconectar.
9. Desconexión elimina/revoca la conexión y destruye las credenciales almacenadas conforme al flujo implementado.

## Pipeline C — Buscar y cargar issue

1. Validar que existe sesión y conexión Jira autorizada del usuario.
2. Buscar por clave o texto con un contrato de búsqueda limitado y seguro.
3. Consultar issue y campos reales; resolver jerarquía (épica -> historias/tasks -> subtareas) en función de los campos de la instancia.
4. Cargar issue links para dependencias y traer metadatos accesibles de issues relacionados.
5. Normalizar a DTOs internos y aplicar protección frente a datos inaccesibles.
6. Calcular métricas deterministas y preparar una respuesta con `lastFetchedAt`, advertencias y `isStale` si aplica.
7. Frontend muestra estado de carga/error/vacío/datos y enlace al issue Jira.

## Pipeline D — Calcular avance/subtareas

- Completado = `statusCategory.key = done` **y** estado distinto de Cancelado (status id configurable, `10000` según descubrimiento). No usar `resolution` (D-014).
- Cancelados: excluir del conteo de completados y reportar como métrica separada `cancelled` (conteo y SP). Su inclusión en el denominador queda pendiente de decisión antes de Fase 4.
- Historia con subtareas: reportar completadas, pendientes, canceladas y total; porcentaje = completadas / total * 100. Si total=0, devolver `null` y `subtaskState='none'`.
- Épica: contar issues hijos sin duplicados; porcentaje por cantidad = completados / total * 100. No contar la épica misma como hijo.
- Tipos de issue se identifican por id / `hierarchyLevel` / `subtask`, no por nombre visible.
- SP: sumar solo desde subtareas (D-013), usando `customfield_10204` “StoryPoint Finales” como valor consumido (D-012). No llamar “SP completados” al SP total estimado ni sumar SP de historias/épicas.
- Desvío de planificación: por subtarea y agregado, comparar `customfield_10023` “Story Points” (planificado) con `customfield_10204` (final). Reportar nulos como “sin estimación” con su conteo; no convertirlos en cero.
- Si no hay estimaciones o no se pueden leer, informar `estimated: false` / advertencia, no tratar el dato ausente como cero.

## Pipeline E — SP completados por semana

1. Considerar solo subtareas (`subtask = true` / `hierarchyLevel = -1`) del alcance seleccionado (D-013).
2. Recuperar el changelog paginado (`/rest/api/3/issue/{key}/changelog`) de cada subtarea: cambios de status y del campo “StoryPoint Finales” (`customfield_10204`). Ignorar ruido de worklog, links y `IssueParentAssociation`.
3. Descartar entradas de status con `from == to` (automatización de Jira, p. ej. Cerrado -> Cerrado).
4. Determinar la primera entrada real a un estado completado (done y no Cancelado) y asignarla a su semana calendario (lunes-domingo) en `APP_TIMEZONE`.
5. Leer “StoryPoint Finales” a la fecha de completado si la historia del campo está en el changelog; si es nulo, contar la subtarea como “sin estimación”, no como 0.
6. Aplicar la política de reapertura: la subtarea se cuenta una vez, en la semana de su primera entrada real a completado.
7. Las subtareas canceladas no suman SP consumidos; se agregan a la métrica separada de cancelados.
8. Agrupar por semana y devolver puntos, número de subtareas y advertencias de datos históricos incompletos.
9. Si Jira no permite reconstruir el valor a la fecha de completado, usar el fallback solo si está documentado y marcando el resultado como aproximado.

## Pipeline F — Dependencias

1. Leer links de Jira en cada issue relevante.
2. Normalizar el sentido: `blocks` significa el issue actual bloquea al linked issue; `is blocked by` significa el linked issue bloquea al actual. Validar la dirección exacta con la respuesta de la instancia real.
3. Deduplicar enlaces por ID/pareja de issues y tipo de link.
4. Consultar estado/título de issues relacionados usando la conexión del usuario.
5. Devolver lista `blockers[]` y `blockedIssues[]` con clave, estado, enlace y flags de accesibilidad.
6. Si un bloqueador no está completado, exponer alerta visual. No inferir bloqueo por team/component/summary.
7. Tratar ciclos como datos posibles; evitar loops infinitos y mostrar grafo acíclico solo como visualización opcional.

## Pipeline G — Guardar preferencias

1. Usuario autenticado manda issue a seguir o preferencia a modificar.
2. Validar el formato y verificar que el issue/site pertenezca a una conexión del usuario.
3. Persistir con unique key para evitar duplicados.
4. Al siguiente login, cargar preferencias del usuario y refrescar datos de Jira según TTL, sin confiar en un snapshot como estado real.

## Pipeline H — Ejecutar una transición de estado

1. Frontend pide las transiciones válidas para issue.
2. Backend usa conexión del usuario, consulta a Jira y devuelve opciones permitidas.
3. Usuario elige una opción concreta.
4. Backend vuelve a validar sesión, propiedad/conexión, ID de transición y opcionalmente refresca transiciones para evitar datos obsoletos.
5. Envía transición a Jira con el token del usuario.
6. Registra auditoría sin guardar credenciales y recarga issue/métricas.
7. Si Jira responde 401/403/409/400, mapearlo a un error útil sin intentar saltar permisos.

## Pipeline futuro — Crear ticket de licencia con Claude Skill

Separado del MVP. La plantilla debe quedar verificada por la Fase de descubrimiento. Flujo objetivo: pedir solo la épica; resolverla por clave/nombre; validar que sea inequívoca; aplicar plantilla fija; producir borrador; pedir confirmación del borrador; crear mediante MCP; verificar el issue y devolver clave/enlace. No ejecutar mientras la plantilla real no esté documentada.
