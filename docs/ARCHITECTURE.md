# Arquitectura técnica

## 1. Principios

- Monolito modular NestJS: menos despliegues y puntos de fallo en el MVP.
- Vue y API claramente separadas mediante contratos HTTP tipados.
- Jira es la fuente de verdad de issues/estados/links; PostgreSQL contiene identidad, preferencias, conexión autorizada, auditoría mínima y, si resulta necesario, snapshots/cache.
- El acceso a Jira está encapsulado en `JiraGateway`; no llamar la API directamente desde controladores o componentes Vue.
- Los pipelines son explícitos y los cálculos de métricas deterministas.
- No se requiere un agente LLM ejecutándose en producción para el dashboard. Los subagents Claude Code se usan para construir y revisar el proyecto.

## 2. Stack

- Monorepo: pnpm workspaces.
- Web: Vue 3 + Vite + TypeScript + Vue Router. Añadir Pinia solo donde haga falta estado global.
- API: NestJS + TypeScript, REST JSON.
- DB: PostgreSQL en Docker Compose local.
- ORM y migraciones: Prisma.
- Auth local: sesión de servidor respaldada por PostgreSQL, password hashing Argon2id o biblioteca mantenida equivalente, cookie `HttpOnly`/`SameSite`; `Secure` depende del entorno.
- Jira: OAuth 2.0 de Atlassian de tres partes (3LO), con una única aplicación OAuth del proyecto y autorizaciones individuales por usuario.
- Validación: DTOs NestJS y esquemas runtime explícitos.

## 3. Estructura sugerida del monorepo

```text
jira-dashboard/
├── apps/
│   ├── web/                     # Vue 3 + Vite
│   └── api/                     # NestJS
├── packages/
│   └── contracts/               # tipos y esquemas compartidos donde sea práctico
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── infrastructure/
│   └── docker-compose.yml
├── docs/
├── .claude/
│   ├── agents/
│   └── skills/                  # solo skills validadas/activas
├── .env.example
├── pnpm-workspace.yaml
└── CLAUDE.md
```

## 4. Módulos NestJS

- `AuthModule`: registro/login/logout, sesión, `GET /auth/me`.
- `UsersModule`: perfil actual, gestión de datos propios.
- `JiraOAuthModule`: inicio de autorización, callback, intercambio de código, recursos accesibles, refresh rotatorio y desconexión.
- `JiraConnectionsModule`: conexión(es) de cada usuario al cloud/site autorizado, estado y scopes.
- `JiraModule`: `JiraGateway`, DTOs/normalizadores Jira y errores del proveedor.
- `DashboardModule`: búsqueda y vista de detalle del issue, respuesta agregada para frontend.
- `MetricsModule`: avance, subtareas, throughput SP semanal.
- `DependenciesModule`: normalización de `blocks` / `is blocked by`.
- `PreferencesModule`: configuración, issues seguidos y vistas guardadas.
- `AuditModule`: eventos de autenticación relevantes, conexiones y transiciones (sin secretos ni cuerpos sensibles innecesarios).
- `HealthModule`: salud de app/DB sin incluir secretos.

No crear un módulo de orquestación genérico complejo. Dentro del MVP, los pipelines pueden ser servicios de aplicación con pasos claros, resultados tipados, tiempos y errores controlados.

## 5. Interfaz JiraGateway

Contrato conceptual (ajustar al cliente elegido y al REST de Jira vigente):

```ts
interface JiraGateway {
  listAccessibleSites(userId: string): Promise<JiraSite[]>;
  searchIssues(userId: string, query: JiraIssueSearch): Promise<JiraIssuePage>;
  getIssue(userId: string, issueKey: string): Promise<JiraIssue>;
  getIssueChangelog(userId: string, issueId: string): Promise<JiraChangelogPage>;
  getIssueTransitions(userId: string, issueKey: string): Promise<JiraTransition[]>;
  transitionIssue(userId: string, issueKey: string, transitionId: string): Promise<void>;
}
```

La interfaz no debe permitir que el caller pase una access token cualquiera. El adaptador resuelve la conexión usando el usuario autenticado y el sitio autorizado. Los tipos internos normalizan las variaciones del REST de Jira sin perder `issueKey`, `issueId`, `cloudId`, URL, status category, estimación, parent, subtasks y issue links.

## 6. Cliente HTTP y base URL

- Para Jira Cloud OAuth 3LO, descubrir sitios autorizados y su `cloudId` tras el callback.
- Ejecutar las REST API con el esquema de URL de Atlassian para el `cloudId`; no asumir que el dominio del sitio puede reemplazar cualquier URL de API.
- Implementar paginación, rate limits, reintentos con backoff para errores transitorios, timeout y mensajes de error sanitizados.
- No usar JQL generado directamente a partir de texto sin validación/escape. Preferir consultas parametrizadas o construir la sintaxis de forma segura.

## 7. Caché e histórico

- Primero implementar consulta bajo demanda con TTL simple y metadatos de última actualización.
- Cache keys deben incluir al menos usuario/conexión y issue/scope de consulta cuando el resultado depende de permisos.
- No reutilizar datos entre usuarios simplemente porque comparten `cloudId`.
- Para SP por semana, usar changelog de Jira. Persistir un agregado/snapshot solo si reduce coste y sin suponer que un snapshot actual reconstruye el pasado.
- No guardar un clon completo de Jira en PostgreSQL.

## 8. Entorno local

- PostgreSQL mediante Docker Compose.
- El usuario ejecuta web y API en modo desarrollo.
- La callback OAuth de Atlassian debe coincidir exactamente con la registrada en Developer Console; verificar requisitos actuales de URL para localhost durante configuración.
- Configurar secretos por `.env` ignorado por Git. Versionar solo `.env.example` con placeholders.
- No incluir Microsoft en la primera entrega, pero mantener el user ID interno estable para admitir identidad externa después.
