import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bid_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('bid_id').notNullable().references('id').inTable('bids').onDelete('CASCADE');
    table
      .uuid('rfq_item_id')
      .notNullable()
      .references('id')
      .inTable('rfq_items')
      .onDelete('RESTRICT');

    // Pricing (total_price = unit_price * rfq_items.quantity, computed server-side)
    table.decimal('unit_price', 20, 4).notNullable();
    table.decimal('total_price', 20, 4).notNullable();

    // Immutable — no updated_at since bid items never change after insertion
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Indexes
  await knex.raw('CREATE INDEX idx_bid_items_bid_id ON bid_items(bid_id)');
  await knex.raw('CREATE INDEX idx_bid_items_rfq_item_id ON bid_items(rfq_item_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bid_items');
}
