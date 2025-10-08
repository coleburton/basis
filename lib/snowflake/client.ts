import snowflake from 'snowflake-sdk';

// SQL statement validation - READ-ONLY MODE
const ALLOWED_STATEMENTS = [
  'SELECT',
  'SHOW',
  'DESCRIBE',
  'DESC',
];

const DENIED_PATTERNS = [
  /CREATE/i,
  /DROP/i,
  /ALTER/i,
  /GRANT/i,
  /REVOKE/i,
  /MERGE/i,
  /DELETE/i,
  /UPDATE/i,
  /INSERT/i,
  /TRUNCATE/i,
  /CALL/i,
  /EXECUTE\s+IMMEDIATE/i,
];

export class SnowflakeClient {
  private connection: snowflake.Connection | null = null;

  constructor(
    private config: {
      account: string;
      username: string;
      password: string;
      database: string;
      warehouse: string;
      role: string;
    }
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection = snowflake.createConnection({
        account: this.config.account,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database,
        warehouse: this.config.warehouse,
        role: this.config.role,
      });

      this.connection.connect((err, conn) => {
        if (err) {
          reject(new Error(`Failed to connect to Snowflake: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connection) {
        this.connection.destroy((err) => {
          if (err) {
            console.error('Error disconnecting from Snowflake:', err);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  validateSql(sql: string): { valid: boolean; error?: string } {
    const trimmedSql = sql.trim().toUpperCase();

    // Check if starts with allowed statement
    const startsWithAllowed = ALLOWED_STATEMENTS.some((stmt) =>
      trimmedSql.startsWith(stmt)
    );

    if (!startsWithAllowed) {
      return {
        valid: false,
        error: `SQL must start with one of: ${ALLOWED_STATEMENTS.join(', ')}`,
      };
    }

    // Check for denied patterns
    for (const pattern of DENIED_PATTERNS) {
      if (pattern.test(sql)) {
        return {
          valid: false,
          error: `SQL contains forbidden pattern: ${pattern.source}`,
        };
      }
    }

    return { valid: true };
  }

  async execute<T = unknown>(
    sql: string,
    options: {
      timeout?: number;
      rowLimit?: number;
      validateOnly?: boolean;
    } = {}
  ): Promise<{
    rows: T[];
    columns: Array<{ name: string; type: string }>;
    rowCount: number;
    limited: boolean;
  }> {
    if (!this.connection) {
      await this.connect();
    }

    // Validate SQL
    const validation = this.validateSql(sql);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const timeout = options.timeout || 60000; // 60s default
    const rowLimit = options.rowLimit;

    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('No connection available'));
        return;
      }

      const statement = this.connection.execute({
        sqlText: sql,
        timeout,
        complete: (err, stmt, rows) => {
          if (err) {
            reject(new Error(`Snowflake query error: ${err.message}`));
            return;
          }

          const columns =
            stmt.getColumns()?.map((col) => ({
              name: col.getName(),
              type: col.getType(),
            })) || [];

          const allRows = (rows || []) as T[];
          const limited = rowLimit ? allRows.length > rowLimit : false;
          const resultRows = rowLimit ? allRows.slice(0, rowLimit) : allRows;

          resolve({
            rows: resultRows,
            columns,
            rowCount: allRows.length,
            limited,
          });
        },
      });
    });
  }

  async preview(sql: string, rowLimit: number = 200): Promise<{
    rows: Array<Record<string, unknown>>;
    columns: Array<{ name: string; type: string }>;
    totalRows: number;
    limited: boolean;
  }> {
    const result = await this.execute(sql, { rowLimit });
    return {
      rows: result.rows as Array<Record<string, unknown>>,
      columns: result.columns,
      totalRows: result.rowCount,
      limited: result.limited,
    };
  }

  async getTableSchema(
    database: string,
    schema: string,
    table: string
  ): Promise<Array<{ name: string; type: string }>> {
    const sql = `
      SELECT COLUMN_NAME, DATA_TYPE
      FROM ${database}.INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}'
        AND TABLE_NAME = '${table}'
      ORDER BY ORDINAL_POSITION
    `;

    const result = await this.execute<{ COLUMN_NAME: string; DATA_TYPE: string }>(
      sql
    );

    return result.rows.map((row) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
    }));
  }

  async listTables(
    database: string,
    schema: string
  ): Promise<Array<{ name: string; type: 'table' | 'view' }>> {
    const sql = `
      SELECT TABLE_NAME, TABLE_TYPE
      FROM ${database}.INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schema}'
      ORDER BY TABLE_NAME
    `;

    const result = await this.execute<{ TABLE_NAME: string; TABLE_TYPE: string }>(
      sql
    );

    return result.rows.map((row) => ({
      name: row.TABLE_NAME,
      type: row.TABLE_TYPE.toLowerCase().includes('view') ? 'view' : 'table',
    }));
  }
}

// Singleton instance
let snowflakeClient: SnowflakeClient | null = null;

export function getSnowflakeClient(): SnowflakeClient {
  if (!snowflakeClient) {
    const config = {
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USER!,
      password: process.env.SNOWFLAKE_PASSWORD!,
      database: process.env.SNOWFLAKE_DATABASE!,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
      role: process.env.SNOWFLAKE_ROLE!,
    };

    // Validate required env vars
    const missing = Object.entries(config)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(
        `Missing required Snowflake environment variables: ${missing.join(', ')}`
      );
    }

    snowflakeClient = new SnowflakeClient(config);
  }

  return snowflakeClient;
}
