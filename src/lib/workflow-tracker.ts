/**
 * Workflow Tracker — tracks Claude Code workflow execution for visualization.
 * Pushes state to /api/workflow-status which is then consumed by situation-monitor via iframe postMessage.
 */

interface WorkflowTrackerOptions {
  baseUrl?: string;
}

export class WorkflowTracker {
  private baseUrl: string;

  constructor(opts: WorkflowTrackerOptions = {}) {
    this.baseUrl = opts.baseUrl || 'http://localhost:3000';
  }

  /** Initialize a new workflow tracking session */
  async startWorkflow(workflow: Record<string, unknown>): Promise<void> {
    await this.push({ type: 'full', workflow });
  }

  /** Update a specific phase's status */
  async updatePhase(
    phaseId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.push({ type: 'phase_update', phase_id: phaseId, data });
  }

  /** Add an event to the workflow log */
  async addEvent(event: {
    id: string;
    timestamp: string;
    phase_id: string;
    type:
      | 'phase_start'
      | 'phase_complete'
      | 'asset_created'
      | 'quality_check'
      | 'error'
      | 'retry';
    message: string;
    details?: string;
  }): Promise<void> {
    await this.push({ type: 'event', event });
  }

  /** Reset/clear the current workflow */
  async reset(): Promise<void> {
    await this.push({ type: 'reset' });
  }

  /** Get current workflow state from the API */
  async getState(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/workflow-status`);
      const data = await res.json();
      return data.workflow;
    } catch {
      return null;
    }
  }

  private async push(body: Record<string, unknown>): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/workflow-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.warn('[workflow-tracker] Failed to push state:', e);
    }
  }
}

/** Singleton instance */
export const workflowTracker = new WorkflowTracker();
