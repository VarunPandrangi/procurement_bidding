import { Knex } from 'knex';
import { getDb } from '../../config/database';

/**
 * Generates the next RFQ number for the current year.
 * Format: RFQ-YYYY-NNNN where NNNN is zero-padded sequential (globally unique).
 *
 * Must be called within a transaction to prevent race conditions.
 */
export async function generateRfqNumber(_buyerId: string, trx?: Knex): Promise<string> {
  const db = trx || getDb();
  const year = new Date().getFullYear();
  const prefix = `RFQ-${year}-`;

  // Find the max existing rfq_number across ALL buyers in the current year
  const result = await db('rfqs')
    .where('rfq_number', 'like', `${prefix}%`)
    .max('rfq_number as max_number')
    .first();

  let nextSequence = 1;

  if (result?.max_number) {
    const parts = (result.max_number as string).split('-');
    const currentMax = parseInt(parts[2], 10);
    if (!isNaN(currentMax)) {
      nextSequence = currentMax + 1;
    }
  }

  const paddedSequence = String(nextSequence).padStart(4, '0');
  return `${prefix}${paddedSequence}`;
}
