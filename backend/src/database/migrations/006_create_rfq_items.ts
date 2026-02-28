import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rfq_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('rfq_id').notNullable().references('id').inTable('rfqs').onDelete('CASCADE');
    table.integer('sl_no').notNullable();
    table.text('description').notNullable();
    table.text('specification').nullable();
    table.string('uom', 50).notNullable();
    table.decimal('quantity', 15, 4).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['rfq_id', 'sl_no']);
  });

  await knex.raw('CREATE INDEX idx_rfq_items_rfq_id ON rfq_items(rfq_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rfq_items');
}
