process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only';
process.env.SUPPLIER_LINK_SECRET = 'test-supplier-link-secret';

import { Request, Response, NextFunction } from 'express';
import { authorize } from '../../src/middleware/authorize';
import { UserRole } from '../../src/shared/types/enums';

function createMockRequest(user?: { userId: string; role: UserRole }): Partial<Request> {
  return {
    user: user || undefined,
    requestId: 'test-request-id',
  } as Partial<Request>;
}

function createMockResponse(): {
  res: Partial<Response>;
  statusCode: number | null;
  body: Record<string, unknown> | null;
} {
  let statusCode: number | null = null;
  let body: Record<string, unknown> | null = null;

  const res: Partial<Response> = {
    status: function (code: number) {
      statusCode = code;
      return this as Response;
    },
    json: function (data: Record<string, unknown>) {
      body = data;
      return this as Response;
    },
    req: { requestId: 'test-request-id' } as Request,
  };

  return {
    res,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

describe('RBAC Middleware - authorize', () => {
  it('should allow ADMIN when ADMIN is required', () => {
    const req = createMockRequest({ userId: 'admin-1', role: UserRole.ADMIN });
    const { res } = createMockResponse();
    const next = jest.fn() as NextFunction;

    const middleware = authorize(UserRole.ADMIN);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should block BUYER when only ADMIN is required (403)', () => {
    const req = createMockRequest({ userId: 'buyer-1', role: UserRole.BUYER });
    const mock = createMockResponse();
    const next = jest.fn() as NextFunction;

    const middleware = authorize(UserRole.ADMIN);
    middleware(req as Request, mock.res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(mock.statusCode).toBe(403);
    expect((mock.body as Record<string, unknown>)?.success).toBe(false);
  });

  it('should block SUPPLIER when only BUYER is required (403)', () => {
    const req = createMockRequest({ userId: 'supplier-1', role: UserRole.SUPPLIER });
    const mock = createMockResponse();
    const next = jest.fn() as NextFunction;

    const middleware = authorize(UserRole.BUYER);
    middleware(req as Request, mock.res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(mock.statusCode).toBe(403);
  });

  it('should return 401 when no user on request', () => {
    const req = createMockRequest();
    const mock = createMockResponse();
    const next = jest.fn() as NextFunction;

    const middleware = authorize(UserRole.ADMIN);
    middleware(req as Request, mock.res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(mock.statusCode).toBe(401);
  });

  it('should allow BUYER when both ADMIN and BUYER are allowed', () => {
    const req = createMockRequest({ userId: 'buyer-1', role: UserRole.BUYER });
    const { res } = createMockResponse();
    const next = jest.fn() as NextFunction;

    const middleware = authorize(UserRole.ADMIN, UserRole.BUYER);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow SUPPLIER when all roles are allowed', () => {
    const req = createMockRequest({ userId: 'supplier-1', role: UserRole.SUPPLIER });
    const { res } = createMockResponse();
    const next = jest.fn() as NextFunction;

    const middleware = authorize(UserRole.ADMIN, UserRole.BUYER, UserRole.SUPPLIER);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should block SUPPLIER when only ADMIN and BUYER are allowed', () => {
    const req = createMockRequest({ userId: 'supplier-1', role: UserRole.SUPPLIER });
    const mock = createMockResponse();
    const next = jest.fn() as NextFunction;

    const middleware = authorize(UserRole.ADMIN, UserRole.BUYER);
    middleware(req as Request, mock.res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(mock.statusCode).toBe(403);
  });
});
