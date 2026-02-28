import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { generateUniqueSupplierCode } from '../../shared/utils/supplier-code';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

interface SeedUser {
  email: string;
  password: string;
  full_name: string;
  role: 'ADMIN' | 'BUYER' | 'SUPPLIER';
}

interface SeedSupplier {
  email: string;
  company_name: string;
  contact_name: string;
}

const seedUsers: SeedUser[] = [
  {
    email: 'admin@platform.local',
    password: 'Admin@Secure123',
    full_name: 'Platform Admin',
    role: 'ADMIN',
  },
  {
    email: 'buyer1@platform.local',
    password: 'Buyer@Secure123',
    full_name: 'Buyer One',
    role: 'BUYER',
  },
  {
    email: 'buyer2@platform.local',
    password: 'Buyer@Secure123',
    full_name: 'Buyer Two',
    role: 'BUYER',
  },
  {
    email: 'supplier1@platform.local',
    password: 'Supplier@Secure1',
    full_name: 'Supplier One',
    role: 'SUPPLIER',
  },
  {
    email: 'supplier2@platform.local',
    password: 'Supplier@Secure2',
    full_name: 'Supplier Two',
    role: 'SUPPLIER',
  },
  {
    email: 'supplier3@platform.local',
    password: 'Supplier@Secure3',
    full_name: 'Supplier Three',
    role: 'SUPPLIER',
  },
  {
    email: 'supplier4@platform.local',
    password: 'Supplier@Secure4',
    full_name: 'Supplier Four',
    role: 'SUPPLIER',
  },
  {
    email: 'supplier5@platform.local',
    password: 'Supplier@Secure5',
    full_name: 'Supplier Five',
    role: 'SUPPLIER',
  },
];

const seedSupplierDetails: SeedSupplier[] = [
  {
    email: 'supplier1@platform.local',
    company_name: 'Alpha Supplies Ltd',
    contact_name: 'Supplier One',
  },
  {
    email: 'supplier2@platform.local',
    company_name: 'Beta Manufacturing Co',
    contact_name: 'Supplier Two',
  },
  {
    email: 'supplier3@platform.local',
    company_name: 'Gamma Industrial Corp',
    contact_name: 'Supplier Three',
  },
  {
    email: 'supplier4@platform.local',
    company_name: 'Delta Traders Inc',
    contact_name: 'Supplier Four',
  },
  {
    email: 'supplier5@platform.local',
    company_name: 'Epsilon Logistics Pvt Ltd',
    contact_name: 'Supplier Five',
  },
];

export async function seed(knex: Knex): Promise<void> {
  // Collect existing supplier codes to ensure uniqueness
  const existingCodes = await knex('suppliers').select('unique_code');
  const codeSet = new Set(existingCodes.map((r: { unique_code: string }) => r.unique_code));

  for (const seedUser of seedUsers) {
    // Check if user already exists (idempotent)
    const existing = await knex('users').where({ email: seedUser.email }).first();

    if (existing) {
      continue;
    }

    const passwordHash = await bcrypt.hash(seedUser.password, BCRYPT_ROUNDS);
    const userId = uuidv4();

    await knex('users').insert({
      id: userId,
      email: seedUser.email,
      password_hash: passwordHash,
      full_name: seedUser.full_name,
      role: seedUser.role,
      is_active: true,
    });

    // Create supplier record for SUPPLIER role users
    if (seedUser.role === 'SUPPLIER') {
      const supplierDetail = seedSupplierDetails.find((s) => s.email === seedUser.email);
      const uniqueCode = generateUniqueSupplierCode(codeSet);
      codeSet.add(uniqueCode);

      await knex('suppliers').insert({
        id: uuidv4(),
        user_id: userId,
        company_name: supplierDetail?.company_name || seedUser.full_name,
        contact_name: supplierDetail?.contact_name || seedUser.full_name,
        contact_email: seedUser.email,
        unique_code: uniqueCode,
        credibility_score: 50.0,
        credibility_class: 'STABLE',
        is_active: true,
      });
    }
  }
}
