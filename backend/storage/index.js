import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'wellchess_db.json');

// Re-export operators
export function eq(column, value) {
  const colName = column ? (column._name || column) : 'id';
  return { op: 'eq', col: colName, val: value };
}

export function ne(column, value) {
  const colName = column ? (column._name || column) : 'id';
  return { op: 'ne', col: colName, val: value };
}

export function gt(column, value) {
  const colName = column ? (column._name || column) : 'id';
  return { op: 'gt', col: colName, val: value };
}

export function gte(column, value) {
  const colName = column ? (column._name || column) : 'id';
  return { op: 'gte', col: colName, val: value };
}

export function lt(column, value) {
  const colName = column ? (column._name || column) : 'id';
  return { op: 'lt', col: colName, val: value };
}

export function lte(column, value) {
  const colName = column ? (column._name || column) : 'id';
  return { op: 'lte', col: colName, val: value };
}

export function and(...conditions) {
  return { op: 'and', conditions: conditions.filter(Boolean) };
}

export function or(...conditions) {
  return { op: 'or', conditions: conditions.filter(Boolean) };
}

export function desc(column) {
  const colName = column ? (column._name || column) : 'id';
  return { dir: 'desc', col: colName };
}

export function asc(column) {
  const colName = column ? (column._name || column) : 'id';
  return { dir: 'asc', col: colName };
}

export function sql(strings, ...values) {
  return { _sql: strings, _values: values };
}

/**
 * Embedded persistent storage engine conforming to Telegram Serverless db API
 */
class PersistentDatabase {
  constructor(filePath = DB_FILE) {
    this.filePath = filePath;
    this.cache = {
      users: [],
      games: [],
      moves: [],
      matchmaking_queue: [],
      rating_history: []
    };
    this.init();
  }

  init() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        if (raw.trim()) {
          this.cache = JSON.parse(raw);
        }
      } else {
        this.persist();
      }
    } catch (err) {
      console.warn('[DB] Failed to load persistent file, initializing empty cache:', err.message);
    }
  }

  persist() {
    try {
      const tempPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.cache, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch {
      // Direct write fallback
      fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8');
    }
  }

  getTable(tableName) {
    if (!this.cache[tableName]) {
      this.cache[tableName] = [];
    }
    return this.cache[tableName];
  }

  getRowVal(row, colName) {
    if (!row || !colName || typeof colName !== 'string') return undefined;
    if (row[colName] !== undefined) return row[colName];
    const camel = colName.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    if (row[camel] !== undefined) return row[camel];
    const snake = colName.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
    if (row[snake] !== undefined) return row[snake];
    return undefined;
  }

  matchCondition(row, cond) {
    if (!cond) return true;
    if (cond.op === 'and') return cond.conditions.every(c => this.matchCondition(row, c));
    if (cond.op === 'or') return cond.conditions.some(c => this.matchCondition(row, c));
    const val = this.getRowVal(row, cond.col);
    if (cond.op === 'eq') return val === cond.val;
    if (cond.op === 'ne') return val !== cond.val;
    if (cond.op === 'gt') return val > cond.val;
    if (cond.op === 'gte') return val >= cond.val;
    if (cond.op === 'lt') return val < cond.val;
    if (cond.op === 'lte') return val <= cond.val;
    return true;
  }

  select() {
    const self = this;
    let targetTable = null;
    let condition = null;
    let orderRule = null;
    let limitCount = null;

    const builder = {
      from(table) {
        targetTable = table._tableName || table;
        return builder;
      },
      where(cond) {
        condition = cond;
        return builder;
      },
      orderBy(rule) {
        orderRule = rule;
        return builder;
      },
      limit(n) {
        limitCount = n;
        return builder;
      },
      async all() {
        const rows = self.getTable(targetTable);
        let result = rows.filter(r => self.matchCondition(r, condition));

        if (orderRule) {
          result.sort((a, b) => {
            const valA = self.getRowVal(a, orderRule.col);
            const valB = self.getRowVal(b, orderRule.col);
            if (valA < valB) return orderRule.dir === 'desc' ? 1 : -1;
            if (valA > valB) return orderRule.dir === 'desc' ? -1 : 1;
            return 0;
          });
        }

        if (limitCount !== null) {
          result = result.slice(0, limitCount);
        }

        return structuredClone(result);
      },
      async get() {
        const rows = await builder.all();
        return rows[0] || null;
      }
    };

    return builder;
  }

  insert(table) {
    const self = this;
    const targetTable = table._tableName || table;
    let insertValues = null;
    let conflictClause = null;

    const builder = {
      values(vals) {
        insertValues = vals;
        return builder;
      },
      onConflictDoUpdate(clause) {
        conflictClause = clause;
        return builder;
      },
      returning() {
        return builder;
      },
      async run() {
        const rows = self.getTable(targetTable);
        const toInsert = Array.isArray(insertValues) ? insertValues : [insertValues];
        const insertedRows = [];

        for (const item of toInsert) {
          const row = { ...item };
          const primaryKeyCol = table._columns
            ? Object.entries(table._columns).find(([, col]) => col.primaryKey)?.[1]?._name || 'id'
            : 'id';

          const existingIdx = rows.findIndex(r => {
            const valR = self.getRowVal(r, primaryKeyCol);
            const valRow = self.getRowVal(row, primaryKeyCol);
            return valR !== undefined && valRow !== undefined && valR === valRow;
          });

          if (existingIdx !== -1) {
            if (conflictClause && conflictClause.set) {
              const updated = { ...rows[existingIdx], ...conflictClause.set };
              rows[existingIdx] = updated;
              insertedRows.push(updated);
            } else {
              // Ignore or replace
              rows[existingIdx] = row;
              insertedRows.push(row);
            }
          } else {
            rows.push(row);
            insertedRows.push(row);
          }
        }

        self.persist();
        return insertedRows;
      }
    };

    return builder;
  }

  update(table) {
    const self = this;
    const targetTable = table._tableName || table;
    let updateFields = null;
    let condition = null;

    const builder = {
      set(fields) {
        updateFields = fields;
        return builder;
      },
      where(cond) {
        condition = cond;
        return builder;
      },
      async run() {
        const rows = self.getTable(targetTable);
        let updatedCount = 0;

        for (let i = 0; i < rows.length; i++) {
          if (self.matchCondition(rows[i], condition)) {
            rows[i] = { ...rows[i], ...updateFields };
            updatedCount++;
          }
        }

        if (updatedCount > 0) {
          self.persist();
        }
        return { changes: updatedCount };
      }
    };

    return builder;
  }

  delete(table) {
    const self = this;
    const targetTable = table._tableName || table;
    let condition = null;

    const builder = {
      where(cond) {
        condition = cond;
        return builder;
      },
      async run() {
        const rows = self.getTable(targetTable);
        const originalLength = rows.length;
        const remaining = rows.filter(r => !self.matchCondition(r, condition));
        self.cache[targetTable] = remaining;

        const deletedCount = originalLength - remaining.length;
        if (deletedCount > 0) {
          self.persist();
        }
        return { changes: deletedCount };
      }
    };

    return builder;
  }

  clear() {
    this.cache = {
      users: [],
      games: [],
      moves: [],
      matchmaking_queue: [],
      rating_history: []
    };
    this.persist();
  }
}

// Check if running inside tgcloud native environment with built-in 'sdk'
let dbInstance;

try {
  const sdk = await import('sdk');
  if (sdk.db) {
    dbInstance = sdk.db;
  } else {
    dbInstance = new PersistentDatabase();
  }
} catch {
  dbInstance = new PersistentDatabase();
}

export const db = dbInstance;
export default db;
