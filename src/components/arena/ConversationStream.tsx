'use client';

import { useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowDown, ArrowLeft } from '@phosphor-icons/react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n';
import type { ArenaUIMessage } from './types';
import type { GraderOutput } from '@/arena/schemas/grader-output';
import type { ArenaRunUIStatus } from './types';
import { ArenaBubble } from './ArenaBubble';
import { ArenaStatusBar } from './ArenaStatusBar';
import { GradeReport } from './GradeReport';

interface ConversationStreamProps {
  messages: ArenaUIMessage[];
  streamingDelta: string;
  currentTurn: number;
  maxTurns: number;
  status: ArenaRunUIStatus;
  tokenCount: number;
  grade: GraderOutput | null;
  error: string | null;
  onStop: () => void;
  onBack: () => void;
}

/**
 * Scroll-to-bottom button, shown when user scrolls away from the bottom.
 * Pattern taken from src/components/ai-elements/conversation.tsx.
 */
function ScrollButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <Button
      className="absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full dark:bg-background dark:hover:bg-muted"
      onClick={handleScrollToBottom}
      size="icon"
      type="button"
      variant="outline"
    >
      <ArrowDown className="size-4" />
    </Button>
  );
}

export function ConversationStream({
  messages,
  streamingDelta,
  currentTurn,
  maxTurns,
  status,
  tokenCount,
  grade,
  error,
  onStop,
  onBack,
}: ConversationStreamProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      <ArenaStatusBar
        currentTurn={currentTurn}
        maxTurns={maxTurns}
        status={status}
        tokenCount={tokenCount}
        onStop={onStop}
      />
      <StickToBottom className="relative flex-1 overflow-y-hidden" initial="smooth" resize="instant">
        <StickToBottom.Content className="flex flex-col gap-4 p-4">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <ArenaBubble key={msg.id} message={msg} />
            ))}
            {streamingDelta && (
              <ArenaBubble
                key="streaming"
                message={{
                  id: 'streaming',
                  role: 'challenger',
                  content: streamingDelta,
                  turn: currentTurn,
                }}
                isStreaming
              />
            )}
          </AnimatePresence>
          {grade && <GradeReport grade={grade} />}
          {error && status === 'error' && (
            <div className="text-center text-sm text-destructive py-4">
              {t('arena.error.runFailed' as TranslationKey).replace('{reason}', error)}
            </div>
          )}
        </StickToBottom.Content>
        <ScrollButton />
      </StickToBottom>
      {/* Bottom back button -- only in completed/error state */}
      {(status === 'completed' || status === 'error') && (
        <div className="shrink-0 border-t px-4 py-3">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={16} className="mr-2" />
            {t('arena.backToLevels' as TranslationKey)}
          </Button>
        </div>
      )}
    </div>
  );
}
