import { createRequire } from 'node:module';

// Loaded this way so test tools that do not know the built-in node:sqlite module leave it alone.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

/**
 * A small SQLite database in one file. It holds accounts, sign-in links and monthly usage.
 * Photos and analyses are never stored here: the analysis text stays in the person's browser.
 */
export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      stripe_customer TEXT,
      stripe_subscription TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_tokens (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS usage (
      user_id INTEGER NOT NULL REFERENCES users(id),
      month TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, month)
    );
  `);

  const q = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userByCustomer: db.prepare('SELECT * FROM users WHERE stripe_customer = ?'),
    insertUser: db.prepare('INSERT INTO users (email, created_at) VALUES (?, ?)'),
    setPlan: db.prepare('UPDATE users SET plan = ?, stripe_customer = COALESCE(?, stripe_customer), stripe_subscription = ? WHERE id = ?'),
    insertToken: db.prepare('INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)'),
    token: db.prepare('SELECT * FROM login_tokens WHERE token_hash = ?'),
    useToken: db.prepare('UPDATE login_tokens SET used = 1 WHERE token_hash = ? AND used = 0'),
    dropOldTokens: db.prepare('DELETE FROM login_tokens WHERE expires_at < ?'),
    usage: db.prepare('SELECT count FROM usage WHERE user_id = ? AND month = ?'),
    addUsage: db.prepare(`INSERT INTO usage (user_id, month, count) VALUES (?, ?, 1)
      ON CONFLICT (user_id, month) DO UPDATE SET count = count + 1`),
  };

  return {
    raw: db,
    userById: (id) => q.userById.get(id) ?? null,
    userByEmail: (email) => q.userByEmail.get(email) ?? null,
    userByCustomer: (customer) => q.userByCustomer.get(customer) ?? null,
    findOrCreateUser(email, now) {
      const found = q.userByEmail.get(email);
      if (found) return found;
      q.insertUser.run(email, now);
      return q.userByEmail.get(email);
    },
    setPlan(userId, plan, customer = null, subscription = null) {
      q.setPlan.run(plan, customer, subscription, userId);
    },
    saveToken(hash, email, expiresAt) {
      q.insertToken.run(hash, email, expiresAt);
    },
    /** Marks a sign-in link used. Returns its email, or null if unknown, used or expired. */
    consumeToken(hash, now) {
      const row = q.token.get(hash);
      if (!row || row.used || row.expires_at < now) return null;
      const res = q.useToken.run(hash);
      if (res.changes !== 1) return null;
      q.dropOldTokens.run(now);
      return row.email;
    },
    usage: (userId, month) => q.usage.get(userId, month)?.count ?? 0,
    addUsage: (userId, month) => q.addUsage.run(userId, month),
    close: () => db.close(),
  };
}
