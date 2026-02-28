import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rfq_suppliers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('rfq_id').notNullable().references('id').inTable('rfqs').onDelete('CASCADE');
    table
      .uuid('supplier_id')
      .notNullable()
      .references('id')
      .inTable('suppliers')
      .onDelete('RESTRICT');
    table.specificType('supplier_code', 'CHAR(5)').notNullable();

    // Tokenized access link
    table.string('access_token', 512).unique().nullable();
    table.timestamp('access_token_expires_at', { useTz: true }).nullable();

    // Status
    table.string('status', 20).notNullable().defaultTo('PENDING');

    // Decline reason
    table.text('decline_reason').nullable();

    // Acceptance timestamp
    table.timestamp('accepted_at', { useTz: true }).nullable();

    // Declaration booleans
    table.boolean('declaration_rfq_terms').notNullable().defaultTo(false);
    table.boolean('declaration_no_collusion').notNullable().defaultTo(false);
    table.boolean('declaration_confidentiality').notNullable().defaultTo(false);

    // Timestamps
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['rfq_id', 'supplier_id']);
  });

  // CHECK constraint for status enum
  await knex.raw(`
    ALTER TABLE rfq_suppliers ADD CONSTRAINT rfq_suppliers_status_check
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED'))
  `);

  // Indexes for common query patterns
  await knex.raw('CREATE INDEX idx_rfq_suppliers_rfq_id ON rfq_suppliers(rfq_id)');
  await knex.raw('CREATE INDEX idx_rfq_suppliers_supplier_id ON rfq_suppliers(supplier_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rfq_suppliers');
}
