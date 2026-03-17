import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Persist workflow state to a JSON file so it survives HMR / server restarts.
const PERSIST_PATH = path.join(os.tmpdir(), 'codepilot-workflow-state.json');

function loadFromDisk(): Record<string, unknown> | null {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (data && data.meta && data.phases) return data;
    }
  } catch { /* corrupt file, ignore */ }
  return null;
}

function saveToDisk(workflow: Record<string, unknown> | null): void {
  try {
    if (workflow) {
      fs.writeFileSync(PERSIST_PATH, JSON.stringify(workflow), 'utf-8');
    } else {
      if (fs.existsSync(PERSIST_PATH)) fs.unlinkSync(PERSIST_PATH);
    }
  } catch { /* best effort */ }
}

// In-memory cache — restored from disk on first GET/POST if null
let currentWorkflow: Record<string, unknown> | null = null;
let restored = false;

function ensureRestored() {
  if (!restored) {
    restored = true;
    if (!currentWorkflow) {
      currentWorkflow = loadFromDisk();
    }
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  ensureRestored();
  return NextResponse.json({ workflow: currentWorkflow }, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  ensureRestored();
  try {
    const body = await request.json();

    if (body.type === 'full') {
      currentWorkflow = body.workflow;
    } else if (body.type === 'phase_update' && currentWorkflow) {
      const phases = (currentWorkflow.phases as Record<string, unknown>[]) || [];
      currentWorkflow = {
        ...currentWorkflow,
        phases: phases.map((p) =>
          p.id === body.phase_id ? { ...p, ...body.data } : p
        ),
      };
      const updatedPhases = currentWorkflow.phases as Record<string, unknown>[];
      (currentWorkflow.meta as Record<string, unknown>).progress = Math.round(
        updatedPhases.reduce(
          (sum: number, p) => sum + ((p.progress as number) || 0),
          0
        ) / updatedPhases.length
      );
    } else if (body.type === 'event' && currentWorkflow) {
      const events = (currentWorkflow.events as unknown[]) || [];
      currentWorkflow = {
        ...currentWorkflow,
        events: [body.event, ...events],
      };
    } else if (body.type === 'role_update' && body.role_id && body.data && currentWorkflow) {
      const roles = (currentWorkflow.roles as Record<string, unknown>[]) || [];
      const role = roles.find((r) => r.id === body.role_id);
      if (role) {
        Object.assign(role, body.data);
      }
    } else if (body.type === 'reset') {
      currentWorkflow = null;
    }

    // Persist every mutation to disk
    saveToDisk(currentWorkflow);

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update workflow',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
