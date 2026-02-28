import { computeSHA256, computeAuditChainHash, getGenesisHash } from '../../src/shared/utils/hash';

describe('Hash Utilities', () => {
  describe('computeSHA256', () => {
    it('should produce consistent output for same input', () => {
      const hash1 = computeSHA256('test data');
      const hash2 = computeSHA256('test data');
      expect(hash1).toBe(hash2);
    });

    it('should produce a 64-character hex string', () => {
      const hash = computeSHA256('test data');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = computeSHA256('input one');
      const hash2 = computeSHA256('input two');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('computeAuditChainHash', () => {
    it('should use genesis hash when no previous hash provided', () => {
      const eventData = { action: 'test', userId: 'user-1' };
      const hash = computeAuditChainHash(eventData, null);
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });

    it('should include previous hash in computation', () => {
      const eventData = { action: 'test', userId: 'user-1' };
      const hash1 = computeAuditChainHash(eventData, null);
      const hash2 = computeAuditChainHash(eventData, 'previous-hash-value');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different event data', () => {
      const hash1 = computeAuditChainHash({ action: 'create' }, null);
      const hash2 = computeAuditChainHash({ action: 'delete' }, null);
      expect(hash1).not.toBe(hash2);
    });

    it('should form a verifiable chain', () => {
      const event1 = { action: 'first' };
      const hash1 = computeAuditChainHash(event1, null);

      const event2 = { action: 'second' };
      const hash2 = computeAuditChainHash(event2, hash1);

      const event3 = { action: 'third' };
      const hash3 = computeAuditChainHash(event3, hash2);

      // Verify chain by recomputing
      const recomputedHash1 = computeAuditChainHash(event1, null);
      expect(recomputedHash1).toBe(hash1);

      const recomputedHash2 = computeAuditChainHash(event2, recomputedHash1);
      expect(recomputedHash2).toBe(hash2);

      const recomputedHash3 = computeAuditChainHash(event3, recomputedHash2);
      expect(recomputedHash3).toBe(hash3);
    });

    it('should detect tampering in the middle of the chain', () => {
      const event1 = { action: 'first' };
      const hash1 = computeAuditChainHash(event1, null);

      const event2 = { action: 'second' };
      const hash2 = computeAuditChainHash(event2, hash1);

      // Tamper with event2 data
      const tamperedEvent2 = { action: 'tampered' };
      const tamperedHash2 = computeAuditChainHash(tamperedEvent2, hash1);

      // Hashes should differ
      expect(tamperedHash2).not.toBe(hash2);
    });
  });

  describe('getGenesisHash', () => {
    it('should return a deterministic genesis hash', () => {
      const genesis1 = getGenesisHash();
      const genesis2 = getGenesisHash();
      expect(genesis1).toBe(genesis2);
    });

    it('should be the SHA-256 of "GENESIS"', () => {
      const genesis = getGenesisHash();
      const expected = computeSHA256('GENESIS');
      expect(genesis).toBe(expected);
    });
  });
});
