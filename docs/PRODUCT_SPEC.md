# Especificación de producto

## 1. Visión

Dashboard local y personalizado para seguir épicas e historias de Jira Cloud. El usuario busca un issue, lo abre, entiende su avance real y puede guardarlo como seguimiento. La interfaz debe permitir detectar qué trabajo está terminado, qué falta, qué se completó semana a semana y qué tareas bloquean a otras.

## 2. Usuarios y autenticación

- MVP para varios usuarios de una misma instancia de la app local, cada uno con identidad propia de la aplicación.
- Entrega 1: registro/login local con email y contraseña; password hash seguro, sesión de servidor y PostgreSQL.
- Cada usuario conecta su propia cuenta Jira Cloud mediante OAuth 2.0 de Atlassian (3LO).
- No hay credenciales compartidas de Jira. Operaciones de lectura y escritura usan el token vinculado al usuario autenticado.
- Microsoft SSO se incorpora en la Entrega 2. El identificador interno del usuario debe permanecer estable para poder vincular una identidad externa sin perder preferencias.
- Railway queda fuera de la primera entrega.

## 3. Casos de uso principales

1. Crear una cuenta local e iniciar sesión.
2. Conectar Jira y seleccionar/autorizar el sitio `*.atlassian.net`.
3. Buscar una épica o historia por clave o texto.
4. Abrir una vista de detalle con subtareas/descendientes pertinentes, métricas, actividad semanal y dependencias.
5. Guardar y quitar de seguimiento épicas e historias.
6. Configurar preferencias personales y recuperarlas después de cerrar sesión.
7. Consultar las transiciones de estado válidas de un issue y ejecutar una transición que Jira ofrezca, con la conexión y permisos del usuario.
8. Actualizar los datos y conocer la antigüedad de la última consulta.

## 4. Indicadores

### Definición de completado y cancelado

- “Completado” = `statusCategory.key = done` leído de Jira **y** estado distinto de Cancelado (status id `10000`, configurable). No se usa `resolution` ni una lista fija de nombres en código (D-014).
- “Cancelado” = estado Cancelado. Se excluye del avance completado y de los SP semanales consumidos, y se informa como métrica separada de “cancelados” (conteo y SP).
- Pendiente antes de Fase 4: si los cancelados permanecen en el denominador del avance.

### Avance por cantidad de issues

- Para una historia que tiene subtareas: subtareas completadas / total de subtareas, presentado también como conteo.
- Para una épica: issues hijos dentro del alcance / total de issues hijos dentro del alcance.
- No mostrar 0% si no hay datos o hay un error. Mostrar “Sin subtareas”, “Sin estimación” o “No disponible”, según corresponda.
- Evitar doble contabilización por consultas solapadas y jerarquías.

### Story points completados por semana

- Semana de lunes a domingo, con zona horaria configurable (valor inicial: `America/Argentina/Buenos_Aires` vía `APP_TIMEZONE`, supuesto documentado en `JIRA_DISCOVERY.md`).
- Los SP se suman solo desde subtareas (`subtask = true` / `hierarchyLevel = -1`); nunca se suman SP de historias, épicas u otros issues de nivel 0 (D-013).
- El valor consumido es `customfield_10204` “StoryPoint Finales” de la subtarea (D-012).
- Una subtarea cuenta en la semana de su primera entrada real a un estado completado (done y no cancelado), según el changelog de Jira. Se ignoran las entradas de automatización con estado origen igual al destino (`from == to`).
- El valor de SP se toma al completarse; si el changelog no permite reconstruirlo, marcar el valor como aproximado y documentar la limitación.
- Una subtarea sin “StoryPoint Finales” se informa como “sin estimación”, nunca como 0.
- Una subtarea que ya estaba terminada antes del periodo no se atribuye a la semana actual.

### Desvío de planificación

- Compara “Story Points” (`customfield_10023`, planificado) con “StoryPoint Finales” (`customfield_10204`, final) por subtarea y agregado por historia/épica.
- Los valores nulos se reportan como “sin estimación” (con conteo de subtareas afectadas) y no se convierten en 0 para el agregado.

### Subtareas

- Presentar completadas y pendientes (y opcionalmente en curso), con clave y enlace a Jira.
- Para una historia sin subtareas, presentar un estado específico en lugar de una división por cero.

### Dependencias

- Usar enlaces de Jira `blocks` / `is blocked by`.
- Normalizar la relación a `bloqueador -> bloqueado`, independientemente de la dirección entregada por Jira.
- Incluir bloqueos internos y externos a la épica/historia seleccionada cuando la cuenta del usuario pueda acceder a la tarea vinculada.
- Mostrar clave, título, estado y enlace. Si la existencia de un vínculo es conocida pero el issue enlazado no se puede consultar, no filtrar información no autorizada: mostrar un aviso genérico de que hay una dependencia inaccesible cuando sea seguro hacerlo.
- El estado actual y los datos del vínculo proceden de Jira; no inferir enlaces por lenguaje natural.

## 5. Preferencias por usuario

- Issues seguidos (clave e identificador del sitio Jira).
- Orden de presentación.
- Preferencias de visualización de SP semanales, subtareas y dependencias.
- Filtros y vistas guardadas si se completan dentro del MVP.
- Preferencias persistidas en PostgreSQL y aisladas por usuario.
- La cache o snapshots que contengan información de Jira deben estar aislados por conexión/usuario para no revelar issues entre usuarios con permisos distintos.

## 6. Cambios de estado

- La interfaz obtiene las transiciones válidas del issue a través del backend.
- Solo permite seleccionar una transición devuelta por Jira en esa consulta.
- La ejecución ocurre con el token OAuth del usuario y registra resultado, issue, transición y timestamp, sin guardar secretos.
- Manejar permisos insuficientes, sesión expirada, token revocado, transición desactualizada y fallos de red.
- No implementar edición arbitraria de campos, transiciones masivas ni acciones de administrador en el MVP.

## 7. Skill de licencias (separada del dashboard)

- Funcionalidad futura de Claude Code usando el MCP ya configurado.
- El formato es fijo y debe definirse inspeccionando la plantilla real de Jira.
- La interacción diaria debe pedir únicamente la épica de destino; si existen épicas ambiguas, solicitar aclaración. El contenido fijo no se vuelve a preguntar.
- Antes de activar la Skill deben verificarse el tipo de issue, los campos requeridos, los campos personalizados y cómo relacionar el ticket a la épica.
- La Skill no debe crear un ticket real hasta que la plantilla esté verificada y el usuario haya aprobado el borrador concreto.
- No implementar esta funcionalidad dentro de la Entrega 1 del dashboard.

## 8. Criterios globales de UX

- Mostrar estados de carga, error, vacío y caché obsoleta diferenciados.
- Toda métrica debe poder explicarse con una regla clara y datos de origen.
- Los números de los mockups son ficticios; en producción todos los números deben proceder de Jira o de un cálculo documentado.
- El usuario puede navegar al issue original desde cada tarjeta/fila.
