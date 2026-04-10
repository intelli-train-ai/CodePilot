'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n';
import type { ArenaLevelInfo } from './types';

interface LevelCardProps {
  level: ArenaLevelInfo;
  onStart: (level: ArenaLevelInfo) => void;
}

export function LevelCard({ level, onStart }: LevelCardProps) {
  const { t } = useTranslation();
  return (
    <Card className="group transition-shadow duration-200 hover:shadow-md hover:border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{level.name}</CardTitle>
          <Badge variant="secondary" className="text-xs">{t('arena.levelCard.turns' as TranslationKey).replace('{count}', String(level.maxTurns))}</Badge>
        </div>
        <CardDescription className="text-sm">{level.description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button onClick={() => onStart(level)} className="w-full">
          {t('arena.levelCard.start' as TranslationKey)}
        </Button>
      </CardFooter>
    </Card>
  );
}
