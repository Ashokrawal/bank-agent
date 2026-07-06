/**
 * lib/db/sqlite.ts
 * SQLite via sql.js (pure WASM — no native bindings needed)
 *
 * Singleton pattern:  one DB instance cached in Node global across
 * Next.js hot-reloads so we don't re-seed on every request in dev.
 *
 * Schema:  users · applications · loan_applications · appointments · credit_card_applications
 */

import fs from "fs";
import path from "path";
import { MOCK_USERS, MOCK_APPLICATIONS } from "@/data/mock-bank-data";

// ── Types ─────────────────────────────────────────────────────────────────────
type Row = Record<string, string | number | null>;
type SqlDb = import("sql.js").Database;

// Persist the DB file next to .next so it survives hot-reloads
const DB_PATH = path.join(process.cwd(), ".novabank-db.sqlite");

// ── Global singleton (survives Next.js hot-reload in dev) ─────────────────────
declare global {
  var __novabankDb: SqlDb | undefined;
}

// ── Schema migrations (safe to run on every startup) ─────────────────────────
function ensureSchema(db: SqlDb) {
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      email TEXT NOT NULL,
      advisor_type TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_time TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS credit_card_applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      email TEXT NOT NULL,
      card_type TEXT NOT NULL,
      annual_income REAL NOT NULL,
      employment_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

async function getDb(): Promise<SqlDb> {
  if (global.__novabankDb) return global.__novabankDb;

  // sql.js must be required, not statically imported, so webpack
  // can keep it as an external (avoids WASM bundling issues).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require("sql.js") as (
    opts?: object,
  ) => Promise<import("sql.js").SqlJsStatic>;

  const SQL = await initSqlJs();

  let db: SqlDb;
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
    ensureSchema(db);
    persist(db);
    console.log("📂 Loaded SQLite from", DB_PATH);
  } else {
    db = new SQL.Database();
    seedDatabase(db);
    ensureSchema(db); // seedDatabase doesn't create appointments/credit_card_applications
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
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY, user_id TEXT, email TEXT, name TEXT,
      type TEXT NOT NULL, status TEXT DEFAULT 'pending',
      documents TEXT, submitted_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT, notes TEXT
    );
    CREATE TABLE IF NOT EXISTS loan_applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      email TEXT NOT NULL,
      salary REAL NOT NULL,
      expenses REAL NOT NULL,
      deposit REAL NOT NULL,
      property_value REAL NOT NULL,
      employment_type TEXT NOT NULL,
      existing_debts REAL DEFAULT 0,
      loan_amount REAL NOT NULL,
      dti REAL NOT NULL,
      ltv REAL NOT NULL,
      answers TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      reviewed_by TEXT,
      submitted_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      ai_summary TEXT
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
      [
        u.id,
        u.email,
        u.password_hash,
        u.name,
        u.phone,
        u.address,
        u.ni_number,
        u.date_of_birth,
        u.kyc_status,
        u.created_at,
      ],
    );
  }

  for (const ap of MOCK_APPLICATIONS) {
    run(
      `INSERT OR IGNORE INTO applications
         (id,user_id,type,status,submitted_at,reviewed_at,notes)
       VALUES (?,?,?,?,?,?,?)`,
      [
        ap.id,
        ap.user_id,
        ap.type,
        ap.status,
        ap.submitted_at,
        ap.reviewed_at,
        ap.notes,
      ],
    );
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────
function toObjects(result: import("sql.js").QueryExecResult[]): Row[] {
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) =>
    Object.fromEntries(
      columns.map((c, i) => [c, row[i] as string | number | null]),
    ),
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

export async function createApplication(data: {
  id: string;
  email: string;
  name: string;
  type: string;
  documents?: string;
}) {
  await dbRun(
    `INSERT INTO applications (id,email,name,type,status,documents)
     VALUES (?,?,?,?,'pending',?)`,
    [data.id, data.email, data.name, data.type, data.documents ?? null],
  );
}

export async function updateApplicationStatus(
  id: string,
  status: string,
  notes?: string,
) {
  await dbRun(
    `UPDATE applications
     SET status=?, reviewed_at=datetime('now'), notes=?
     WHERE id=?`,
    [status, notes ?? null, id],
  );
}

// ── Loan applications ─────────────────────────────────────────────────────────

export async function createLoanApplication(data: {
  id: string;
  userId: string;
  userName: string;
  email: string;
  salary: number;
  expenses: number;
  deposit: number;
  propertyValue: number;
  employmentType: string;
  existingDebts: number;
  loanAmount: number;
  dti: number;
  ltv: number;
  answers: string; // JSON blob of raw Q&A
}) {
  await dbRun(
    `INSERT INTO loan_applications
       (id, user_id, user_name, email, salary, expenses, deposit,
        property_value, employment_type, existing_debts, loan_amount,
        dti, ltv, answers, status, submitted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',datetime('now'))`,
    [
      data.id,
      data.userId,
      data.userName,
      data.email,
      data.salary,
      data.expenses,
      data.deposit,
      data.propertyValue,
      data.employmentType,
      data.existingDebts,
      data.loanAmount,
      data.dti,
      data.ltv,
      data.answers,
    ],
  );
}

export async function getLoanApplications(status?: string, userId?: string) {
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];
  if (status) { conditions.push("status = ?"); params.push(status); }
  if (userId) { conditions.push("user_id = ?"); params.push(userId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return dbQuery(`SELECT * FROM loan_applications ${where} ORDER BY submitted_at DESC`, params);
}

export async function getLoanApplicationById(id: string) {
  const r = await dbQuery(`SELECT * FROM loan_applications WHERE id = ?`, [id]);
  return r[0] ?? null;
}

export async function updateLoanStatus(
  id: string,
  status: string,
  notes: string,
  reviewedBy: string,
) {
  await dbRun(
    `UPDATE loan_applications
     SET status = ?, notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
     WHERE id = ?`,
    [status, notes, reviewedBy, id],
  );
}

// ── Appointments ──────────────────────────────────────────────────────────────

export async function createAppointment(data: {
  id: string;
  userId: string;
  userName: string;
  email: string;
  advisorType: string;
  preferredDate: string;
  preferredTime: string;
  reason: string;
}) {
  await dbRun(
    `INSERT INTO appointments
       (id, user_id, user_name, email, advisor_type, preferred_date, preferred_time, reason)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      data.id,
      data.userId,
      data.userName,
      data.email,
      data.advisorType,
      data.preferredDate,
      data.preferredTime,
      data.reason,
    ],
  );
}

export async function getAppointments(status?: string, userId?: string) {
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];
  if (status) { conditions.push("status = ?"); params.push(status); }
  if (userId) { conditions.push("user_id = ?"); params.push(userId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return dbQuery(`SELECT * FROM appointments ${where} ORDER BY created_at DESC`, params);
}

// ── Credit card applications ───────────────────────────────────────────────────

export async function createCreditCardApplication(data: {
  id: string;
  userId: string;
  userName: string;
  email: string;
  cardType: string;
  annualIncome: number;
  employmentType: string;
}) {
  await dbRun(
    `INSERT INTO credit_card_applications
       (id, user_id, user_name, email, card_type, annual_income, employment_type)
     VALUES (?,?,?,?,?,?,?)`,
    [
      data.id,
      data.userId,
      data.userName,
      data.email,
      data.cardType,
      data.annualIncome,
      data.employmentType,
    ],
  );
}

export async function getCreditCardApplications(status?: string, userId?: string) {
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];
  if (status) { conditions.push("status = ?"); params.push(status); }
  if (userId) { conditions.push("user_id = ?"); params.push(userId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return dbQuery(`SELECT * FROM credit_card_applications ${where} ORDER BY created_at DESC`, params);
}
