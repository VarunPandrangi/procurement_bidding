import crypto from 'crypto';
import { generateUniqueSupplierCode } from '../../src/shared/utils/supplier-code';

describe('Supplier Code Generator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate a code of exactly 5 characters', () => {
    const code = generateUniqueSupplierCode(new Set());
    expect(code).toHaveLength(5);
  });

  it('should generate an alphanumeric-only code (A-Z0-9)', () => {
    const code = generateUniqueSupplierCode(new Set());
    expect(code).toMatch(/^[A-Z0-9]{5}$/);
  });

  it('should generate a unique code not in the existing set', () => {
    const existingCodes = new Set(['ABCDE', 'FGHIJ', 'KLMNO']);
    const code = generateUniqueSupplierCode(existingCodes);
    expect(existingCodes.has(code)).toBe(false);
  });

  it('should accept an array of existing codes', () => {
    const existingCodes = ['ABCDE', 'FGHIJ'];
    const code = generateUniqueSupplierCode(existingCodes);
    expect(existingCodes.includes(code)).toBe(false);
    expect(code).toHaveLength(5);
  });

  it('should handle collision by retrying', () => {
    // Generate a code, then add it to existing and re-generate to force retry
    const firstCode = generateUniqueSupplierCode(new Set());
    const existingCodes = new Set([firstCode]);

    // The next call must produce a different code
    const secondCode = generateUniqueSupplierCode(existingCodes);
    expect(secondCode).toHaveLength(5);
    expect(secondCode).not.toBe(firstCode);
  });

  it('should throw after max retries when all generated codes collide', () => {
    let callCount = 0;
    // Mock randomInt to always return 0, producing "AAAAA" every time
    jest.spyOn(crypto, 'randomInt').mockImplementation(
      ((_min: unknown, _max: unknown): number => {
        callCount++;
        return 0;
      }) as typeof crypto.randomInt,
    );

    const existingCodes = new Set(['AAAAA']);

    expect(() => generateUniqueSupplierCode(existingCodes)).toThrow(
      /Failed to generate unique supplier code/,
    );
    // Should have tried 10 times (MAX_RETRIES) * 5 chars = 50 calls to randomInt
    expect(callCount).toBe(50);
  });

  it('should generate different codes on successive calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateUniqueSupplierCode(codes));
    }
    expect(codes.size).toBe(20);
  });
});
