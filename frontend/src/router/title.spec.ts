import { describe, expect, it } from 'vitest';
import { documentTitle } from './title';

describe('documentTitle', () => {
  it('titles each page in Spanish with the app name', () => {
    expect(documentTitle('home')).toBe('Mi seguimiento · Jira Dashboard');
    expect(documentTitle('settings')).toBe('Ajustes · Jira Dashboard');
    expect(documentTitle('login')).toBe('Iniciar sesión · Jira Dashboard');
    expect(documentTitle('not-found')).toBe('Página no encontrada · Jira Dashboard');
  });

  it('titles the issue detail by its key', () => {
    expect(documentTitle('issue', { key: 'MASIN-123' })).toBe('MASIN-123 · Jira Dashboard');
  });

  it('falls back to the app name for unknown routes', () => {
    expect(documentTitle(undefined)).toBe('Jira Dashboard');
  });
});
