# Requisitos de seguridad

## Identidad y sesión local

- Passwords con Argon2id o biblioteca actual y mantenida con parámetros de producción adecuados.
- No enviar ni registrar contraseñas o hashes en logs.
- Rate limit y respuestas de login que no permitan enumeración de cuentas.
- Sesión de servidor respaldada en PostgreSQL; cookie `HttpOnly`, `SameSite=Lax` o política justificada, `Secure` en HTTPS/producción y expiración razonable.
- Protección CSRF adecuada a la estrategia de cookies; validar Origin/Host en operaciones sensibles.
- Registro local solo en entorno previsto; antes de compartir/deployar, cerrar el registro público o añadir invitaciones/política explícita.

## OAuth Atlassian

- Una app OAuth 2.0 3LO del producto; cada usuario autoriza su cuenta con sus permisos.
- Validar `state` aleatorio, vinculado a sesión, expiración breve y uso único.
- Redirect URI exacta y allowlisted; nunca aceptar callback/destination arbitrario.
- Solicitar scopes mínimos correspondientes a operaciones implementadas; registrar la justificación de cada scope.
- Incluir el scope necesario para refresh token cuando aplique (por ejemplo, `offline_access`) y gestionar refresh token rotation como requisito crítico.
- Cifrar access y refresh tokens en reposo con AEAD (por ejemplo AES-256-GCM) y clave fuera de PostgreSQL/config versionada; rotación/versión de clave documentada.
- No usar token en URL, cliente web, logs, mensajes de error ni telemetría.
- Actualizar el refresh token rotatorio de manera atómica/serializada para reducir carreras concurrentes.
- Token expirado/revocado -> estado que requiere reconexión; no recurrir a credenciales compartidas.
- Desconexión limpia los tokens y hace inutilizable la conexión local.

## Cifrado de tokens

- Algoritmo: AES-256-GCM (Node `crypto`) con IV aleatorio de 12 bytes por cifrado y etiqueta de autenticación.
- Formato guardado en PostgreSQL: `v1.<versionClave>.<iv>.<tag>.<ciphertext>` (segmentos en base64url). La versión de clave viaja en el propio valor y también en `jira_connections.encryption_key_version`.
- Clave en `TOKEN_ENCRYPTION_KEY` (base64, exactamente 32 bytes) y `TOKEN_ENCRYPTION_KEY_VERSION` (entero positivo, por defecto 1); nunca en PostgreSQL ni en archivos versionados. Es obligatoria solo si Jira OAuth está configurado; si es inválida, el arranque falla nombrando únicamente la variable.
- Rotación: generar una clave nueva, subir la versión y pasar las claves anteriores en `TOKEN_ENCRYPTION_PREVIOUS_KEYS` (JSON `{"1":"<base64>"}`) para seguir descifrando; los tokens se reescriben con la clave vigente al refrescarse.
- AAD: cada token se vincula al identificador de su conexión, de modo que un ciphertext copiado a otra fila no descifra.
- Los errores de descifrado (`TokenDecryptionError`) no incluyen texto plano, claves ni ciphertext.

## Autorización multiusuario

- El usuario propietario se obtiene de sesión autenticada.
- Todas las queries de preferencias, seguimientos y conexiones filtran por `user_id`.
- Ningún endpoint acepta `userId` del frontend como autoridad.
- Cada llamada Jira resuelve token desde la conexión del usuario actual.
- La autorización del producto no amplía permisos en Jira; Jira debe decidir si la operación se permite.
- No cachear respuestas de Jira compartidas entre cuentas por defecto.

## Escrituras Jira

- Transiciones: solo IDs que Jira devuelve para ese issue; revalidar al enviar.
- Sin cambios masivos en MVP.
- Confirmación explícita en UI de la transición concreta.
- Auditar usuario, issue, transición/acción, momento y resultado; excluir tokens y datos sensibles.
- Tests de escritura con mocks o sandbox autorizado; nunca realizar escrituras reales en tests comunes.

## Manejo de errores y observabilidad

- Diferenciar fallo upstream, datos vacíos y permiso denegado.
- Sanitizar errores remotos y no filtrar URL/token/cuerpo sensible.
- No afirmar que Jira se actualizó hasta recibir confirmación/verificación.
- Rate limiting y timeout para llamadas a Jira.
- No loggear headers Authorization, cookies, OAuth codes ni secretos.

## Secretos y repositorio

- `.env` ignorado por Git; `.env.example` solo placeholders.
- Prohibido subir `.env`, tokens MCP, perfiles de Claude locales, tokens Jira o credenciales personales.
- No copiar la configuración local de MCP a archivos de proyecto.
- Antes de futura entrega Railway, revisar gestión de secretos, backups, HTTPS, dominios, callbacks, CORS, políticas de registro y retención de datos.
