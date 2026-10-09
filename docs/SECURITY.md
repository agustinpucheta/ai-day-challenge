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

## Manejo de conexiones Jira

- Una fila por autorización: los tokens pertenecen a la autorización y no al sitio, por lo que no se guardan copias del mismo refresh token en varios sitios (quedarían obsoletas tras la rotación). Si la autorización otorga varios sitios, se elige el que coincide con `preferredSiteUrl` o `ATLASSIAN_PREFERRED_SITE_URL` (sin valor por defecto); si ninguno coincide se devuelve `MultipleSitesError` con los candidatos (`cloudId`, nombre, URL) y no se guarda nada. Reconectar actualiza la misma fila (clave `user_id` + `cloud_id`) y la deja en `active`.
- Renovación serializada: si el access token vence en menos de 60 s, la renovación se hace dentro de una transacción con `SELECT ... FOR UPDATE` sobre la fila. Quien espera el bloqueo relee la fila y reutiliza el token ya renovado. El nuevo refresh token rotatorio se cifra y persiste en esa misma transacción, antes de devolver el access token. Las fallas transitorias (429, 5xx, red, respuesta inesperada) revierten la transacción, mantienen la conexión `active` y propagan el error tipado.
- Reautorización: un `invalid_grant` o un token imposible de descifrar (por ejemplo, ciphertext copiado a otra conexión) marcan la conexión como `reauthorization_required`, registran `jira_reauth_required` y lanzan `ReauthorizationRequiredError`. Las llamadas posteriores fallan sin contactar a Atlassian hasta que el usuario reconecte.
- Aislamiento: toda consulta filtra por `user_id`; la conexión de otro usuario es indistinguible de una inexistente (`ConnectionNotFoundError`).
- Desconexión: elimina la fila local, y con ella ambos tokens cifrados, y registra `jira_disconnected`; los eventos de auditoría se conservan (`connection_id` pasa a `NULL`). La documentación de Atlassian OAuth 2.0 (3LO) no define un endpoint de revocación de tokens para la aplicación, por lo que no se revoca de forma remota: el usuario puede quitar el acceso de la app desde su cuenta de Atlassian. Un refresh token sin uso caduca a los 90 días.
- La auditoría usa solo metadatos permitidos (`cloudId`, id de conexión, código de error); nunca tokens, códigos ni correos.

## State de OAuth

- El `state` son 32 bytes aleatorios (base64url). En `oauth_states` solo se guarda su hash SHA-256; el valor en claro viaja únicamente hacia Atlassian y de vuelta en el callback.
- Queda vinculado al usuario y a la sesión que lo emitió y vence a los 10 minutos.
- El consumo es atómico: un único `UPDATE ... WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > now() AND user_id = ? AND session_id = ?`. Si dos solicitudes compiten o se reproduce el callback, solo una gana.
- El servicio distingue internamente `invalid`, `expired`, `replayed` y `wrong_session` para auditoría y logs; la capa HTTP debe responder siempre con un único error genérico.
- Un intento de otro usuario o de otra sesión no consume el `state`. Las filas vencidas se eliminan con `deleteExpired()` (todavía sin programar).

## API token de Jira (modo de un solo usuario, D-023)

- Variables: `JIRA_URL` (https; `http` solo para `localhost`/`127.0.0.1`; se normaliza al origen, sin ruta ni query), `JIRA_USERNAME` (email de la cuenta) y `JIRA_API_TOKEN`. Las tres son opcionales: sin definir (o vacías) la conexión queda "no configurada". Una configuración parcial hace fallar el arranque nombrando solo las variables, nunca sus valores.
- El token se envuelve en un objeto `Secret` al validar el entorno: `JSON.stringify`, `String()` y `util.inspect` imprimen `[REDACTED]`. Solo `reveal()` devuelve el valor, y se usa únicamente al armar el header.
- `ApiTokenCredentialProvider` guarda email y token en campos privados y arma el header `Authorization: Basic base64(email:token)` en cada request. `JiraGateway` solo recibe los headers terminados; ni el token ni el header se exponen como propiedades.
- Las llamadas usan timeout de 10 s, sin reintentos ni redirecciones. Los errores tipados tienen mensajes fijos: no incluyen token, email, header ni cuerpos remotos, y se descarta la causa original de los fallos de red.
- Un 401 de Jira se informa como `JIRA_REAUTH_REQUIRED` con HTTP 424 (no 401), para no confundirlo con la sesión de la aplicación.
- Cualquier usuario local autenticado usa la identidad de este token (ver las mitigaciones de D-023). Los tests nunca usan el token real: `test/setup-env.ts` vacía las tres variables y el Jira se simula detrás de `HttpPort`.

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

- Búsqueda JQL: la entrada del usuario nunca se concatena en crudo. Una clave de issue se convierte en `key = "CLAVE"` y cualquier otro texto en `text ~ "..."` con barra invertida y comillas escapadas, caracteres de control eliminados y largo limitado; los filtros por tipo usan solo ids numéricos. Las claves de issue se validan antes de construir la URL.
- Privacidad de issues: ante un 403 o un 404 al leer un issue, el gateway responde siempre `JiraIssueNotFoundError`, de modo que quien consulta no puede distinguir entre un issue inexistente y uno sin permiso. El estado real queda solo en un campo interno no enumerable, que no se serializa ni se expone. En la capa HTTP (`GET /dashboard/issues/:issueKey`) ese error se traduce siempre al mismo 404 `ISSUE_NOT_FOUND_OR_INACCESSIBLE`, con idéntico estado, cuerpo y headers (hay un test que compara ambos cuerpos byte a byte); un 403 de una operación que no es de un issue concreto (la búsqueda) sí es `JIRA_FORBIDDEN` (424). Una respuesta vacía solo es válida con HTTP 200; cualquier fallo lanza un error tipado y nunca se convierte en una lista vacía.

## Secretos y repositorio

- `.env` ignorado por Git; `.env.example` solo placeholders.
- Prohibido subir `.env`, tokens MCP, perfiles de Claude locales, tokens Jira o credenciales personales.
- No copiar la configuración local de MCP a archivos de proyecto.
- Antes de futura entrega Railway, revisar gestión de secretos, backups, HTTPS, dominios, callbacks, CORS, políticas de registro y retención de datos.
