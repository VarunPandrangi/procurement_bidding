import supertest from 'supertest';
import {
  app,
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  connectTestRedis,
  cleanRedis,
  closeTestRedis,
  createTestUser,
  getAccessToken,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

const request = supertest(app);

beforeAll(async () => {
  await setupTestDatabase();
  await connectTestRedis();
});

afterAll(async () => {
  await teardownTestDatabase();
  await closeTestRedis();
});

beforeEach(async () => {
  await cleanDatabase();
  await cleanRedis();
});

describe('Auth Integration Tests', () => {
  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials (200)', async () => {
      await createTestUser({
        email: 'test@test.com',
        password: 'SecurePass123',
        role: 'ADMIN',
      });

      const res = await request
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'SecurePass123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('test@test.com');
      expect(res.body.data.user.password_hash).toBeUndefined();

      // Check refresh token cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('refreshToken='))
        : undefined;
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('should return 401 for wrong password', async () => {
      await createTestUser({
        email: 'test@test.com',
        password: 'SecurePass123',
      });

      const res = await request
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for nonexistent email', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'SomePassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 for inactive user', async () => {
      await createTestUser({
        email: 'inactive@test.com',
        password: 'SecurePass123',
        is_active: false,
      });

      const res = await request
        .post('/api/auth/login')
        .send({ email: 'inactive@test.com', password: 'SecurePass123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('should return 422 for missing fields', async () => {
      const res = await request.post('/api/auth/login').send({ email: 'test@test.com' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 for invalid email format', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'SomePassword' });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens successfully (200)', async () => {
      await createTestUser({
        email: 'refresh@test.com',
        password: 'SecurePass123',
      });

      // First login to get refresh token cookie
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'refresh@test.com', password: 'SecurePass123' });

      const cookies = loginRes.headers['set-cookie'];
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      const res = await request
        .post('/api/auth/refresh')
        .set('Cookie', cookieStr);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should return 401 when no refresh token cookie', async () => {
      const res = await request.post('/api/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_REQUIRED');
    });

    it('should return 401 for expired/invalid refresh token', async () => {
      const res = await request
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token-value');

      expect(res.status).toBe(401);
    });

    it('should invalidate old refresh token after rotation', async () => {
      await createTestUser({
        email: 'rotation@test.com',
        password: 'SecurePass123',
      });

      // Login
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'rotation@test.com', password: 'SecurePass123' });

      const oldCookies = loginRes.headers['set-cookie'];
      const oldCookieStr = Array.isArray(oldCookies) ? oldCookies.join('; ') : oldCookies;

      // First refresh — should succeed
      const refreshRes = await request
        .post('/api/auth/refresh')
        .set('Cookie', oldCookieStr);

      expect(refreshRes.status).toBe(200);

      // Second refresh with old token — should fail (token was rotated)
      const secondRes = await request
        .post('/api/auth/refresh')
        .set('Cookie', oldCookieStr);

      expect(secondRes.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully (200)', async () => {
      await createTestUser({
        email: 'logout@test.com',
        password: 'SecurePass123',
      });

      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'logout@test.com', password: 'SecurePass123' });

      const token = loginRes.body.data.accessToken;
      const cookies = loginRes.headers['set-cookie'];
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      const res = await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', cookieStr);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request.post('/api/auth/logout');

      expect(res.status).toBe(401);
    });

    it('should invalidate refresh token after logout', async () => {
      await createTestUser({
        email: 'logout2@test.com',
        password: 'SecurePass123',
      });

      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'logout2@test.com', password: 'SecurePass123' });

      const token = loginRes.body.data.accessToken;
      const cookies = loginRes.headers['set-cookie'];
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      // Logout
      await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', cookieStr);

      // Try to refresh with old cookie — should fail
      const refreshRes = await request
        .post('/api/auth/refresh')
        .set('Cookie', cookieStr);

      expect(refreshRes.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile (200)', async () => {
      const user = await createTestUser({
        email: 'me@test.com',
        password: 'SecurePass123',
        full_name: 'Test User',
        role: 'BUYER',
      });

      const token = getAccessToken(user.id, UserRole.BUYER);

      const res = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('me@test.com');
      expect(res.body.data.full_name).toBe('Test User');
      expect(res.body.data.role).toBe('BUYER');
      expect(res.body.data.password_hash).toBeUndefined();
    });

    it('should return 401 when no token provided', async () => {
      const res = await request.get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return 401 for expired token', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'user-123', role: 'ADMIN' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' },
      );

      const res = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/time/now', () => {
    it('should return server UTC timestamp without auth', async () => {
      const res = await request.get('/api/time/now');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.timestamp).toBeDefined();

      // Verify it's a valid ISO date
      const timestamp = new Date(res.body.data.timestamp);
      expect(timestamp.toISOString()).toBe(res.body.data.timestamp);
    });

    it('should respond within 100ms', async () => {
      const start = Date.now();
      await request.get('/api/time/now');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
