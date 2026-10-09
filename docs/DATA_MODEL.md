# Modelo de datos propuesto

Usar Prisma y migraciones. Todos los IDs internos deben ser UUID/CUID estables; timestamps UTC. Revisar los tipos concretos antes de la primera migración.

## `users`

- `id` (PK).
- `email_normalized` (unique).
- `display_name` nullable.
- `password_hash` (nullable para admitir identidad externa futura; requerido para cuenta local habilitada).
- `created_at`, `updated_at`, `disabled_at` nullable.

No usar email como clave de todas las relaciones; el email puede cambiar.

## `external_identities` (diseño compatible con Microsoft futuro)

- `id` (PK), `user_id` FK.
- `provider` (`microsoft`, más adelante).
- `issuer`, `subject`, `tenant_id` opcional.
- Unique apropiado por proveedor + issuer/subject (y tenant donde aplique).
- No vincular identidades automáticamente solo por coincidencia de correo sin un flujo de vinculación verificado.

## `sessions`

- Usar un store de sesiones de servidor respaldado por PostgreSQL (por ejemplo, store compatible con `express-session`).
- No implementar sesiones propias caseras si una biblioteca mantenida resuelve el caso.

## `jira_connections`

- `id` (PK), `user_id` FK.
- `cloud_id`, `site_url`, `site_name`.
- `atlassian_account_id` nullable.
- `access_token_ciphertext`, `refresh_token_ciphertext` (solo cifrados, no plaintext).
- `access_token_expires_at`, `scopes`/`granted_scopes`, `status`.
- `connected_at`, `last_used_at`, `last_refreshed_at`, timestamps.
- Unique por usuario + cloudId para evitar duplicar el mismo sitio; permitir varias conexiones futuras sin cambiar el modelo.
- Nunca devolver tokens al frontend ni en endpoints de debug.

## `user_preferences`

- `user_id` unique FK.
- `preferences_json` JSONB versionado o columnas tipadas para preferencias estables.
- `week_starts_on` (lunes por defecto), timezone si se decide configurarla y preferencias de visualización.
- `updated_at`.

Validar cualquier JSON en runtime; no aceptar una bolsa arbitraria de preferencias sin esquema.

## `tracked_issues`

- `id`, `user_id` FK, `jira_connection_id` FK, `cloud_id`, `issue_key`, `issue_id` si se conoce.
- `display_order`, flags de visualización opcionales, `created_at`.
- Unique `(user_id, jira_connection_id, issue_key)`.
- Verificar que issue/site pertenecen a una conexión de ese usuario antes de insertar.

## `saved_views` (opcional en MVP si el tiempo lo permite)

- `id`, `user_id`, `name`, `config_json` validado, timestamps.
- Posponer si tracked issues + preferencias cubren la primera necesidad.

## `audit_events`

- `id`, `user_id` nullable para eventos anónimos, `connection_id` nullable.
- `event_type`, `target_issue_key` nullable, `metadata_json` con whitelist de campos no sensibles, `success`, `error_code` sanitizado, `created_at`.
- Nunca guardar tokens, passwords, códigos OAuth, cookies, ni bodies completos que puedan incluir información sensible.

## Cache/snapshots

No agregar una tabla de copia de issues sin un caso medido. Si se necesita almacenar cache/snapshots:
- incluir connection/user scope y timestamp;
- mantener un TTL definido;
- no reutilizar datos entre usuarios con permisos diferentes;
- separar el estado actual de la historia usada para métricas;
- evitar que un snapshot actual se trate como fuente de historia de cambios.

## Índices y constraints

- Unique email normalizado.
- Índice por `user_id` y por `(user_id, jira_connection_id)` para preferencias/seguimientos.
- FK cascade cuidadosamente revisadas al desconectar/eliminar usuario.
- Las operaciones de guardar y quitar seguimiento deben ser idempotentes.
