import initSqlJs from 'sql.js'
import { join } from 'path'
import fs from 'fs'
import { getDataDir } from './dataDir'

// 说明：项目在无本地编译器环境使用 SQL.js（WASM）实现 SQLite，产出单文件 archive.db，
// 数据目录整体可拷贝/备份。db.ts 通过一个兼容封装暴露与 better-sqlite3 相近的同步 API。

type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>
type SqlDatabase = InstanceType<SqlJsStatic['Database']>
type SqlStatement = InstanceType<SqlJsStatic['Statement']>

let SQL: SqlJsStatic | null = null
let sqlDb: SqlDatabase | null = null
let dbFilePath = ''
let inTransaction = false

/* ------------------------- sql.js 初始化（异步） ------------------------- */

export async function initDb(): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs()
  }
  const dir = getDataDir()
  dbFilePath = join(dir, 'archive.db')
  if (fs.existsSync(dbFilePath)) {
    const bytes = fs.readFileSync(dbFilePath)
    sqlDb = new SQL.Database(new Uint8Array(bytes))
  } else {
    sqlDb = new SQL.Database()
  }
  sqlDb.exec(SCHEMA)
  compat = new DbCompat(sqlDb)
  save()
}

export function closeDb(): void {
  if (sqlDb) {
    try {
      sqlDb.close()
    } catch {
      /* ignore */
    }
    sqlDb = null
  }
}

export async function reopenDb(): Promise<void> {
  closeDb()
  await initDb()
}

function save(): void {
  if (!sqlDb || inTransaction || !dbFilePath) return
  const data = sqlDb.export()
  fs.writeFileSync(dbFilePath, Buffer.from(data))
}

/* ------------------------- 参数规整 ------------------------- */

const NAMED_RE = /[:@$](\w+)/g

function normalize(sql: string, args: any[]): { sql: string; args: any[] } {
  if (args.length === 0) {
    return { sql, args: [] }
  }
  if (args.length === 1) {
    const only = args[0]
    if (Array.isArray(only)) {
      return { sql, args: only }
    }
    if (only && typeof only === 'object') {
      // 命名参数 -> 位置参数
      const out: any[] = []
      const replaced = sql.replace(NAMED_RE, (_m, key: string) => {
        out.push(only[key] === undefined ? null : only[key])
        return '?'
      })
      return { sql: replaced, args: out }
    }
  }
  return { sql, args }
}

/* ------------------------- Statement 兼容封装 ------------------------- */

class StatementCompat {
  private db: SqlDatabase
  private sql: string
  private stmt: SqlStatement | null = null

  constructor(db: SqlDatabase, sql: string) {
    this.db = db
    this.sql = sql
  }

  private bindArgs(...args: any[]): void {
    if (this.stmt) this.stmt.free()
    const { sql, args: bound } = normalize(this.sql, args)
    this.stmt = this.db.prepare(sql)
    if (bound.length) this.stmt.bind(bound)
  }

  get(...args: any[]): any {
    this.bindArgs(...args)
    if (!this.stmt) return undefined
    if (this.stmt.step()) {
      const obj = this.stmt.getAsObject()
      this.stmt.free()
      return obj
    }
    this.stmt.free()
    return undefined
  }

  all(...args: any[]): any[] {
    this.bindArgs(...args)
    const rows: any[] = []
    if (!this.stmt) return rows
    while (this.stmt.step()) {
      rows.push(this.stmt.getAsObject())
    }
    this.stmt.free()
    return rows
  }

  run(...args: any[]): { changes: number; lastInsertRowid: number } {
    this.bindArgs(...args)
    if (!this.stmt) return { changes: 0, lastInsertRowid: 0 }
    this.stmt.step()
    this.stmt.free()
    const changes = this.db.getRowsModified()
    let lastInsertRowid = 0
    try {
      const r = this.db.exec('select last_insert_rowid() as id')
      lastInsertRowid = Number(r[0]?.values[0]?.[0] ?? 0)
    } catch {
      /* ignore */
    }
    save()
    return { changes, lastInsertRowid }
  }
}

class DbCompat {
  private db: SqlDatabase

  constructor(db: SqlDatabase) {
    this.db = db
  }

  prepare(sql: string): StatementCompat {
    return new StatementCompat(this.db, sql)
  }

  exec(sql: string): void {
    this.db.exec(sql)
    save()
  }

  transaction<T>(fn: () => T): T {
    inTransaction = true
    try {
      this.db.exec('BEGIN')
      const result = fn()
      this.db.exec('COMMIT')
      inTransaction = false
      save()
      return result
    } catch (e) {
      inTransaction = false
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* ignore */
      }
      throw e
    }
  }

  pragma(sql: string): void {
    try {
      this.db.exec(sql)
    } catch {
      /* ignore */
    }
  }
}

