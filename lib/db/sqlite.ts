/**
 * lib/db/sqlite.ts
 * SQLite via sql.js (pure WASM — no native bindings needed)
 *
 * Singleton pattern:  one DB instance cached in Node global across
 * Next.js hot-reloads so we don't re-seed on every request in dev.
 *
 * Schema:  users · accounts · transactions · applications
 */

import fs   from "fs";
import path from "path";
import {
  MOCK_USERS, MOCK_ACCOUNTS, MOCK_TRANSACTIONS, MOCK_APPLICATIONS,
} from "@/data/mock-bank-data";

// ── Types ─────────────────────────────────────────────────────────────────────
type Row   = Record<string, string | number | null>;
type SqlDb = import("sql.js").Database;

// Persist the DB file next to .next so it survives hot-reloads
const DB_PATH = path.join(process.cwd(), ".novabank-db.sqlite");

// ── Global singleton (survives Next.js hot-reload in dev) ─────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __novabankDb: SqlDb | undefined;
}

async function getDb(): Promise<SqlDb> {
  if (global.__novabankDb) return global.__novabankDb;

  // sql.js must be required, not statically imported, so webpack
  // can keep it as an external (avoids WASM bundling issues).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require("sql.js") as (opts?: object) => Promise<import("sql.js").SqlJsStatic>;

  const SQL = await initSqlJs();

  let db: SqlDb;
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
    console.log("📂 Loaded SQLite from", DB_PATH);
  } else {
    db = new SQL.Database();
    seedDatabase(db);
    persist(db);
    console.log("✅ SQLite seeded with mock data →", DB_PATH);
  }

  global.__novabankDb = db;
  return db;
}

function persist(db: SqlDb) {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.warn("DB persist warning:", e);
  }
}

// ── Schema + seed ─────────────────────────────────────────────────────────────
function seedDatabase(db: SqlDb) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, name TEXT NOT NULL,
      phone TEXT, address TEXT, ni_number TEXT,
      date_of_birth TEXT, kyc_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      account_number TEXT UNIQUE NOT NULL, sort_code TEXT NOT NULL,
      type TEXT NOT NULL, name TEXT NOT NULL,
      balance REAL DEFAULT 0, currency TEXT DEFAULT 'GBP',
      status TEXT DEFAULT 'active',
      opened_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL,
      date TEXT NOT NULL, description TEXT NOT NULL,
      amount REAL NOT NULL, type TEXT NOT NULL,
      category TEXT, balance_after REAL,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY, user_id TEXT, email TEXT, name TEXT,
      type TEXT NOT NULL, status TEXT DEFAULT 'pending',
      documents TEXT, submitted_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT, notes TEXT
    );
  `);

  const run = (sql: string, params: (string | number | null)[]) => {
    const stmt = db.prepare(sql);
    stmt.run(params);
    stmt.free();
  };

  for (const u of MOCK_USERS) {
    run(
      `INSERT OR IGNORE INTO users
         (id,email,password_hash,name,phone,address,ni_number,date_of_birth,kyc_status,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [u.id, u.email, u.password_hash, u.name, u.phone, u.address,
       u.ni_number, u.date_of_birth, u.kyc_status, u.created_at],
    );
  }

  for (const a of MOCK_ACCOUNTS) {
    run(
      `INSERT OR IGNORE INTO accounts
         (id,user_id,account_number,sort_code,type,name,balance,currency,status,opened_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [a.id, a.user_id, a.account_number, a.sort_code, a.type, a.name,
       a.balance, a.currency, a.status, a.opened_at],
    );
  }

  for (const t of MOCK_TRANSACTIONS) {
    run(
      `INSERT OR IGNORE INTO transactions
         (id,account_id,date,description,amount,type,category,balance_after)
       VALUES (?,?,?,?,?,?,?,?)`,
      [t.id, t.account_id, t.date, t.description, t.amount,
       t.type, t.category, t.balance_after],
    );
  }

  for (const ap of MOCK_APPLICATIONS) {
    run(
      `INSERT OR IGNORE INTO applications
         (id,user_id,type,status,submitted_at,reviewed_at,notes)
       VALUES (?,?,?,?,?,?,?)`,
      [ap.id, ap.user_id, ap.type, ap.status,
       ap.submitted_at, ap.reviewed_at, ap.notes],
    );
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────
function toObjects(result: import("sql.js").QueryExecResult[]): Row[] {
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((c, i) => [c, row[i] as string | number | null])),
  );
}

export async function dbQuery(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<Row[]> {
  const db = await getDb();
  return toObjects(db.exec(sql, params));
}

export async function dbRun(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<void> {
  const db = await getDb();
  db.run(sql, params);
  persist(db);
}

// ── Domain queries ────────────────────────────────────────────────────────────
export async function getUserByEmail(email: string) {
  const r = await dbQuery("SELECT * FROM users WHERE email = ?", [email]);
  return r[0] ?? null;
}

export async function getUserById(id: string) {
  const r = await dbQuery("SELECT * FROM users WHERE id = ?", [id]);
  return r[0] ?? null;
}

export async function getAccountsByUserId(userId: string) {
  return dbQuery(
    "SELECT * FROM accounts WHERE user_id = ? AND status = 'active' ORDER BY opened_at",
    [userId],
  );
}

export async function getTransactions(
  accountId: string,
  fromDate?: string,
  toDate?: string,
) {
  let sql    = "SELECT * FROM transactions WHERE account_id = ?";
  const p: (string | number | null)[] = [accountId];

  if (fromDate) { sql += " AND date >= ?"; p.push(fromDate); }
  if (toDate)   { sql += " AND date <= ?"; p.push(toDate);   }
  sql += " ORDER BY date DESC LIMIT 100";

  return dbQuery(sql, p);
}

export async function createApplication(data: {
  id: string; email: string; name: string; type: string; documents?: string;
}) {
  await dbRun(
    `INSERT INTO applications (id,email,name,type,status,documents)
     VALUES (?,?,?,?,'pending',?)`,
    [data.id, data.email, data.name, data.type, data.documents ?? null],
  );
}

export async function updateApplicationStatus(
  id: string, status: string, notes?: string,
) {
  await dbRun(
    `UPDATE applications
     SET status=?, reviewed_at=datetime('now'), notes=?
     WHERE id=?`,
    [status, notes ?? null, id],
  );
}
