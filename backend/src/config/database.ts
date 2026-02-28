import knex, { Knex } from 'knex';
import path from 'path';

const getConfig = (): Knex.Config => {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/procurement_dev';

  return {
    client: 'pg',
    connection: databaseUrl,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: path.resolve(__dirname, '../database/migrations'),
      extension: 'ts',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: path.resolve(__dirname, '../database/seeds'),
      extension: 'ts',
    },
  };
};

const config = getConfig();

let dbInstance: Knex | null = null;

export function getDb(): Knex {
  if (!dbInstance) {
    dbInstance = knex(getConfig());
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
}

export default config;
