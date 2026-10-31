import mysql from 'mysql2/promise';

class SQLFragment {
  constructor(
    public readonly sql: string,
    public readonly values: mysql.ExecuteValues[]
  ) {}
}

// Inline SQL text without parameters. Only ever pass constants, never user input.
export function raw(text: string): SQLFragment {
  return new SQLFragment(text, []);
}

export function sql(value: unknown[] | Record<string, unknown>): SQLFragment {
  if (Array.isArray(value)) {
    const placeholders = value.map(() => '?').join(', ');
    return new SQLFragment(`(${placeholders})`, value as mysql.ExecuteValues[]);
  }
  const keys = Object.keys(value);
  const setClause = keys.map((k) => `\`${k}\` = ?`).join(', ');
  return new SQLFragment(
    setClause,
    keys.map((k) => value[k] as mysql.ExecuteValues)
  );
}

function isTemplateStringsArray(
  v: unknown
): v is TemplateStringsArray {
  return (
    Array.isArray(v) &&
    'raw' in v &&
    typeof (v as any).raw === 'object'
  );
}

function parseTemplate(
  strings: TemplateStringsArray,
  values: unknown[]
): { query: string; params: mysql.ExecuteValues[] } {
  let query = '';
  const params: mysql.ExecuteValues[] = [];
  for (let i = 0; i < strings.length; i++) {
    query += strings[i] as string;
    if (i < values.length) {
      const val = values[i];
      if (val instanceof SQLFragment) {
        query += val.sql;
        params.push(...val.values);
      } else {
        query += '?';
        params.push(val as mysql.ExecuteValues);
      }
    }
  }
  return { query, params };
}

export interface SQLResult {
  lastInsertRowid: number;
  affectedRows: number;
}

export interface TransactionSQL {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<SQLResult>;
  <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  unsafe(sql: string): Promise<unknown>;
}

function makeQuery(pool: mysql.Pool) {
  return async function query<T>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T> {
    const { query: q, params } = parseTemplate(strings, values);
    const [result] = await pool.execute(q, params);
    if (Array.isArray(result)) {
      return result as T;
    }
    const header = result as mysql.ResultSetHeader;
    return {
      lastInsertRowid: Number(header.insertId),
      affectedRows: header.affectedRows,
    } as unknown as T;
  };
}

function makeTxQuery(conn: mysql.PoolConnection) {
  return async function txQuery<T>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T> {
    const { query: q, params } = parseTemplate(strings, values);
    const [result] = await conn.execute(q, params);
    if (Array.isArray(result)) {
      return result as T;
    }
    const header = result as mysql.ResultSetHeader;
    return {
      lastInsertRowid: Number(header.insertId),
      affectedRows: header.affectedRows,
    } as unknown as T;
  };
}

export type SQLInstance = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<SQLResult>;
  <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  begin<T>(fn: (tx: TransactionSQL) => Promise<T>): Promise<T>;
  unsafe(sql: string): Promise<unknown>;
  close(): Promise<void>;
};

export function SQL(url: string): SQLInstance {
  const pool = mysql.createPool({ uri: url, timezone: 'Z' });
  const query = makeQuery(pool);

  return Object.assign(query, {
    begin: async <T>(fn: (tx: TransactionSQL) => Promise<T>): Promise<T> => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const tx: TransactionSQL = Object.assign(makeTxQuery(conn), {
          unsafe: async (sqlString: string) => {
            const [result] = await conn.query(sqlString);
            return result;
          },
        });
        const result = await fn(tx);
        await conn.commit();
        return result;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
    unsafe: async (sqlString: string) => {
      const [result] = await pool.query(sqlString);
      return result;
    },
    close: async () => {
      await pool.end();
    },
  }) as unknown as SQLInstance;
}
