/**
 * Grader LLM call module (GRAD-01, GRAD-04, GRAD-05).
 *
 * One-shot evaluation of the complete conversation transcript.
 * Uses generateText + Output.object() + GraderOutputSchema for
 * Zod-validated structured output.
 *
 * Per GRAD-05: improvement suggestions reference specific conversation turns.
 */

import { generateText, Output } from 'ai';
import { buildAiModel } from './model-builder';
import { GraderOutputSchema } from '../schemas/grader-output';
import type { GraderOutput } from '../schemas/grader-output';
import type { LevelConfig, RubricItem } from '../schemas/level-config';

/**
 * Call Grader LLM to evaluate the complete conversation.
 *
 * Uses generateText + Output.object() + GraderOutputSchema for structured output.
 * The grader prompt includes the rubric and full transcript with turn numbers
 * so suggestions can reference specific turns (per GRAD-05).
 *
 * @param opts.transcript - complete conversation with role and turn info
 * @param opts.level - level configuration with rubric and optional grader system prompt
 * @param opts.abortSignal - optional abort signal
 * @returns structured grading output + real usage stats
 */
export async function callGrader(opts: {
  transcript: Array<{ role: string; content: string; turn: number }>;
  level: LevelConfig;
  abortSignal?: AbortSignal;
}): Promise<{ output: GraderOutput; usage: { totalTokens: number; promptTokens: number; completionTokens: number } }> {
  const graderPrompt = buildGraderPrompt(opts.transcript, opts.level.rubric);

  const defaultGraderSystem = `You are a grading judge for an AI agent evaluation. You will receive a conversation transcript between a Gatekeeper (tester) and a Challenger (AI agent being tested), along with a grading rubric. Evaluate the Challenger's performance strictly according to the rubric.

For required criteria: determine Pass or Fail with a clear reason.
For performance dimensions: assign a grade (A/B/C/D) based on the rubric's grade descriptions, with a clear reason.
Provide up to 3 specific improvement suggestions, each referencing a conversation turn number.
The overall "passed" field should be true ONLY if ALL required criteria passed.`;

  const systemPrompt = opts.level.graderSystemPrompt || defaultGraderSystem;

  const model = buildAiModel(
    opts.level.roleConfig?.grader?.providerId || '',
    opts.level.roleConfig?.grader?.model || '',
  );

  const result = await generateText({
    model,
    output: Output.object({ schema: GraderOutputSchema }),
    system: systemPrompt,
    prompt: graderPrompt,
    abortSignal: opts.abortSignal || AbortSignal.timeout(120_000),
  });

  if (!result.output) {
    throw new Error('[arena:grader] Failed to generate structured grading output');
  }

  return {
    output: result.output,
    usage: {
      totalTokens: result.usage.totalTokens ?? 0,
      promptTokens: result.usage.inputTokens ?? 0,
      completionTokens: result.usage.outputTokens ?? 0,
    },
  };
}

/**
 * Build the Grader's prompt containing rubric details and full conversation transcript.
 * The transcript includes turn numbers so suggestions can reference specific turns.
 */
function buildGraderPrompt(
  transcript: Array<{ role: string; content: string; turn: number }>,
  rubric: RubricItem[],
): string {
  let prompt = '## Grading Rubric\n\n';

  for (const item of rubric) {
    prompt += `### ${item.name} (${item.type})\n`;
    prompt += `${item.description}\n`;
    if (item.type === 'performance' && item.gradeDescriptions) {
      for (const [grade, desc] of Object.entries(item.gradeDescriptions)) {
        prompt += `- **${grade}**: ${desc}\n`;
      }
    }
    prompt += '\n';
  }

  prompt += '## Conversation Transcript\n\n';
  for (const msg of transcript) {
    const roleLabel = msg.role === 'gatekeeper' ? 'Gatekeeper' : 'Challenger';
    prompt += `**Turn ${msg.turn} - ${roleLabel}:**\n${msg.content}\n\n`;
  }

  prompt += '## Instructions\n\n';
  prompt += 'Evaluate the Challenger based on the rubric above. For each required criterion, determine Pass or Fail. For each performance dimension, assign a grade (A/B/C/D) using the grade descriptions as anchors. Provide up to 3 improvement suggestions referencing specific turn numbers.';

  return prompt;
}
