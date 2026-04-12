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

const JSON_INSTRUCTION = `\n\nYou MUST respond with a JSON object in this exact format (no markdown, no extra text):
{"message": "your message here", "shouldEnd": false}
Set shouldEnd to true when you want to end the conversation, and optionally add "endReason".`;

/**
 * Try parsing Gatekeeper output from raw text (fallback for providers
 * that don't support Output.object / structured output mode).
 */
function tryParseGatekeeperJson(text: string): GatekeeperOutput | null {
  try {
    // Extract JSON from potential markdown code blocks or surrounding text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    const result = GatekeeperOutputSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Call Gatekeeper LLM to produce structured output (message + shouldEnd).
 *
 * Uses generateText (not streamText) because we need the complete shouldEnd
 * value before deciding whether to continue the orchestration loop.
 *
 * Strategy: try Output.object() first (native structured output), then
 * fallback to prompt-based JSON + manual Zod parse for providers that
 * don't support structured output (e.g. GLM via OpenAI-compatible).
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

  // Combine client disconnect signal with per-call timeout so both work
  const timeoutSignal = AbortSignal.timeout(60_000);
  const abortSignal = opts.abortSignal
    ? AbortSignal.any([opts.abortSignal, timeoutSignal])
    : timeoutSignal;

  // Attempt 1: Output.object() (native structured output)
  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: GatekeeperOutputSchema }),
      system: opts.level.gatekeeperSystemPrompt,
      ...(opts.transcript.length > 0
        ? { messages: opts.transcript }
        : { prompt: 'Begin the conversation.' }),
      abortSignal,
    });

    if (result.output) {
      return {
        output: result.output,
        usage: {
          totalTokens: result.usage.totalTokens ?? 0,
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
        },
      };
    }
  } catch (err) {
    console.warn('[arena:gatekeeper] Output.object() failed, trying prompt-based fallback:', (err as Error).message);
  }

  // Attempt 2: Prompt-based JSON fallback (for providers without structured output)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await generateText({
        model,
        system: opts.level.gatekeeperSystemPrompt + JSON_INSTRUCTION,
        // Use prompt for first turn (empty transcript), messages for subsequent turns
        ...(opts.transcript.length > 0
          ? { messages: opts.transcript }
          : { prompt: 'Begin the conversation. Respond with the JSON format specified in the system prompt.' }),
        abortSignal,
      });

      const parsed = tryParseGatekeeperJson(result.text);
      if (parsed) {
        return {
          output: parsed,
          usage: {
            totalTokens: result.usage.totalTokens ?? 0,
            promptTokens: result.usage.inputTokens ?? 0,
            completionTokens: result.usage.outputTokens ?? 0,
          },
        };
      }

      if (attempt === 0) continue;
      console.warn('[arena:gatekeeper] JSON fallback parse failed after 2 attempts. Raw:', result.text.slice(0, 200));
      return null;
    } catch (err) {
      if (attempt === 0) continue;
      console.warn('[arena:gatekeeper] Fallback failed after 2 attempts:', err);
      return null;
    }
  }
  return null;
}
