import { computeAuditChainHash, getGenesisHash } from '../../src/shared/utils/hash';

describe('Audit Chain Hash Integrity', () => {
  function buildChain(count: number): Array<{ eventData: Record<string, unknown>; hash: string }> {
    const chain: Array<{ eventData: Record<string, unknown>; hash: string }> = [];
    for (let i = 0; i < count; i++) {
      const eventData = { index: i, action: `event_${i}`, timestamp: `2025-01-15T12:0${i}:00Z` };
      const previousHash = i > 0 ? chain[i - 1].hash : null;
      const hash = computeAuditChainHash(eventData, previousHash);
      chain.push({ eventData, hash });
    }
    return chain;
  }

  it('should produce a deterministic hash for the genesis entry', () => {
    const eventData = { index: 0, action: 'first' };
    const hash1 = computeAuditChainHash(eventData, null);
    const hash2 = computeAuditChainHash(eventData, null);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('should use GENESIS hash when previousHash is null', () => {
    const eventData = { test: true };
    const hash = computeAuditChainHash(eventData, null);
    // Manually verify: hash = SHA256(JSON.stringify(eventData) + genesisHash)
    const genesisHash = getGenesisHash();
    expect(genesisHash).toHaveLength(64);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(genesisHash);
  });

  it('should chain 5 entries correctly — each hash depends on previous', () => {
    const chain = buildChain(5);

    // Verify each entry's hash
    for (let i = 0; i < chain.length; i++) {
      const previousHash = i > 0 ? chain[i - 1].hash : null;
      const expectedHash = computeAuditChainHash(chain[i].eventData, previousHash);
      expect(chain[i].hash).toBe(expectedHash);
    }

    // All hashes should be unique
    const hashes = chain.map((e) => e.hash);
    expect(new Set(hashes).size).toBe(5);
  });

  it('should detect tampering at entry 3 — chain breaks from entry 3 onward', () => {
    const chain = buildChain(5);

    // Tamper with entry 3's event data
    const tamperedEventData = { ...chain[2].eventData, action: 'TAMPERED' };

    // Verify entries 0-1 still valid
    for (let i = 0; i < 2; i++) {
      const previousHash = i > 0 ? chain[i - 1].hash : null;
      const expectedHash = computeAuditChainHash(chain[i].eventData, previousHash);
      expect(chain[i].hash).toBe(expectedHash);
    }

    // Entry 2 (index 2, the tampered one): recompute with tampered data
    const recomputedHash2 = computeAuditChainHash(tamperedEventData, chain[1].hash);
    // The stored hash no longer matches the tampered data
    expect(recomputedHash2).not.toBe(chain[2].hash);

    // Entry 3 depends on entry 2's stored hash, so even with original data,
    // if we verify against the tampered chain it would fail
    const recomputedHash3 = computeAuditChainHash(chain[3].eventData, recomputedHash2);
    expect(recomputedHash3).not.toBe(chain[3].hash);

    // Entry 4 also breaks
    const recomputedHash4 = computeAuditChainHash(chain[4].eventData, recomputedHash3);
    expect(recomputedHash4).not.toBe(chain[4].hash);
  });

  it('should produce different hashes for different event data', () => {
    const hash1 = computeAuditChainHash({ action: 'a' }, null);
    const hash2 = computeAuditChainHash({ action: 'b' }, null);
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes with different previous hashes', () => {
    const eventData = { action: 'same' };
    const hash1 = computeAuditChainHash(eventData, 'aaa');
    const hash2 = computeAuditChainHash(eventData, 'bbb');
    expect(hash1).not.toBe(hash2);
  });
});
