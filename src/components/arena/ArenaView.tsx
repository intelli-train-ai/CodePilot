'use client';

import { useState, useCallback, useEffect } from 'react';
import { useArenaSSE } from '@/hooks/useArenaSSE';
import { LevelCardList } from './LevelCardList';
import { RunControls } from './RunControls';
import { ConversationStream } from './ConversationStream';
import type { ArenaViewState, RunParams, ArenaLevelInfo } from './types';

export function ArenaView() {
  const [viewState, setViewState] = useState<ArenaViewState>({ phase: 'levels' });
  const [selectedLevel, setSelectedLevel] = useState<{ worldId: string; level: ArenaLevelInfo } | null>(null);
  const [showRunControls, setShowRunControls] = useState(false);
  const arenaSSE = useArenaSSE();

  const handleSelectLevel = useCallback((worldId: string, level: ArenaLevelInfo) => {
    // Store full ArenaLevelInfo object so name/description/maxTurns are available
    // for RunControls and later for ConversationStream (Plan 03)
    setSelectedLevel({ worldId, level });
    setShowRunControls(true);
  }, []);

  const handleStartRun = useCallback(async (params: RunParams) => {
    setShowRunControls(false);
    setViewState({ phase: 'running', runId: '', levelId: params.levelId });
    await arenaSSE.startRun(params);
    // run_started SSE event will update runId via the hook
  }, [arenaSSE]);

  const handleBack = useCallback(() => {
    setShowRunControls(false);
    setSelectedLevel(null);
    setViewState({ phase: 'levels' });
  }, []);

  // Sync viewState with arenaSSE.status changes
  useEffect(() => {
    if (arenaSSE.status === 'completed' || arenaSSE.status === 'error') {
      setViewState((prev) => {
        if (prev.phase === 'running') {
          return { phase: 'completed', runId: prev.runId, levelId: prev.levelId };
        }
        return prev;
      });
    }
  }, [arenaSSE.status]);

  // Sync runId from arenaSSE hook
  useEffect(() => {
    if (arenaSSE.runId) {
      setViewState((prev) => {
        if (prev.phase === 'running') {
          return { ...prev, runId: arenaSSE.runId! };
        }
        return prev;
      });
    }
  }, [arenaSSE.runId]);

  if (showRunControls && selectedLevel) {
    return (
      <div className="flex h-full flex-col p-6">
        <RunControls
          levelId={selectedLevel.level.id}
          levelName={selectedLevel.level.name}
          levelDescription={selectedLevel.level.description}
          maxTurns={selectedLevel.level.maxTurns}
          worldId={selectedLevel.worldId}
          onStart={handleStartRun}
          onBack={handleBack}
        />
      </div>
    );
  }

  switch (viewState.phase) {
    case 'levels':
      return (
        <div className="flex h-full flex-col p-6">
          <LevelCardList onSelectLevel={handleSelectLevel} />
        </div>
      );
    case 'running':
    case 'completed':
      return (
        <div className="flex h-full flex-col">
          <ConversationStream
            messages={arenaSSE.messages}
            streamingDelta={arenaSSE.streamingDelta}
            currentTurn={arenaSSE.currentTurn}
            maxTurns={selectedLevel?.level.maxTurns ?? 10}
            status={arenaSSE.status}
            tokenCount={arenaSSE.tokenUsage?.totalUsed ?? 0}
            grade={arenaSSE.grade}
            error={arenaSSE.error}
            onStop={arenaSSE.cancelRun}
            onBack={handleBack}
          />
        </div>
      );
  }
}
