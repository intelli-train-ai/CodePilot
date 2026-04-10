import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { loadAllWorlds } from '@/arena/level-loader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/arena/levels
 *
 * Returns all available worlds and their levels.
 *
 * Response:
 * {
 *   worlds: Array<{
 *     id: string;
 *     name: string;
 *     description: string;
 *     icon?: string;
 *     levels: Array<{
 *       id: string;
 *       name: string;
 *       description: string;
 *       maxTurns: number;
 *       rubricCount: number;
 *     }>
 *   }>
 * }
 */
export async function GET(request: NextRequest) {
  // Auth check (reuses project's requireAuth pattern from src/lib/auth.ts)
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const worlds = loadAllWorlds();

    const response = {
      worlds: worlds.map(w => ({
        id: w.config.id,
        name: w.config.name,
        description: w.config.description,
        icon: w.config.icon,
        levels: w.levels.map(l => ({
          id: l.config.id,
          name: l.config.name,
          description: l.config.description,
          maxTurns: l.config.maxTurns,
          rubricCount: l.config.rubric.length,
        })),
      })),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // T-04-04: only expose err.message, never stack traces
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Failed to load levels',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