/* ------------------------- 对外函数 ------------------------- */

let compat: DbCompat | null = null

export function getDb(): DbCompat {
  if (!sqlDb || !compat) {
    throw new Error('数据库尚未初始化')
  }
  return compat
}

export function db(): DbCompat {
  return getDb()
}

export function isDbReady(): boolean {
  return !!sqlDb && !!compat
}

/* ------------------------- 建库 Schema ------------------------- */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  wechat TEXT,
  gender TEXT,
  birthday TEXT,
  address TEXT,
  tags TEXT,
  source TEXT,
  note TEXT,
  avatar_path TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate_number TEXT UNIQUE,
  brand TEXT,
  model TEXT,
  year TEXT,
  color TEXT,
  vin TEXT UNIQUE,
  engine TEXT,
  transmission TEXT,
  displacement TEXT,
  drive_type TEXT,
  current_mileage INTEGER DEFAULT 0,
  last_maintenance_date TEXT,
  last_maintenance_km INTEGER,
  insurance_expire TEXT,
  inspection_expire TEXT,
  customer_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE TABLE IF NOT EXISTS work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE,
  type TEXT,
  status TEXT,
  customer_id INTEGER,
  vehicle_id INTEGER,
  shop_time TEXT,
  due_time TEXT,
  receptionist TEXT,
  technicians TEXT,
  to_shop_mileage INTEGER,
  fault_desc TEXT,
  note TEXT,
  priority TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  vehicle_plate TEXT,
  vehicle_info TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);
CREATE TABLE IF NOT EXISTS work_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  desc TEXT,
  labor_fee REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  actual_fee REAL,
  technician_id INTEGER,
  status TEXT,
  sort INTEGER DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES work_orders(id)
);
CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_no TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  model TEXT,
  spec TEXT,
  unit TEXT,
  purchase_price REAL DEFAULT 0,
  sale_price REAL DEFAULT 0,
  stock REAL DEFAULT 0,
  min_stock REAL DEFAULT 0,
  location TEXT,
  supplier_id INTEGER
);
CREATE TABLE IF NOT EXISTS work_order_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  item_id INTEGER,
  part_id INTEGER,
  part_name TEXT,
  qty REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  actual_fee REAL,
  FOREIGN KEY (order_id) REFERENCES work_orders(id),
  FOREIGN KEY (part_id) REFERENCES parts(id)
);
CREATE TABLE IF NOT EXISTS stock_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER,
  type TEXT,
  qty REAL,
  before_stock REAL,
  after_stock REAL,
  ref_no TEXT,
  operator_id INTEGER,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (part_id) REFERENCES parts(id)
);
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER,
  order_id INTEGER,
  item_id INTEGER,
  rel_path TEXT,
  thumb_path TEXT,
  stage TEXT,
  part TEXT,
  tags TEXT,
  note TEXT,
  taken_at TEXT,
  uploader TEXT
);
CREATE TABLE IF NOT EXISTS maintenance_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER UNIQUE,
  oil_brand TEXT,
  oil_model TEXT,
  oil_qty REAL,
  next_maintenance_at TEXT,
  next_maintenance_km INTEGER
);
CREATE TABLE IF NOT EXISTS repair_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER UNIQUE,
  fault_code TEXT,
  diagnosis TEXT,
  plan TEXT,
  result TEXT,
  result_note TEXT
);
CREATE TABLE IF NOT EXISTS modification_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER UNIQUE,
  proj_name TEXT,
  brand TEXT,
  model TEXT,
  serial TEXT,
  install_date TEXT,
  remove_date TEXT,
  status TEXT
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  vehicle_id INTEGER,
  date TEXT,
  time TEXT,
  duration TEXT,
  service_type TEXT,
  note TEXT,
  status TEXT
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  address TEXT,
  last_term TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS operators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  role TEXT
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  customer_id INTEGER,
  vehicle_id INTEGER,
  amount REAL DEFAULT 0,
  method TEXT,
  paid_at TEXT,
  operator TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (order_id) REFERENCES work_orders(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  customer_id INTEGER,
  vehicle_id INTEGER,
  rel_path TEXT NOT NULL,
  title TEXT,
  file_type TEXT,
  uploader TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (order_id) REFERENCES work_orders(id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_wo_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_wo_vehicle ON work_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_wo_created ON work_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_items_order ON work_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_parts_order ON work_order_parts(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_part ON stock_transactions(part_id);
CREATE INDEX IF NOT EXISTS idx_images_order ON images(order_id);
CREATE INDEX IF NOT EXISTS idx_images_vehicle ON images(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id);
`
