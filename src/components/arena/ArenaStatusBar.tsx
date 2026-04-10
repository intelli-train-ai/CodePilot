'use client';

import { Stop } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n';
import type { ArenaRunUIStatus } from './types';

interface ArenaStatusBarProps {
  currentTurn: number;
  maxTurns: number;
  status: ArenaRunUIStatus;
  tokenCount: number;
  onStop: () => void;
}

function getStatusBadge(status: ArenaRunUIStatus, t: (key: TranslationKey) => string) {
  switch (status) {
    case 'running':
      return <Badge variant="secondary">{t('arena.status.running' as TranslationKey)}</Badge>;
    case 'grading':
      return <Badge variant="secondary">{t('arena.status.grading' as TranslationKey)}</Badge>;
    case 'completed':
      return <Badge variant="default">{t('arena.status.completed' as TranslationKey)}</Badge>;
    case 'error':
      return <Badge variant="destructive">{t('arena.status.failed' as TranslationKey)}</Badge>;
    default:
      return null;
  }
}

export function ArenaStatusBar({ currentTurn, maxTurns, status, tokenCount, onStop }: ArenaStatusBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b"
      aria-live="polite"
    >
      <div className="flex items-center gap-4 px-4 py-2 text-xs font-semibold">
        {/* Turn counter */}
        <span>
          {t('arena.status.turn' as TranslationKey)
            .replace('{current}', String(currentTurn))
            .replace('{max}', String(maxTurns))}
        </span>

        {/* Status badge */}
        {getStatusBadge(status, t)}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Token count */}
        <span className="text-muted-foreground">
          {t('arena.status.tokens' as TranslationKey).replace('{count}', String(tokenCount))}
        </span>

        {/* Stop button - only visible during running */}
        {status === 'running' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={onStop}
                  aria-label={t('arena.stop' as TranslationKey)}
                >
                  <Stop size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('arena.stop' as TranslationKey)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
