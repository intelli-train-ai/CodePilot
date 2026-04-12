/**
 * Challenger LLM call module (ORCH-01).
 *
 * Async generator that yields text deltas for real-time SSE streaming,
 * then returns fullContent + real usage via return value.
 *
 * Directly calls AI SDK streamText (not streamTextFromProvider) because:
 * 1. We need result.usage for real token accounting (streamTextFromProvider doesn't expose usage)
 * 2. We need the messages parameter for conversation history
 *
 * Still uses buildAiModel for unified provider resolution (per INTG-01).
 */

import { streamText } from 'ai';
import { buildAiModel } from './model-builder';
import type { LevelConfig } from '../schemas/level-config';

/** Each delta yielded by the async generator */
export interface ChallengerDelta {
  text: string;
}

/** Complete result returned when the generator finishes */
export interface ChallengerResult {
  fullContent: string;
  usage: { totalTokens: number; promptTokens: number; completionTokens: number };
}

/**
 * Call Challenger LLM with streaming response.
 *
 * Returns an async generator:
 * - yield ChallengerDelta (real-time text chunks for SSE challenger_delta events)
 * - return ChallengerResult (fullContent + real usage stats after stream ends)
 *
 * The orchestrator consumes via: for await (const delta of callChallenger(...))
 * and retrieves the final result from the generator's return value.
 *
 * @param opts.transcript - conversation history including latest Gatekeeper message
 * @param opts.level - level configuration with Challenger system prompt
 * @param opts.abortSignal - optional abort signal
 */
export async function* callChallenger(opts: {
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>;
  level: LevelConfig;
  abortSignal?: AbortSignal;
}): AsyncGenerator<ChallengerDelta, ChallengerResult> {
  const model = buildAiModel(
    opts.level.roleConfig?.challenger?.providerId || '',
    opts.level.roleConfig?.challenger?.model || '',
  );

  // Combine client disconnect signal with per-call timeout so both work
  const timeoutSignal = AbortSignal.timeout(120_000);
  const abortSignal = opts.abortSignal
    ? AbortSignal.any([opts.abortSignal, timeoutSignal])
    : timeoutSignal;

  const result = streamText({
    model,
    system: opts.level.challengerSystemPrompt,
    messages: opts.transcript,
    maxOutputTokens: 4096,
    abortSignal,
  });

  const chunks: string[] = [];
  for await (const chunk of result.textStream) {
    chunks.push(chunk);
    yield { text: chunk };
  }

  // After stream ends, get real usage (result.usage is a Promise, resolved by now)
  const usage = await result.usage;
  const fullContent = chunks.join('');

  return {
    fullContent,
    usage: {
      totalTokens: usage.totalTokens ?? 0,
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
    },
  };
}
