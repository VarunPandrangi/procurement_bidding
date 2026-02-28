process.env.SUPPLIER_LINK_SECRET = 'test-supplier-link-secret';
process.env.SUPPLIER_LINK_EXPIRY_HOURS = '72';

import jwt from 'jsonwebtoken';
import {
  generateSupplierLinkToken,
  verifySupplierLinkToken,
} from '../../src/shared/utils/token';

describe('Tokenized Supplier Link Generator', () => {
  it('should generate a valid JWT token', () => {
    const token = generateSupplierLinkToken('supplier-123', 'rfq-456');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should contain correct payload (supplierId, rfqId, type)', () => {
    const token = generateSupplierLinkToken('supplier-123', 'rfq-456');
    const payload = verifySupplierLinkToken(token);
    expect(payload.supplierId).toBe('supplier-123');
    expect(payload.rfqId).toBe('rfq-456');
    expect(payload.type).toBe('supplier_access');
  });

  it('should fail verification when token is expired', () => {
    const secret = process.env.SUPPLIER_LINK_SECRET!;
    const token = jwt.sign(
      {
        supplierId: 'supplier-123',
        rfqId: 'rfq-456',
        type: 'supplier_access',
      },
      secret,
      { expiresIn: '0s' },
    );

    expect(() => verifySupplierLinkToken(token)).toThrow();
  });

  it('should fail verification with wrong secret', () => {
    const token = jwt.sign(
      {
        supplierId: 'supplier-123',
        rfqId: 'rfq-456',
        type: 'supplier_access',
      },
      'wrong-secret',
      { expiresIn: '72h' },
    );

    expect(() => verifySupplierLinkToken(token)).toThrow();
  });

  it('should fail verification if token type is not supplier_access', () => {
    const secret = process.env.SUPPLIER_LINK_SECRET!;
    const token = jwt.sign(
      {
        supplierId: 'supplier-123',
        rfqId: 'rfq-456',
        type: 'wrong_type',
      },
      secret,
      { expiresIn: '72h' },
    );

    expect(() => verifySupplierLinkToken(token)).toThrow('Invalid token type');
  });
});
