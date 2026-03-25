import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { detectAllCliTools } from '@/lib/cli-tools-detect';
import { getExpandedPath } from '@/lib/platform';
import { requireAuth } from '@/lib/auth';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

async function detectBrew(): Promise<boolean> {
  try {
    await execFileAsync('/usr/bin/which', ['brew'], {
      timeout: 3000,
      env: { ...process.env, PATH: getExpandedPath() },
    });
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const [{ catalog, extra }, hasBrew] = await Promise.all([
      detectAllCliTools(),
      detectBrew(),
    ]);
    return NextResponse.json({
      tools: catalog,
      extra,
      platform: process.platform,
      hasBrew,
    });
  } catch (error) {
    console.error('[cli-tools/installed] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Detection failed' },
      { status: 500 }
    );
  }
}
