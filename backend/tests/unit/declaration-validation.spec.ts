import {
  acceptRfqSchema,
  declineRfqSchema,
  assignSuppliersSchema,
} from '../../src/shared/validators/rfq.validators';

describe('Declaration Validation', () => {
  describe('acceptRfqSchema', () => {
    it('should pass when all three declarations are true', () => {
      const result = acceptRfqSchema.safeParse({
        declaration_rfq_terms: true,
        declaration_no_collusion: true,
        declaration_confidentiality: true,
      });
      expect(result.success).toBe(true);
    });

    it('should fail when declaration_rfq_terms is false', () => {
      const result = acceptRfqSchema.safeParse({
        declaration_rfq_terms: false,
        declaration_no_collusion: true,
        declaration_confidentiality: true,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when declaration_no_collusion is false', () => {
      const result = acceptRfqSchema.safeParse({
        declaration_rfq_terms: true,
        declaration_no_collusion: false,
        declaration_confidentiality: true,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when declaration_confidentiality is false', () => {
      const result = acceptRfqSchema.safeParse({
        declaration_rfq_terms: true,
        declaration_no_collusion: true,
        declaration_confidentiality: false,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when declaration_rfq_terms is missing', () => {
      const result = acceptRfqSchema.safeParse({
        declaration_no_collusion: true,
        declaration_confidentiality: true,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when declaration_no_collusion is missing', () => {
      const result = acceptRfqSchema.safeParse({
        declaration_rfq_terms: true,
        declaration_confidentiality: true,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when declaration_confidentiality is missing', () => {
      const result = acceptRfqSchema.safeParse({
        declaration_rfq_terms: true,
        declaration_no_collusion: true,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when value is string "true" instead of boolean true', () => {
      const result = acceptRfqSchema.safeParse({
        declaration_rfq_terms: 'true',
        declaration_no_collusion: true,
        declaration_confidentiality: true,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when all declarations are missing', () => {
      const result = acceptRfqSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('declineRfqSchema', () => {
    it('should pass with reason >= 20 characters', () => {
      const result = declineRfqSchema.safeParse({
        reason: 'This is a sufficient decline reason text.',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with exactly 20 characters', () => {
      const result = declineRfqSchema.safeParse({
        reason: '12345678901234567890',
      });
      expect(result.success).toBe(true);
    });

    it('should fail with reason < 20 characters', () => {
      const result = declineRfqSchema.safeParse({
        reason: 'Too short',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('at least 20 characters');
      }
    });

    it('should fail without reason', () => {
      const result = declineRfqSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should fail with empty reason', () => {
      const result = declineRfqSchema.safeParse({ reason: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('assignSuppliersSchema', () => {
    it('should pass with 2 valid UUIDs', () => {
      const result = assignSuppliersSchema.safeParse({
        supplier_ids: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should pass with 5 valid UUIDs', () => {
      const result = assignSuppliersSchema.safeParse({
        supplier_ids: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003',
          '550e8400-e29b-41d4-a716-446655440004',
          '550e8400-e29b-41d4-a716-446655440005',
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should fail with only 1 supplier_id', () => {
      const result = assignSuppliersSchema.safeParse({
        supplier_ids: ['550e8400-e29b-41d4-a716-446655440001'],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('At least 2 suppliers');
      }
    });

    it('should fail with empty array', () => {
      const result = assignSuppliersSchema.safeParse({
        supplier_ids: [],
      });
      expect(result.success).toBe(false);
    });

    it('should fail with non-UUID strings', () => {
      const result = assignSuppliersSchema.safeParse({
        supplier_ids: ['not-a-uuid', 'also-not-a-uuid'],
      });
      expect(result.success).toBe(false);
    });

    it('should fail without supplier_ids', () => {
      const result = assignSuppliersSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
