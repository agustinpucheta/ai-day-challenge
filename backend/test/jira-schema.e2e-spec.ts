import { Client } from 'pg';

/** Verifies the Phase 2 migration (jira_connections, oauth_states) against the *_test database. */
describe('Jira OAuth schema (migration)', () => {
  let db: Client;

  const createUser = async (): Promise<string> => {
    const email = `schema-${Math.random().toString(36).slice(2)}@example.com`;
    const result = await db.query<{ id: string }>(
      'INSERT INTO users (id, email_normalized, updated_at) VALUES (gen_random_uuid(), $1, now()) RETURNING id',
      [email],
    );
    return result.rows[0]!.id;
  };

  const insertConnection = (userId: string, cloudId: string) =>
    db.query<{ id: string }>(
      `INSERT INTO jira_connections
         (id, user_id, cloud_id, site_url, site_name, access_token_ciphertext,
          refresh_token_ciphertext, access_token_expires_at, granted_scopes,
          encryption_key_version, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'https://x.atlassian.net', 'X', 'v1.1.a.b.c',
               'v1.1.a.b.c', now(), ARRAY['read:jira-work'], 1, now())
       RETURNING id`,
      [userId, cloudId],
    );

  beforeAll(async () => {
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  it('enforces one connection per user and cloud, defaulting to active', async () => {
    const userId = await createUser();
    await insertConnection(userId, 'cloud-1');
    await expect(insertConnection(userId, 'cloud-1')).rejects.toMatchObject({ code: '23505' });
    await insertConnection(userId, 'cloud-2');
    const status = await db.query(
      'SELECT DISTINCT status::text FROM jira_connections WHERE user_id = $1',
      [userId],
    );
    expect(status.rows).toEqual([{ status: 'active' }]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  it('cascades connections and OAuth states when the user is deleted', async () => {
    const userId = await createUser();
    await insertConnection(userId, 'cloud-1');
    await db.query(
      `INSERT INTO oauth_states (id, state_hash, user_id, session_id, expires_at)
       VALUES (gen_random_uuid(), $1, $2, 'sid', now() + interval '10 minutes')`,
      [`hash-${userId}`, userId],
    );
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    const connections = await db.query('SELECT 1 FROM jira_connections WHERE user_id = $1', [
      userId,
    ]);
    const states = await db.query('SELECT 1 FROM oauth_states WHERE user_id = $1', [userId]);
    expect(connections.rowCount).toBe(0);
    expect(states.rowCount).toBe(0);
  });

  it('keeps the state hash unique and nulls audit_events.connection_id on connection delete', async () => {
    const userId = await createUser();
    const insertState = () =>
      db.query(
        `INSERT INTO oauth_states (id, state_hash, user_id, session_id, expires_at)
         VALUES (gen_random_uuid(), $1, $2, 'sid', now())`,
        [`dup-${userId}`, userId],
      );
    await insertState();
    await expect(insertState()).rejects.toMatchObject({ code: '23505' });

    const connectionId = (await insertConnection(userId, 'cloud-1')).rows[0]!.id;
    const audit = await db.query<{ id: string }>(
      `INSERT INTO audit_events (id, connection_id, event_type, success)
       VALUES (gen_random_uuid(), $1, 'jira.connect', true) RETURNING id`,
      [connectionId],
    );
    await db.query('DELETE FROM jira_connections WHERE id = $1', [connectionId]);
    const after = await db.query('SELECT connection_id FROM audit_events WHERE id = $1', [
      audit.rows[0]!.id,
    ]);
    expect(after.rows).toEqual([{ connection_id: null }]);
    await db.query('DELETE FROM audit_events WHERE id = $1', [audit.rows[0]!.id]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  });
});
