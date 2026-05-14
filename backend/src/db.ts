import initSqlJs, { Database } from "sql.js";
import * as fs from "fs";
import * as path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../binwatch.db");
let db: Database;

export const initDb = async (): Promise<void> => {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log("Database loaded from", DB_PATH);
  } else {
    db = new SQL.Database();
    console.log("New database created:", DB_PATH);
  }
  createTables();
};

const save = (): void => fs.writeFileSync(DB_PATH, Buffer.from(db.export()));

const SQL_CREATE = [
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'driver', created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS readings (id TEXT PRIMARY KEY, distance REAL NOT NULL, fill_percent REAL NOT NULL, status TEXT NOT NULL, timestamp TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, scheduled_for TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fill_percent_at_creation REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '')",
  "CREATE TABLE IF NOT EXISTS alert_config (id INTEGER PRIMARY KEY DEFAULT 1, email TEXT NOT NULL DEFAULT '', critical_threshold REAL NOT NULL DEFAULT 8, close_threshold REAL NOT NULL DEFAULT 15, enabled INTEGER NOT NULL DEFAULT 0, bin_depth_cm REAL NOT NULL DEFAULT 50)",
  "INSERT OR IGNORE INTO alert_config (id) VALUES (1)"
];

const createTables = (): void => {
  SQL_CREATE.forEach(sql => db.run(sql));
  save();
};

// USERS
export const dbGetUser = (username: string) => {
  const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
  stmt.bind([username]);
  if (stmt.step()) { const r = stmt.getAsObject() as any; stmt.free(); return { id: r.id, username: r.username, email: r.email, passwordHash: r.password_hash, role: r.role, createdAt: new Date(r.created_at) }; }
  stmt.free(); return null;
};

export const dbCreateUser = (u: { id: string; username: string; email: string; passwordHash: string; role: string; createdAt: Date }): void => {
  db.run("INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)", [u.id, u.username, u.email, u.passwordHash, u.role, u.createdAt.toISOString()]);
  save();
};

// READINGS
export const dbInsertReading = (r: { id: string; distance: number; fillPercent: number; status: string; timestamp: Date }): void => {
  db.run("INSERT INTO readings (id, distance, fill_percent, status, timestamp) VALUES (?, ?, ?, ?, ?)", [r.id, r.distance, r.fillPercent, r.status, r.timestamp.toISOString()]);
  db.run("DELETE FROM readings WHERE id NOT IN (SELECT id FROM readings ORDER BY timestamp DESC LIMIT 500)");
  save();
};

export const dbGetReadings = (limit = 100) => {
  const stmt = db.prepare("SELECT * FROM readings ORDER BY timestamp DESC LIMIT ?");
  stmt.bind([limit]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.map(r => ({ id: r.id, distance: r.distance, fillPercent: r.fill_percent, status: r.status, timestamp: new Date(r.timestamp as string) }));
};

// SCHEDULES
export const dbGetSchedules = () => {
  const stmt = db.prepare("SELECT * FROM schedules ORDER BY scheduled_for ASC");
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.map(r => ({ id: r.id, createdAt: new Date(r.created_at as string), scheduledFor: new Date(r.scheduled_for as string), status: r.status, fillPercentAtCreation: r.fill_percent_at_creation, notes: r.notes }));
};

export const dbInsertSchedule = (s: { id: string; createdAt: Date; scheduledFor: Date; status: string; fillPercentAtCreation: number; notes: string }): void => {
  db.run("INSERT INTO schedules (id, created_at, scheduled_for, status, fill_percent_at_creation, notes) VALUES (?, ?, ?, ?, ?, ?)", [s.id, s.createdAt.toISOString(), s.scheduledFor.toISOString(), s.status, s.fillPercentAtCreation, s.notes]);
  save();
};

export const dbUpdateSchedule = (id: string, fields: { status?: string; scheduledFor?: Date; notes?: string }): boolean => {
  const parts: string[] = [];
  const vals: any[] = [];
  if (fields.status) { parts.push("status = ?"); vals.push(fields.status); }
  if (fields.scheduledFor) { parts.push("scheduled_for = ?"); vals.push(fields.scheduledFor.toISOString()); }
  if (fields.notes) { parts.push("notes = ?"); vals.push(fields.notes); }
  if (!parts.length) return false;
  vals.push(id);
  db.run("UPDATE schedules SET " + parts.join(", ") + " WHERE id = ?", vals);
  save();
  return true;
};

export const dbDeleteSchedule = (id: string): void => { db.run("DELETE FROM schedules WHERE id = ?", [id]); save(); };

export const dbHasPendingSchedule = (): boolean => {
  const stmt = db.prepare("SELECT COUNT(*) as cnt FROM schedules WHERE status IN ('pending', 'confirmed')");
  stmt.step();
  const r = stmt.getAsObject() as any;
  stmt.free();
  return (r.cnt as number) > 0;
};

// ALERT CONFIG
export const dbGetAlertConfig = () => {
  const stmt = db.prepare("SELECT * FROM alert_config WHERE id = 1");
  stmt.step();
  const r = stmt.getAsObject() as any;
  stmt.free();
  return { email: r.email as string, criticalThreshold: r.critical_threshold as number, closeThreshold: r.close_threshold as number, enabled: r.enabled === 1, binDepthCm: r.bin_depth_cm as number };
};

export const dbSetAlertConfig = (cfg: { email?: string; criticalThreshold?: number; closeThreshold?: number; enabled?: boolean; binDepthCm?: number }): void => {
  db.run("UPDATE alert_config SET email = COALESCE(?, email), critical_threshold = COALESCE(?, critical_threshold), close_threshold = COALESCE(?, close_threshold), enabled = COALESCE(?, enabled), bin_depth_cm = COALESCE(?, bin_depth_cm) WHERE id = 1",
    [cfg.email ?? null, cfg.criticalThreshold ?? null, cfg.closeThreshold ?? null, cfg.enabled !== undefined ? (cfg.enabled ? 1 : 0) : null, cfg.binDepthCm ?? null]);
  save();
};