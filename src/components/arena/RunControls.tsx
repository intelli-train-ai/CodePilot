'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, CaretDown, CaretRight } from '@/components/ui/icon';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n';
import { RoleModelSelector } from './RoleModelSelector';
import type { RunParams } from './types';

interface RunControlsProps {
  levelId: string;
  levelName: string;
  levelDescription: string;
  maxTurns: number;
  worldId: string;
  onStart: (params: RunParams) => void;
  onBack: () => void;
}

export function RunControls({
  levelId,
  levelName,
  levelDescription,
  maxTurns,
  worldId,
  onStart,
  onBack,
}: RunControlsProps) {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Three-role provider/model state (undefined = use default)
  const [gatekeeperProviderId, setGatekeeperProviderId] = useState<string | undefined>();
  const [gatekeeperModel, setGatekeeperModel] = useState<string | undefined>();
  const [challengerProviderId, setChallengerProviderId] = useState<string | undefined>();
  const [challengerModel, setChallengerModel] = useState<string | undefined>();
  const [graderProviderId, setGraderProviderId] = useState<string | undefined>();
  const [graderModel, setGraderModel] = useState<string | undefined>();

  const handleStart = () => {
    onStart({
      worldId,
      levelId,
      gatekeeperProviderId,
      gatekeeperModel,
      challengerProviderId,
      challengerModel,
      graderProviderId,
      graderModel,
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack} className="w-fit">
        <ArrowLeft className="size-4" />
        {t('arena.backToLevels' as TranslationKey)}
      </Button>

      {/* Level info */}
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{levelName}</h2>
        <p className="text-sm text-muted-foreground">{levelDescription}</p>
        <p className="text-xs text-muted-foreground">
          {t('arena.status.turn' as TranslationKey)
            .replace('{current}', '0')
            .replace('{max}', String(maxTurns))}
        </p>
      </div>

      {/* Advanced options (collapsible) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-fit gap-2">
            {advancedOpen
              ? <CaretDown className="size-4" />
              : <CaretRight className="size-4" />
            }
            {t('arena.advancedOptions' as TranslationKey)}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-3 pt-3">
          <RoleModelSelector
            role="gatekeeper"
            providerId={gatekeeperProviderId}
            model={gatekeeperModel}
            onProviderChange={setGatekeeperProviderId}
            onModelChange={setGatekeeperModel}
          />
          <RoleModelSelector
            role="challenger"
            providerId={challengerProviderId}
            model={challengerModel}
            onProviderChange={setChallengerProviderId}
            onModelChange={setChallengerModel}
          />
          <RoleModelSelector
            role="grader"
            providerId={graderProviderId}
            model={graderModel}
            onProviderChange={setGraderProviderId}
            onModelChange={setGraderModel}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Start button */}
      <Button onClick={handleStart} className="w-full">
        {t('arena.startChallenge' as TranslationKey)}
      </Button>
    </div>
  );
}
