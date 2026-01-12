/**
 * Type declarations for @lancedb/lancedb module.
 */

declare module "@lancedb/lancedb" {
  export interface Connection {
    openTable(name: string): Promise<Table>;
    createTable(name: string, data: any[]): Promise<Table>;
    tableNames(): Promise<string[]>;
    dropTable(name: string): Promise<void>;
    close(): Promise<void>;
  }

  export interface Table {
    add(data: any[]): Promise<void>;
    delete(filter: string): Promise<void>;
    search(vector: number[]): Query;
    countRows(): Promise<number>;
    overwrite(data: any[]): Promise<void>;
    update(updates: Record<string, any>): Promise<void>;
  }

  export interface Query {
    limit(n: number): Query;
    where(filter: string): Query;
    select(columns: string[]): Query;
    execute(): Promise<any[]>;
  }

  export function connect(uri: string): Promise<Connection>;
}
