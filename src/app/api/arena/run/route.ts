import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { runArenaOrchestration } from '@/arena/engine/orchestrator';
import { formatArenaSSE } from '@/arena/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/arena/run
 *
 * Start an Arena run. Returns an SSE stream with real-time progress events.
 *
 * Request body:
 * {
 *   worldId: string;       // World ID
 *   levelId: string;       // Level ID
 *   providerId?: string;   // Default provider (optional, level config takes priority)
 *   model?: string;        // Default model (optional, level config takes priority)
 * }
 *
 * Response: text/event-stream
 * Events: run_started, gatekeeper_message, challenger_delta, challenger_message,
 *         turn_completed, grading_started, grade_result, run_completed, run_error, token_usage
 */
export async function POST(request: NextRequest) {
  // Auth check (reuses project's requireAuth pattern from src/lib/auth.ts)
  const authError = requireAuth(request);
  if (authError) return authError;

  // Parse request body
  let body: { worldId: string; levelId: string; providerId?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate required fields (T-04-02: input validation before passing to orchestrator)
  if (!body.worldId || typeof body.worldId !== 'string') {
    return new Response(JSON.stringify({ error: 'worldId is required and must be a string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!body.levelId || typeof body.levelId !== 'string') {
    return new Response(JSON.stringify({ error: 'levelId is required and must be a string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create AbortController to propagate client disconnect (T-04-03)
  const abortController = new AbortController();
  request.signal.addEventListener('abort', () => abortController.abort());

  // Create SSE ReadableStream
  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        const orchestration = runArenaOrchestration({
          worldId: body.worldId,
          levelId: body.levelId,
          defaultProviderId: body.providerId,
          defaultModel: body.model,
          abortSignal: abortController.signal,
        });

        for await (const event of orchestration) {
          try {
            controller.enqueue(formatArenaSSE(event));
          } catch {
            // Controller already closed (client disconnected), exit gracefully
            break;
          }
        }
      } catch (err) {
        // T-04-04: only expose err.message, never stack traces
        try {
          controller.enqueue(formatArenaSSE({
            type: 'run_error',
            data: { error: err instanceof Error ? err.message : String(err) },
          }));
        } catch { /* controller already closed */ }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
