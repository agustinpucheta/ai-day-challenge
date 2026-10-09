import { es } from '@/i18n/es';

const TITLES: Readonly<Record<string, string>> = {
  home: es.titles.home,
  issues: es.titles.issues,
  settings: es.titles.settings,
  login: es.titles.login,
  register: es.titles.register,
  unavailable: es.titles.unavailable,
  'not-found': es.titles.notFound,
};

/** "Mi seguimiento · Jira Dashboard"; the issue detail page is titled by its key. */
export function documentTitle(
  routeName: unknown,
  params: Readonly<Record<string, unknown>> = {},
): string {
  const page =
    routeName === 'issue' && typeof params.key === 'string'
      ? params.key
      : TITLES[String(routeName)];
  return page ? `${page} · ${es.app.name}` : es.app.name;
}
