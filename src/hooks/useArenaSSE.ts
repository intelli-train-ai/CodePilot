'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { authFetch } from '@/lib/api-client';
import type {
  ArenaUIMessage,
  ArenaRunUIStatus,
  RunParams,
  UseArenaSSEReturn,
} from '@/components/arena/types';
import type { GraderOutput } from '@/arena/schemas/grader-output';
import type { ArenaSSEEvent } from '@/arena/types';

/**
 * Arena SSE consumption hook.
 *
 * Connects to POST /api/arena/run via authFetch, parses the SSE stream,
 * and exposes messages / status / grade / streaming delta to the UI.
 */
export function useArenaSSE(): UseArenaSSEReturn {
  const [messages, setMessages] = useState<ArenaUIMessage[]>([]);
  const [streamingDelta, setStreamingDelta] = useState('');
  const [currentTurn, setCurrentTurn] = useState(0);
  const [status, setStatus] = useState<ArenaRunUIStatus>('idle');
  const [grade, setGrade] = useState<GraderOutput | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{
    totalUsed: number;
    remaining: number;
  } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Clean up on unmount — abort any in-flight SSE connection
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  /**
   * Handle a single parsed SSE event and update React state accordingly.
   */
  const handleEvent = useCallback((event: ArenaSSEEvent) => {
    const { type, data } = event;

    switch (type) {
      case 'run_started': {
        const d = data as { runId: string };
        setRunId(d.runId);
        setStatus('running');
        break;
      }

      case 'gatekeeper_message': {
        const d = data as { content: string; turn: number };
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'gatekeeper',
            content: d.content,
            turn: d.turn,
          },
        ]);
        break;
      }

      case 'challenger_delta': {
        const d = data as { delta: string };
        setStreamingDelta((prev) => prev + d.delta);
        break;
      }

      case 'challenger_message': {
        const d = data as { content: string; turn: number };
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'challenger',
            content: d.content,
            turn: d.turn,
          },
        ]);
        setStreamingDelta('');
        break;
      }

      case 'turn_completed': {
        const d = data as { turn: number };
        setCurrentTurn(d.turn);
        break;
      }

      case 'grading_started': {
        setStatus('grading');
        break;
      }

      case 'grade_result': {
        setGrade(data as GraderOutput);
        break;
      }

      case 'run_completed': {
        setStatus('completed');
        break;
      }

      case 'run_error': {
        const d = data as { error: string };
        setStatus('error');
        setError(d.error);
        break;
      }

      case 'token_usage': {
        const d = data as { totalUsed: number; remaining: number };
        setTokenUsage({ totalUsed: d.totalUsed, remaining: d.remaining });
        break;
      }

      default:
        break;
    }
  }, []);

  /**
   * Start an Arena run — POST to /api/arena/run and consume the SSE stream.
   */
  const startRun = useCallback(
    async (params: RunParams) => {
      // Abort any existing run
      abortRef.current?.abort();

      // Reset all state
      setMessages([]);
      setStreamingDelta('');
      setCurrentTurn(0);
      setStatus('idle');
      setGrade(null);
      setTokenUsage(null);
      setRunId(null);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await authFetch('/api/arena/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worldId: params.worldId,
            levelId: params.levelId,
            gatekeeper: { providerId: params.gatekeeperProviderId, model: params.gatekeeperModel },
            challenger: { providerId: params.challengerProviderId, model: params.challengerModel },
            grader: { providerId: params.graderProviderId, model: params.graderModel },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => 'Unknown error');
          setStatus('error');
          setError(`HTTP ${response.status}: ${text}`);
          return;
        }

        const body = response.body;
        if (!body) {
          setStatus('error');
          setError('No response body');
          return;
        }

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            try {
              const event: ArenaSSEEvent = JSON.parse(line.slice(6));
              handleEvent(event);
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Intentional cancellation — not an error
          return;
        }
        setStatus('error');
        setError(
          err instanceof Error ? err.message : 'Connection lost',
        );
      }
    },
    [handleEvent],
  );

  /**
   * Cancel the current run by aborting the SSE connection.
   */
  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('error');
    setError('Run cancelled');
  }, []);

  return {
    messages,
    streamingDelta,
    currentTurn,
    status,
    grade,
    tokenUsage,
    runId,
    error,
    startRun,
    cancelRun,
  };
}
