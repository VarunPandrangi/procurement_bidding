import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rfq_items', (table) => {
    table.decimal('last_price', 20, 4).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rfq_items', (table) => {
    table.dropColumn('last_price');
  });
}
