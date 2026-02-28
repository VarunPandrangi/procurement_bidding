import { getDb } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

export async function getSupplierIdFromUserId(userId: string): Promise<string> {
  const db = getDb();
  const supplier = await db('suppliers').where({ user_id: userId }).first();
  if (!supplier) {
    throw new AppError(403, 'FORBIDDEN', 'No supplier profile found for this user');
  }
  return supplier.id;
}

export async function getSupplierFromUserId(
  userId: string,
): Promise<{ id: string; unique_code: string }> {
  const db = getDb();
  const supplier = await db('suppliers')
    .where({ user_id: userId })
    .select('id', 'unique_code')
    .first();
  if (!supplier) {
    throw new AppError(403, 'FORBIDDEN', 'No supplier profile found for this user');
  }
  return supplier;
}
