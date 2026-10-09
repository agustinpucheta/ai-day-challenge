/**
 * Every user-facing string of the app, in Spanish (rioplatense, voseo). One plain typed object,
 * no i18n library: components and composables import from here so copy lives in one place.
 *
 * Kept in English on purpose: Epic, Story points, Track / Untrack, "Stories" (the Jira issue type),
 * "Jira", issue keys, status names and issue type names exactly as Jira returns them.
 */

/** "1 ítem" / "3 ítems": picks the singular only for exactly one. */
export function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}

/** Replaces `{name}` placeholders; an unknown placeholder is left untouched, never "undefined". */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export interface FailureText {
  title: string;
  text: string;
}

const retryInSeconds = (seconds: number): string =>
  fill('Se enviaron demasiados pedidos a Jira. Reintentá en {seconds} {unit}.', {
    seconds,
    unit: plural(seconds, 'segundo', 'segundos'),
  });

export const es = {
  app: { name: 'Jira Dashboard' },

  nav: {
    label: 'Principal',
    tracking: 'Mi seguimiento',
    issues: 'Issues',
    settings: 'Ajustes',
    signOut: 'Cerrar sesión',
    signingOut: 'Cerrando sesión…',
  },

  titles: {
    home: 'Mi seguimiento',
    issues: 'Issues',
    settings: 'Ajustes',
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
    unavailable: 'Servicio no disponible',
    notFound: 'Página no encontrada',
  },

  common: {
    retry: 'Reintentar',
    cancel: 'Cancelar',
    loading: 'Cargando…',
    refresh: 'Actualizar',
    refreshing: 'Actualizando…',
    openInJira: 'Abrir en Jira',
    jira: 'Jira',
    track: 'Track',
    untrack: 'Untrack',
    storyPoints: 'Story points',
    unexpected: 'Algo salió mal. Probá de nuevo.',
  },

  failure: {
    generic: {
      title: 'Algo salió mal',
      text: 'No se pudo completar la acción. Probá de nuevo.',
    } satisfies FailureText,
    issueNotFound: {
      title: 'Issue no encontrado o sin acceso',
      text: 'No existe, o la cuenta de Jira configurada no puede verlo.',
    } satisfies FailureText,
    issueNotFoundDetail: {
      title: 'Issue no encontrado o no tenés acceso',
      text: 'Revisá la clave. Si es correcta, la cuenta de Jira configurada no puede ver ese issue.',
    } satisfies FailureText,
    notConfigured: {
      title: 'Jira no está configurado',
      text: 'Definí JIRA_URL, JIRA_USERNAME y JIRA_API_TOKEN en el entorno del backend y reinicialo.',
    } satisfies FailureText,
    notConnected: {
      title: 'Jira no está conectado',
      text: 'El backend no tiene credenciales de Jira. Definí JIRA_URL, JIRA_USERNAME y JIRA_API_TOKEN y reiniciá el backend.',
    } satisfies FailureText,
    reauth: {
      title: 'Jira rechazó el token de API',
      text: 'Creá un token nuevo en id.atlassian.com → Seguridad → Tokens de API, actualizá JIRA_API_TOKEN y reiniciá el backend.',
    } satisfies FailureText,
    forbidden: {
      title: 'Jira denegó el acceso',
      text: 'La cuenta configurada no tiene permiso para leer estos datos. Revisá sus permisos en Jira.',
    } satisfies FailureText,
    rateLimitedTitle: 'Jira está limitando los pedidos',
    rateLimitedNoWait: 'Se enviaron demasiados pedidos a Jira. Probá de nuevo en un momento.',
    rateLimitedIn: retryInSeconds,
    unavailable: {
      title: 'Jira no está disponible',
      text: 'Jira no respondió correctamente. Suele ser algo temporal.',
    } satisfies FailureText,
    network: {
      title: 'No se pudo conectar con el servidor',
      text: 'Revisá tu conexión y que el backend esté en marcha.',
    } satisfies FailureText,
    trackingLimit: {
      title: 'Alcanzaste el límite de seguimiento',
      text: 'Podés seguir hasta 50 issues. Dejá de seguir uno para agregar otro.',
    } satisfies FailureText,
    sessionExpired: {
      title: 'Tu sesión expiró',
      text: 'Iniciá sesión de nuevo para continuar.',
    } satisfies FailureText,
    goToConnection: 'Ir al panel de conexión con Jira',
  },

  /** One-line message per backend or client error code, for forms and alerts. */
  errorByCode: {
    UNAUTHENTICATED: 'Tu sesión expiró. Iniciá sesión de nuevo.',
    INVALID_CREDENTIALS: 'El correo o la contraseña no son correctos.',
    VALIDATION_ERROR: 'Revisá los datos ingresados.',
    RATE_LIMITED: 'Hiciste demasiados intentos. Esperá un momento y probá de nuevo.',
    FORBIDDEN: 'No tenés permiso para hacer esto.',
    FORBIDDEN_ORIGIN: 'El origen del pedido no está permitido.',
    REGISTRATION_DISABLED: 'El registro está deshabilitado en este servidor.',
    EMAIL_ALREADY_REGISTERED: 'Ese correo ya está registrado.',
    NOT_FOUND: 'No se encontró lo que buscabas.',
    DATABASE_UNAVAILABLE: 'El servicio no está disponible por ahora. Probá de nuevo en un momento.',
    INTERNAL_ERROR: 'Ocurrió un error en el servidor. Probá de nuevo en un momento.',
    NETWORK_ERROR: 'No se pudo conectar con el servidor. Revisá tu conexión y probá de nuevo.',
    UNEXPECTED_RESPONSE: 'El servidor devolvió una respuesta inesperada.',
  } as Readonly<Record<string, string>>,

  progress: {
    counts: (completed: number, total: number): string =>
      fill('{completed} de {total} {unit}', {
        completed,
        total,
        unit: plural(total, 'terminado', 'terminados'),
      }),
    inProgress: (n: number): string => `${n} en curso`,
    pending: (n: number): string => `${n} ${plural(n, 'pendiente', 'pendientes')}`,
    cancelled: (n: number): string => `${n} ${plural(n, 'cancelado', 'cancelados')}`,
    available: (n: number): string => `${n} ${plural(n, 'disponible', 'disponibles')} para tomar`,
    unknown: (n: number): string => `${n} ${plural(n, 'ítem', 'ítems')} con estado desconocido`,
    allCancelled: 'Todos cancelados',
    noChildren: 'Todavía sin hijos',
    noSubtasks: 'Todavía sin subtareas',
    notApplicable: 'El avance no aplica',
    approximate: 'Avance aproximado',
    truncated: 'La lista de ítems se truncó, por eso estos números son aproximados.',
    label: (key: string): string => `Avance de ${key}`,
    heading: 'Avance',
  },

  states: {
    legendLabel: 'Leyenda de estados',
    done: 'Terminado',
    inProgress: 'En curso',
    pending: 'Pendiente',
    available: 'Disponible para tomar',
    cancelled: 'Cancelado',
    unknown: 'Estado desconocido',
  },

  badges: {
    available: 'Disponible',
    cancelled: 'Cancelado',
    availableCount: (n: number): string => `${n} ${plural(n, 'disponible', 'disponibles')}`,
    onlyAvailable: 'Solo disponibles',
    noAvailable: 'No hay ítems disponibles',
  },

  storyPoints: {
    planned: 'Planificados',
    final: 'Finales',
    finalConsumed: 'Finales (consumidos)',
    notEstimated: 'Sin estimar',
    deviation: (sign: '+' | '-', amount: number): string => `${sign}${amount} vs planificados`,
    epicNote: 'Los Story points se registran en las subtareas.',
  },

  table: {
    key: 'Clave',
    summary: 'Resumen',
    type: 'Tipo',
    status: 'Estado',
    progress: 'Avance',
    tracking: 'Seguimiento',
  },

  dates: {
    lastFetched: 'Última lectura',
    lastUpdated: 'Última actualización',
    lastChecked: 'Última verificación',
    readFromJira: (time: string): string => `Leído de Jira a las ${time}`,
  },

  tracking: {
    tracking: 'Siguiendo…',
    removing: 'Quitando…',
    confirmRemove: 'Sí, quitar',
    remove: 'Quitar',
    loadFailed: 'No se pudo cargar este issue',
    retrying: 'Reintentando…',
    retryItemHint: (key: string): string => ` carga de ${key}`,
    showStories: (n: number): string => `Ver stories (${n})`,
    hideStories: 'Ocultar stories',
    storiesOf: (key: string): string => ` de ${key}`,
    storiesCaption: (key: string): string => `Stories de ${key}`,
    loadingStories: 'Cargando stories…',
    loadingList: 'Cargando issues seguidos…',
    jiraUnreadable: 'No se muestra el avance de estos issues porque no se pudo leer Jira.',
    empty: {
      before: 'Todavía no seguís ningún issue.',
      link: 'Buscá un Epic o una Story',
      after: 'y presioná Track para seguir su avance acá.',
    },
  },

  search: {
    label: 'Buscar issues',
    labelDashboard: 'Buscar por texto o clave de issue',
    placeholder: 'Texto o clave de issue, p. ej. MASIN-123',
    submit: 'Buscar',
    idle: 'Buscá por texto o por clave de issue (por ejemplo MASIN-123).',
    searching: 'Buscando en Jira…',
    noResults: (query: string): string => `No se encontraron issues para “${query}”.`,
    caption: 'Resultados de la búsqueda',
    loaded: (n: number): string => `${n} ${plural(n, 'cargado', 'cargados')}`,
    loadMore: 'Cargar más',
    loadingMore: 'Cargando…',
    minLength: (min: number): string => `Ingresá al menos ${min} caracteres para buscar.`,
    maxLength: (max: number): string => `Usá como máximo ${max} caracteres.`,
    controlChars: 'La búsqueda no puede contener caracteres de control.',
  },

  detail: {
    back: '← Volver a la búsqueda',
    loading: 'Cargando issue…',
    parent: 'Padre:',
    stories: 'Stories',
    noChildren: 'Todavía sin hijos',
    subtasks: 'Subtareas',
    noSubtasks: 'No hay subtareas',
  },

  jira: {
    panelTitle: 'Conexión con Jira',
    loading: 'Cargando el estado de la conexión…',
    notConfigured: 'No configurado',
    notConfiguredBefore: 'El backend no tiene credenciales de Jira. Definí',
    notConfiguredAnd: 'y',
    notConfiguredMiddle: 'en el entorno o en el archivo',
    notConfiguredAfter: 'y reiniciá el backend.',
    checkAgain: 'Verificar de nuevo',
    configured: 'Configurado, sin verificar',
    site: 'Sitio:',
    verify: 'Verificar conexión',
    verifying: 'Verificando…',
    contacting: 'Contactando a Jira',
    contactingAt: 'en',
    connected: 'Conectado',
    connectedAt: 'en',
    verifyAgain: 'Verificar de nuevo',
    retryIn: (seconds: number): string =>
      `Reintentá en ${seconds} ${plural(seconds, 'segundo', 'segundos')}.`,
    errors: {
      reauth_required: {
        title: 'Jira rechazó el token de API',
        text: 'Creá un token nuevo en id.atlassian.com → Seguridad → Tokens de API, actualizá JIRA_API_TOKEN y reiniciá el backend.',
      },
      forbidden: {
        title: 'Jira denegó el acceso',
        text: 'La cuenta configurada no tiene permiso para leer este sitio de Jira. Revisá sus permisos en Jira.',
      },
      rate_limited: {
        title: 'Jira está limitando los pedidos',
        text: 'Se enviaron demasiados pedidos a Jira.',
      },
      unavailable: {
        title: 'Jira no está disponible',
        text: 'Jira no respondió correctamente. Suele ser algo temporal.',
      },
      network: {
        title: 'No se pudo conectar con el servidor',
        text: 'Revisá tu conexión y que el backend esté en marcha.',
      },
      unknown: {
        title: 'Algo salió mal',
        text: 'No se pudo verificar la conexión con Jira.',
      },
    },
  },

  auth: {
    email: 'Correo electrónico',
    password: 'Contraseña',
    signIn: 'Iniciar sesión',
    signingIn: 'Iniciando sesión…',
    accountCreated: 'Cuenta creada. Ya podés iniciar sesión.',
    noAccount: '¿Todavía no tenés cuenta?',
    createOne: 'Creá una',
    createAccount: 'Crear cuenta',
    creatingAccount: 'Creando cuenta…',
    displayName: 'Nombre para mostrar',
    optional: '(opcional)',
    passwordHint: (min: number): string => `Al menos ${min} caracteres.`,
    haveAccount: '¿Ya tenés una cuenta?',
    registrationDisabled: 'El registro está deshabilitado en este servidor.',
    askAdmin: 'Pedile una cuenta a un administrador e iniciá sesión.',
  },

  settings: {
    title: 'Ajustes',
    loading: 'Cargando preferencias…',
    heading: 'Preferencias del dashboard',
    weekStart: 'La semana empieza el',
    monday: 'Lunes',
    sunday: 'Domingo',
    timezone: 'Zona horaria',
    timezonePlaceholder: 'p. ej. America/Argentina/Buenos_Aires',
    timezoneHint: 'Zona horaria IANA. Dejala vacía para borrarla.',
    show: 'Mostrar en el dashboard',
    weeklySp: 'Story points semanales',
    subtasks: 'Subtareas',
    dependencies: 'Dependencias',
    saved: 'Preferencias guardadas.',
    saving: 'Guardando…',
    save: 'Guardar cambios',
  },

  pages: {
    notFound: 'Página no encontrada',
    notFoundText: 'La página que buscás no existe.',
    goHome: 'Ir a Mi seguimiento',
    unavailable: 'Servicio no disponible',
    unavailableText:
      'No se pudo verificar tu sesión porque el servidor no responde o devolvió un error.',
  },

  client: {
    network: 'No se pudo conectar con el servidor. Revisá tu conexión y probá de nuevo.',
    unexpectedHttp: (status: number): string =>
      `El servidor devolvió una respuesta inesperada (HTTP ${status}).`,
    unexpected: 'El servidor devolvió una respuesta inesperada.',
  },
} as const;
