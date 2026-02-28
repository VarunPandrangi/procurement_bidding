import { computeBidHash, computeSHA256, getGenesisHash } from '../../src/shared/utils/hash';

describe('Bid Hash', () => {
  const baseParams = {
    supplierCode: 'SUP01',
    rfqId: '00000000-0000-0000-0000-000000000001',
    revisionNumber: 0,
    items: [
      { rfqItemId: '00000000-0000-0000-0000-000000000010', unitPrice: 100 },
      { rfqItemId: '00000000-0000-0000-0000-000000000020', unitPrice: 200 },
    ],
    submittedAt: '2026-01-01T10:00:00.000Z',
  };

  describe('Determinism', () => {
    it('should produce the same hash for identical inputs', () => {
      const hash1 = computeBidHash(baseParams);
      const hash2 = computeBidHash(baseParams);
      expect(hash1).toBe(hash2);
    });

    it('should produce consistent hash across multiple calls', () => {
      const hashes = Array.from({ length: 10 }, () => computeBidHash(baseParams));
      const unique = new Set(hashes);
      expect(unique.size).toBe(1);
    });
  });

  describe('Uniqueness — different inputs produce different hashes', () => {
    it('should produce different hash when supplierCode changes', () => {
      const hash1 = computeBidHash(baseParams);
      const hash2 = computeBidHash({ ...baseParams, supplierCode: 'SUP02' });
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hash when rfqId changes', () => {
      const hash1 = computeBidHash(baseParams);
      const hash2 = computeBidHash({ ...baseParams, rfqId: '00000000-0000-0000-0000-000000000002' });
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hash when revisionNumber changes', () => {
      const hash1 = computeBidHash(baseParams);
      const hash2 = computeBidHash({ ...baseParams, revisionNumber: 1 });
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hash when submittedAt changes', () => {
      const hash1 = computeBidHash(baseParams);
      const hash2 = computeBidHash({ ...baseParams, submittedAt: '2026-01-01T10:00:01.000Z' });
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hash when unit price changes', () => {
      const hash1 = computeBidHash(baseParams);
      const hash2 = computeBidHash({
        ...baseParams,
        items: [
          { rfqItemId: '00000000-0000-0000-0000-000000000010', unitPrice: 101 },
          { rfqItemId: '00000000-0000-0000-0000-000000000020', unitPrice: 200 },
        ],
      });
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hash when item order differs', () => {
      const hash1 = computeBidHash(baseParams);
      const hash2 = computeBidHash({
        ...baseParams,
        items: [
          { rfqItemId: '00000000-0000-0000-0000-000000000020', unitPrice: 200 },
          { rfqItemId: '00000000-0000-0000-0000-000000000010', unitPrice: 100 },
        ],
      });
      // Items are serialized in order, so different order = different hash
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Format', () => {
    it('should produce a 64-character hex string (SHA-256)', () => {
      const hash = computeBidHash(baseParams);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Verifiability', () => {
    it('should be verifiable by recomputing with same inputs', () => {
      const original = computeBidHash(baseParams);

      // Simulate verification: recompute from stored parameters
      const recomputed = computeBidHash({
        supplierCode: 'SUP01',
        rfqId: '00000000-0000-0000-0000-000000000001',
        revisionNumber: 0,
        items: [
          { rfqItemId: '00000000-0000-0000-0000-000000000010', unitPrice: 100 },
          { rfqItemId: '00000000-0000-0000-0000-000000000020', unitPrice: 200 },
        ],
        submittedAt: '2026-01-01T10:00:00.000Z',
      });

      expect(recomputed).toBe(original);
    });
  });

  describe('computeSHA256', () => {
    it('should produce 64-character hex', () => {
      const hash = computeSHA256('test');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic', () => {
      expect(computeSHA256('hello')).toBe(computeSHA256('hello'));
    });

    it('should differ for different inputs', () => {
      expect(computeSHA256('hello')).not.toBe(computeSHA256('world'));
    });
  });

  describe('getGenesisHash', () => {
    it('should return a 64-character hex string', () => {
      const genesis = getGenesisHash();
      expect(genesis).toHaveLength(64);
      expect(genesis).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic', () => {
      expect(getGenesisHash()).toBe(getGenesisHash());
    });
  });
});
