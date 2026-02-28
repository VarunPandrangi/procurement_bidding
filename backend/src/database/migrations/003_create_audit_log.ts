import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('rfq_id').nullable();
    table.string('event_type', 50).notNullable();
    table.string('actor_type', 20).notNullable();
    table.uuid('actor_id').nullable();
    table.specificType('actor_code', 'CHAR(5)').nullable();
    table.jsonb('event_data').notNullable();
    table.string('event_hash', 64).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_type_check
    CHECK (actor_type IN ('SYSTEM', 'ADMIN', 'BUYER', 'SUPPLIER'))
  `);

  await knex.raw(`
    CREATE INDEX idx_audit_log_rfq_id ON audit_log(rfq_id);
  `);
  await knex.raw(`
    CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
  `);
  await knex.raw(`
    CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
  `);

  // DB-level enforcement: Revoke UPDATE and DELETE on audit_log from app_user
  // This ensures the audit log is truly append-only at the database level
  // The application connects as the main postgres user for migrations,
  // but the app_user role (used at runtime) cannot modify or delete audit entries
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        REVOKE UPDATE, DELETE ON audit_log FROM app_user;
        GRANT SELECT, INSERT ON audit_log TO app_user;
      END IF;
    END
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_log');
}
