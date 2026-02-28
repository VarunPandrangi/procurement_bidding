import bcrypt from 'bcryptjs';
import { getDb } from '../../config/database';
import { UserRole, AuditEventType, ActorType } from '../../shared/types/enums';
import { generateUniqueSupplierCode } from '../../shared/utils/supplier-code';
import { createAuditEntry } from '../audit/audit.service';
import { invalidateAllUserSessions } from '../auth/auth.service';
import { AppError } from '../../middleware/error-handler';
import { CreateUserInput, UpdateUserInput } from '../../shared/validators/user.validators';

export async function listUsers(filters?: {
  role?: UserRole;
  is_active?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ users: Record<string, unknown>[]; total: number }> {
  const db = getDb();
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const offset = (page - 1) * limit;

  let query = db('users').select(
    'id',
    'email',
    'full_name',
    'role',
    'is_active',
    'created_at',
    'updated_at',
  );
  let countQuery = db('users');

  if (filters?.role) {
    query = query.where('role', filters.role);
    countQuery = countQuery.where('role', filters.role);
  }

  if (filters?.is_active !== undefined) {
    query = query.where('is_active', filters.is_active);
    countQuery = countQuery.where('is_active', filters.is_active);
  }

  const [users, [{ count }]] = await Promise.all([
    query.orderBy('created_at', 'desc').offset(offset).limit(limit),
    countQuery.count('id as count'),
  ]);

  return {
    users,
    total: parseInt(count as string, 10),
  };
}

export async function createUser(
  input: CreateUserInput,
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
    const [user] = await trx('users')
      .insert({
        email: input.email.toLowerCase(),
        password_hash: passwordHash,
        full_name: input.full_name,
        role: input.role,
        is_active: true,
      })
      .returning(['id', 'email', 'full_name', 'role', 'is_active', 'created_at', 'updated_at']);

    let supplier = null;

    // If the role is SUPPLIER, also create a supplier record
    if (input.role === UserRole.SUPPLIER) {
      const existingCodes = await trx('suppliers').select('unique_code');
      const codeSet = new Set(existingCodes.map((r: { unique_code: string }) => r.unique_code));
      const uniqueCode = generateUniqueSupplierCode(codeSet);

      [supplier] = await trx('suppliers')
        .insert({
          user_id: user.id,
          company_name: input.full_name,
          unique_code: uniqueCode,
          is_active: true,
        })
        .returning([
          'id',
          'user_id',
          'company_name',
          'unique_code',
          'credibility_score',
          'credibility_class',
          'is_active',
          'created_at',
        ]);
    }

    await createAuditEntry(
      {
        eventType: AuditEventType.USER_CREATED,
        actorType: ActorType.ADMIN,
        actorId: adminId,
        eventData: {
          userId: user.id,
          email: user.email,
          role: user.role,
          createdByAdminId: adminId,
          ...(supplier ? { supplierCode: supplier.unique_code } : {}),
        },
      },
      trx,
    );

    await trx.commit();

    return {
      ...user,
      ...(supplier ? { supplier } : {}),
    };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
  adminId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (input.role !== undefined) {
    updateData.role = input.role;
  }
  if (input.is_active !== undefined) {
    updateData.is_active = input.is_active;
  }
  if (input.full_name !== undefined) {
    updateData.full_name = input.full_name;
  }

  const [updatedUser] = await db('users')
    .where({ id: userId })
    .update(updateData)
    .returning(['id', 'email', 'full_name', 'role', 'is_active', 'created_at', 'updated_at']);

  // If deactivating, invalidate all sessions
  if (input.is_active === false) {
    await invalidateAllUserSessions(userId);

    await createAuditEntry({
      eventType: AuditEventType.USER_DEACTIVATED,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      eventData: {
        userId,
        email: user.email,
        deactivatedByAdminId: adminId,
      },
    });
  } else {
    await createAuditEntry({
      eventType: AuditEventType.USER_UPDATED,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      eventData: {
        userId,
        changes: input,
        updatedByAdminId: adminId,
      },
    });
  }

  return updatedUser;
}

export async function getUserById(userId: string): Promise<Record<string, unknown> | null> {
  const db = getDb();
  const user = await db('users')
    .select('id', 'email', 'full_name', 'role', 'is_active', 'created_at', 'updated_at')
    .where({ id: userId })
    .first();

  return user || null;
}
