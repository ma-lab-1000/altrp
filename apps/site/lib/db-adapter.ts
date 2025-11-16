/**
 * Database Adapter
 * Provides unified interface for both D1 (Cloudflare) and PostgreSQL (Dokploy)
 */

import { drizzle } from 'drizzle-orm/d1';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { D1Database } from '@cloudflare/workers-types';
import { schema } from '../functions/_shared/schema/schema';
import pg from 'pg';
import postgres from 'postgres';

const { Pool } = pg;

export type DatabaseAdapter = D1Database | PostgresJsDatabase<typeof schema>;
export type SiteDb = DrizzleD1Database<typeof schema> | PostgresJsDatabase<typeof schema>;

let postgresClient: postgres.Sql | null = null;
let postgresPool: pg.Pool | null = null;

/**
 * Check if running in Cloudflare Workers environment
 */
function isCloudflareEnvironment(): boolean {
  return typeof globalThis !== 'undefined' && 
         'caches' in globalThis && 
         typeof (globalThis as any).caches?.default !== 'undefined';
}

/**
 * Create PostgreSQL connection from DATABASE_URL
 */
function createPostgresConnection(): postgres.Sql {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  if (!postgresClient) {
    postgresClient = postgres(databaseUrl, {
      max: 1, // Use single connection for serverless
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  return postgresClient;
}

/**
 * Create PostgreSQL pool connection (alternative approach)
 */
function createPostgresPool(): pg.Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  return postgresPool;
}

/**
 * Create database adapter based on environment
 */
export function createDatabaseAdapter(db?: D1Database): DatabaseAdapter {
  // If D1Database is provided (Cloudflare environment), use it
  if (db && isCloudflareEnvironment()) {
    return db;
  }

  // Otherwise, use PostgreSQL
  if (process.env.DATABASE_URL) {
    // Use postgres-js for better compatibility with drizzle
    const sql = createPostgresConnection();
    return sql as any; // Type assertion needed due to drizzle typing
  }

  throw new Error('No database connection available. Provide D1Database or set DATABASE_URL');
}

/**
 * Create Drizzle database instance
 */
export function createDb(db?: D1Database): SiteDb {
  // If D1Database is provided (Cloudflare environment), use D1 adapter
  if (db && isCloudflareEnvironment()) {
    return drizzle(db, { schema }) as SiteDb;
  }

  // Otherwise, use PostgreSQL
  if (process.env.DATABASE_URL) {
    const sql = createPostgresConnection();
    return drizzlePostgres(sql, { schema }) as SiteDb;
  }

  throw new Error('No database connection available. Provide D1Database or set DATABASE_URL');
}

/**
 * Close database connections (for cleanup)
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (postgresClient) {
    await postgresClient.end();
    postgresClient = null;
  }
  if (postgresPool) {
    await postgresPool.end();
    postgresPool = null;
  }
}

