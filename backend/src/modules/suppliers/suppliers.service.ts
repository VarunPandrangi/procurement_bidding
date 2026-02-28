import bcrypt from 'bcryptjs';
import { getDb } from '../../config/database';
import { UserRole, AuditEventType, ActorType } from '../../shared/types/enums';
import { generateUniqueSupplierCode } from '../../shared/utils/supplier-code';
import { createAuditEntry } from '../audit/audit.service';
import { AppError } from '../../middleware/error-handler';
import { OnboardSupplierInput } from '../../shared/validators/supplier.validators';

export async function listSuppliers(filters?: {
  is_active?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ suppliers: Record<string, unknown>[]; total: number }> {
  const db = getDb();
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const offset = (page - 1) * limit;

  let query = db('suppliers')
    .join('users', 'suppliers.user_id', 'users.id')
    .select(
      'suppliers.id',
      'suppliers.user_id',
      'suppliers.company_name',
      'suppliers.contact_name',
      'suppliers.contact_email',
      'suppliers.unique_code',
      'suppliers.category_tags',
      'suppliers.credibility_score',
      'suppliers.credibility_class',
      'suppliers.is_active',
      'suppliers.created_at',
      'suppliers.updated_at',
      'users.email',
      'users.full_name',
    );

  let countQuery = db('suppliers');

  if (filters?.is_active !== undefined) {
    query = query.where('suppliers.is_active', filters.is_active);
    countQuery = countQuery.where('is_active', filters.is_active);
  }

  const [suppliers, [{ count }]] = await Promise.all([
    query.orderBy('suppliers.created_at', 'desc').offset(offset).limit(limit),
    countQuery.count('id as count'),
  ]);

  return {
    suppliers,
    total: parseInt(count as string, 10),
  };
}

export async function onboardSupplier(
  input: OnboardSupplierInput,
  adminId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Check for duplicate email
  const existingUser = await db('users').where({ email: input.email.toLowerCase() }).first();
  if (existingUser) {
    throw new AppError(409, 'DUPLICATE_EMAIL', 'A user with this email already exists');
  }

  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const passwordHash = await bcrypt.hash(input.password, bcryptRounds);

  const trx = await db.transaction();

  try {
    // Create user account
    const [user] = await trx('users')
      .insert({
        email: input.email.toLowerCase(),
        password_hash: passwordHash,
        full_name: input.full_name,
        role: UserRole.SUPPLIER,
        is_active: true,
      })
      .returning(['id', 'email', 'full_name', 'role', 'is_active', 'created_at']);

    // Generate unique supplier code
    const existingCodes = await trx('suppliers').select('unique_code');
    const codeSet = new Set(existingCodes.map((r: { unique_code: string }) => r.unique_code));
    const uniqueCode = generateUniqueSupplierCode(codeSet);

    // Create supplier record
    const [supplier] = await trx('suppliers')
      .insert({
        user_id: user.id,
        company_name: input.company_name,
        contact_name: input.contact_name || null,
        contact_email: input.contact_email || null,
        unique_code: uniqueCode,
        category_tags: input.category_tags || null,
        is_active: true,
      })
      .returning([
        'id',
        'user_id',
        'company_name',
        'contact_name',
        'contact_email',
        'unique_code',
        'category_tags',
        'credibility_score',
        'credibility_class',
        'is_active',
        'created_at',
      ]);

    // Audit log entries
    await createAuditEntry(
      {
        eventType: AuditEventType.USER_CREATED,
        actorType: ActorType.ADMIN,
        actorId: adminId,
        eventData: {
          userId: user.id,
          email: user.email,
          role: UserRole.SUPPLIER,
          createdByAdminId: adminId,
        },
      },
      trx,
    );

    await createAuditEntry(
      {
        eventType: AuditEventType.SUPPLIER_ONBOARDED,
        actorType: ActorType.ADMIN,
        actorId: adminId,
        actorCode: uniqueCode,
        eventData: {
          supplierId: supplier.id,
          userId: user.id,
          companyName: supplier.company_name,
          uniqueCode: uniqueCode,
          onboardedByAdminId: adminId,
        },
      },
      trx,
    );

    await trx.commit();

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
      },
      supplier,
    };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

export async function getSupplierByUserId(
  userId: string,
): Promise<Record<string, unknown> | null> {
  const db = getDb();
  const supplier = await db('suppliers').where({ user_id: userId }).first();
  return supplier || null;
}

export async function getSupplierByCode(
  uniqueCode: string,
): Promise<Record<string, unknown> | null> {
  const db = getDb();
  const supplier = await db('suppliers').where({ unique_code: uniqueCode }).first();
  return supplier || null;
}
