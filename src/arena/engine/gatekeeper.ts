/**
 * Gatekeeper LLM call module (ORCH-02).
 *
 * Uses generateText + Output.object() for structured output with shouldEnd field.
 * Parse failure retries once then returns null (per D-02).
 *
 * Usage from generateText result:
 *   result.usage contains { promptTokens, completionTokens, totalTokens }
 *   This is the authoritative source of Gatekeeper token usage.
 */

import { generateText, Output } from 'ai';
import { buildAiModel } from './model-builder';
import { GatekeeperOutputSchema } from '../schemas/gatekeeper-output';
import type { GatekeeperOutput } from '../schemas/gatekeeper-output';
import type { LevelConfig } from '../schemas/level-config';

export interface GatekeeperCallResult {
  output: GatekeeperOutput;
  usage: { totalTokens: number; promptTokens: number; completionTokens: number };
}

/**
 * Call Gatekeeper LLM to produce structured output (message + shouldEnd).
 *
 * Uses generateText (not streamText) because we need the complete shouldEnd
 * value before deciding whether to continue the orchestration loop.
 *
 * Per D-02: parse failure retries once, then returns null to signal parse_failure.
 *
 * @param opts.transcript - conversation history so far
 * @param opts.level - level configuration with Gatekeeper system prompt
 * @param opts.abortSignal - optional abort signal
 * @returns GatekeeperCallResult or null on parse failure
 */
export async function callGatekeeper(opts: {
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>;
  level: LevelConfig;
  abortSignal?: AbortSignal;
}): Promise<GatekeeperCallResult | null> {
  const model = buildAiModel(
    opts.level.roleConfig?.gatekeeper?.providerId || '',
    opts.level.roleConfig?.gatekeeper?.model || '',
  );

  // Retry logic: per D-02, attempt up to 2 times
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: GatekeeperOutputSchema }),
        system: opts.level.gatekeeperSystemPrompt,
        messages: opts.transcript,
        abortSignal: opts.abortSignal || AbortSignal.timeout(60_000),
      });

      if (!result.output) {
        // Output.object() returns null when structured output parse fails
        if (attempt === 0) continue; // retry once
        return null;
      }

      return {
        output: result.output,
        usage: {
          totalTokens: result.usage.totalTokens ?? 0,
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
        },
      };
    } catch (err) {
      if (attempt === 0) continue; // retry once
      console.warn('[arena:gatekeeper] Structured output failed after 2 attempts:', err);
      return null;
    }
  }
  return null;
}
