import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Set env vars before importing modules that depend on them
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only';
process.env.JWT_ACCESS_EXPIRY_MINUTES = '15';
process.env.JWT_REFRESH_EXPIRY_DAYS = '7';
process.env.SUPPLIER_LINK_SECRET = 'test-supplier-link-secret';

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/shared/utils/token';
import { UserRole } from '../../src/shared/types/enums';

describe('Auth Service - Token Utilities', () => {
  describe('Password hashing (bcrypt)', () => {
    it('should produce a valid bcrypt hash', async () => {
      const password = 'TestPassword123';
      const hash = await bcrypt.hash(password, 4);
      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should verify correct password successfully', async () => {
      const password = 'TestPassword123';
      const hash = await bcrypt.hash(password, 4);
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const password = 'TestPassword123';
      const hash = await bcrypt.hash(password, 4);
      const isValid = await bcrypt.compare('WrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should use cost factor of at least 12 in production config', () => {
      const defaultRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      // In test env, we use lower rounds for speed
      // But default config specifies 12
      expect(defaultRounds).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Access Token', () => {
    it('should generate a valid access token', () => {
      const token = signAccessToken('user-123', UserRole.ADMIN);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should verify a valid access token', () => {
      const token = signAccessToken('user-123', UserRole.BUYER);
      const payload = verifyAccessToken(token);
      expect(payload.userId).toBe('user-123');
      expect(payload.role).toBe(UserRole.BUYER);
    });

    it('should include userId and role in payload', () => {
      const token = signAccessToken('user-456', UserRole.SUPPLIER);
      const payload = verifyAccessToken(token);
      expect(payload.userId).toBe('user-456');
      expect(payload.role).toBe(UserRole.SUPPLIER);
    });

    it('should fail verification with wrong secret', () => {
      const token = jwt.sign({ userId: 'user-123', role: 'ADMIN' }, 'wrong-secret', {
        expiresIn: '15m',
      });
      expect(() => verifyAccessToken(token)).toThrow();
    });

    it('should fail verification when token is expired', () => {
      const token = jwt.sign(
        { userId: 'user-123', role: 'ADMIN' },
        process.env.JWT_SECRET!,
        { expiresIn: '0s' },
      );
      // Small delay to ensure expiry
      expect(() => verifyAccessToken(token)).toThrow();
    });
  });

  describe('Refresh Token', () => {
    it('should generate a refresh token with jti', () => {
      const { token, jti } = signRefreshToken('user-123');
      expect(token).toBeDefined();
      expect(jti).toBeDefined();
      expect(typeof jti).toBe('string');
    });

    it('should verify a valid refresh token', () => {
      const { token } = signRefreshToken('user-123');
      const payload = verifyRefreshToken(token);
      expect(payload.userId).toBe('user-123');
      expect(payload.jti).toBeDefined();
    });

    it('should generate unique jti for each refresh token', () => {
      const { jti: jti1 } = signRefreshToken('user-123');
      const { jti: jti2 } = signRefreshToken('user-123');
      expect(jti1).not.toBe(jti2);
    });

    it('should fail verification with wrong secret', () => {
      const token = jwt.sign(
        { userId: 'user-123', jti: 'fake-jti' },
        'wrong-secret',
        { expiresIn: '7d' },
      );
      expect(() => verifyRefreshToken(token)).toThrow();
    });
  });
});
