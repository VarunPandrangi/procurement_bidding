import { updateWeightsSchema } from '../../src/shared/validators/kpi.validators';

describe('Weight validation', () => {
  describe('updateWeightsSchema', () => {
    it('should accept valid weights that sum to 100: {40, 40, 20}', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: 40,
        weight_delivery: 40,
        weight_payment: 20,
      });
      expect(result.success).toBe(true);
    });

    it('should reject weights that sum to 101: {40, 40, 21} → WEIGHTS_MUST_SUM_TO_100', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: 40,
        weight_delivery: 40,
        weight_payment: 21,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.errors.map((e) => e.message);
        expect(messages).toContain('Weights must sum to 100');
      }
    });

    it('should accept weights {100, 0, 0}', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: 100,
        weight_delivery: 0,
        weight_payment: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should reject weights that sum to 0: {0, 0, 0}', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: 0,
        weight_delivery: 0,
        weight_payment: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative weight: {-1, 50, 51}', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: -1,
        weight_delivery: 50,
        weight_payment: 51,
      });
      expect(result.success).toBe(false);
    });

    it('should reject weight over 100: {101, 0, -1}', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: 101,
        weight_delivery: 0,
        weight_payment: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should accept weights {0, 100, 0}', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: 0,
        weight_delivery: 100,
        weight_payment: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should accept weights {0, 0, 100}', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: 0,
        weight_delivery: 0,
        weight_payment: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should accept fractional weights: {33.33, 33.33, 33.34}', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: 33.33,
        weight_delivery: 33.33,
        weight_payment: 33.34,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      const result = updateWeightsSchema.safeParse({
        weight_price: 50,
      });
      expect(result.success).toBe(false);
    });
  });
});
