/**
 * Unit tests for Arena TokenTracker.
 *
 * Pure logic tests -- no LLM or DB mocking needed.
 * Verifies budget tracking, consumption, exhaustion detection.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('TokenTracker', () => {
  it('Test 1: initialized with budget=200000, remaining returns 200000', async () => {
    const { TokenTracker } = await import('@/arena/engine/token-tracker');
    const tracker = new TokenTracker();
    assert.equal(tracker.remaining, 200_000);
  });

  it('Test 2: consume(5000) reduces remaining by 5000', async () => {
    const { TokenTracker } = await import('@/arena/engine/token-tracker');
    const tracker = new TokenTracker();
    tracker.consume(5000);
    assert.equal(tracker.remaining, 195_000);
  });

  it('Test 3: isExhausted returns true when remaining <= 0', async () => {
    const { TokenTracker } = await import('@/arena/engine/token-tracker');
    const tracker = new TokenTracker(100);
    assert.equal(tracker.isExhausted, false);
    tracker.consume(100);
    assert.equal(tracker.isExhausted, true);
    tracker.consume(1);
    assert.equal(tracker.isExhausted, true);
  });

  it('Test 4: hasEnoughFor(estimatedTokens) returns false when remaining < estimatedTokens', async () => {
    const { TokenTracker } = await import('@/arena/engine/token-tracker');
    const tracker = new TokenTracker(1000);
    assert.equal(tracker.hasEnoughFor(500), true);
    assert.equal(tracker.hasEnoughFor(1000), true);
    assert.equal(tracker.hasEnoughFor(1001), false);
    tracker.consume(800);
    assert.equal(tracker.hasEnoughFor(200), true);
    assert.equal(tracker.hasEnoughFor(201), false);
  });

  it('Test 5: totalUsed returns sum of all consumed tokens', async () => {
    const { TokenTracker } = await import('@/arena/engine/token-tracker');
    const tracker = new TokenTracker();
    assert.equal(tracker.totalUsed, 0);
    tracker.consume(1000);
    tracker.consume(2000);
    tracker.consume(500);
    assert.equal(tracker.totalUsed, 3500);
  });

  it('Test 6: custom budget via constructor overrides default 200000', async () => {
    const { TokenTracker } = await import('@/arena/engine/token-tracker');
    const tracker = new TokenTracker(50_000);
    assert.equal(tracker.remaining, 50_000);
    tracker.consume(50_000);
    assert.equal(tracker.isExhausted, true);
  });

  it('Test 7: hasEnoughForNextTurn accounts for GRADER_RESERVE', async () => {
    const { TokenTracker } = await import('@/arena/engine/token-tracker');
    // Budget of 10000, GRADER_RESERVE is 8000
    const tracker = new TokenTracker(10_000);
    assert.equal(tracker.hasEnoughForNextTurn(), true); // 10000 > 8000
    tracker.consume(2000);
    assert.equal(tracker.hasEnoughForNextTurn(), false); // 8000 > 8000 is false (strictly greater)
    // Actually 8000 remaining, 8000 reserve, so NOT enough
    // hasEnoughForNextTurn checks remaining > GRADER_RESERVE
    // 8000 > 8000 = false -- exact boundary is NOT enough
    assert.equal(tracker.remaining, 8000);
    // The implementation should check remaining > GRADER_RESERVE (strictly greater)
    // so 8000 remaining with 8000 reserve = false
  });
});
