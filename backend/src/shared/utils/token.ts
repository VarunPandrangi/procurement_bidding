import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { TokenPayload, RefreshTokenPayload, SupplierLinkTokenPayload } from '../types/interfaces';
import { UserRole } from '../types/enums';

function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function signAccessToken(userId: string, role: UserRole): string {
  const secret = getEnvVar('JWT_SECRET');
  const expiryMinutes = parseInt(process.env.JWT_ACCESS_EXPIRY_MINUTES || '15', 10);

  return jwt.sign({ userId, role } as Omit<TokenPayload, 'iat' | 'exp'>, secret, {
    expiresIn: `${expiryMinutes}m`,
  });
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const secret = getEnvVar('JWT_REFRESH_SECRET');
  const expiryDays = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '7', 10);
  const jti = uuidv4();

  const token = jwt.sign({ userId, jti } as Omit<RefreshTokenPayload, 'iat' | 'exp'>, secret, {
    expiresIn: `${expiryDays}d`,
  });

  return { token, jti };
}

export function verifyAccessToken(token: string): TokenPayload {
  const secret = getEnvVar('JWT_SECRET');
  return jwt.verify(token, secret) as TokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const secret = getEnvVar('JWT_REFRESH_SECRET');
  return jwt.verify(token, secret) as RefreshTokenPayload;
}

export function generateSupplierLinkToken(supplierId: string, rfqId: string): string {
  const secret = getEnvVar('SUPPLIER_LINK_SECRET');
  const expiryHours = parseInt(process.env.SUPPLIER_LINK_EXPIRY_HOURS || '72', 10);

  return jwt.sign(
    {
      supplierId,
      rfqId,
      type: 'supplier_access' as const,
    } as Omit<SupplierLinkTokenPayload, 'iat' | 'exp'>,
    secret,
    { expiresIn: `${expiryHours}h` },
  );
}

export function verifySupplierLinkToken(token: string): SupplierLinkTokenPayload {
  const secret = getEnvVar('SUPPLIER_LINK_SECRET');
  const payload = jwt.verify(token, secret) as SupplierLinkTokenPayload;
  if (payload.type !== 'supplier_access') {
    throw new Error('Invalid token type');
  }
  return payload;
}
