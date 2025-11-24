import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use standard PostgreSQL Pool for Azure PostgreSQL (TCP/TLS)
// Note: Azure PostgreSQL does not support WebSocket connections
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Azure PostgreSQL uses self-signed certs
  },
});

export const db = drizzle({ client: pool, schema });
