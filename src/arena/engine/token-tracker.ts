/**
 * Token budget tracking across all Arena roles (ORCH-04, D-03).
 *
 * Accumulates real usage from Gatekeeper, Challenger, and Grader calls.
 * Default budget is 200,000 tokens, overridable by level maxTokens config.
 * Reserves 8,000 tokens for Grader to ensure evaluation can complete.
 */

/** Default token budget per run (per D-03) */
const DEFAULT_TOKEN_BUDGET = 200_000;

/** Reserved token space for Grader evaluation */
const GRADER_RESERVE = 8_000;

export class TokenTracker {
  private budget: number;
  private used: number = 0;

  constructor(budget?: number) {
    this.budget = budget ?? DEFAULT_TOKEN_BUDGET;
  }

  /** Record token consumption from an LLM call */
  consume(tokens: number): void {
    this.used += tokens;
  }

  /** Remaining available tokens */
  get remaining(): number {
    return this.budget - this.used;
  }

  /** Total tokens consumed so far */
  get totalUsed(): number {
    return this.used;
  }

  /** Whether the budget is fully exhausted */
  get isExhausted(): boolean {
    return this.remaining <= 0;
  }

  /** Whether there are enough tokens for another turn (accounting for Grader reserve) */
  hasEnoughForNextTurn(): boolean {
    return this.remaining > GRADER_RESERVE;
  }

  /** Whether there are enough tokens for a specific operation */
  hasEnoughFor(estimatedTokens: number): boolean {
    return this.remaining >= estimatedTokens;
  }
}
