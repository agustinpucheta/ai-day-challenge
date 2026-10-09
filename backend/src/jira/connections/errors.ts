/**
 * Typed Jira connection failures. Messages are fixed strings: they never carry tokens,
 * ciphertext, authorization codes or remote response bodies.
 */

/** The connection does not exist or belongs to another user (indistinguishable on purpose). */
export class ConnectionNotFoundError extends Error {
  constructor() {
    super('Jira connection not found');
    this.name = 'ConnectionNotFoundError';
  }
}

/** The stored credentials are unusable; the user must authorize the app again. */
export class ReauthorizationRequiredError extends Error {
  constructor() {
    super('Jira connection requires reauthorization');
    this.name = 'ReauthorizationRequiredError';
  }
}

export interface SiteCandidate {
  cloudId: string;
  name: string;
  url: string;
}

/** The authorization granted several sites and none was preselected. */
export class MultipleSitesError extends Error {
  constructor(readonly candidates: SiteCandidate[]) {
    super('Several Jira sites were authorized; one must be selected');
    this.name = 'MultipleSitesError';
  }
}

/** The authorization did not grant access to any Jira site. */
export class NoAccessibleSiteError extends Error {
  constructor() {
    super('The authorization grants access to no Jira site');
    this.name = 'NoAccessibleSiteError';
  }
}
