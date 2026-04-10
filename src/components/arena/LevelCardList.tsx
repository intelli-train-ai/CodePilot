'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n';
import { LevelCard } from './LevelCard';
import type { ArenaLevelInfo, ArenaWorldInfo } from './types';

interface LevelCardListProps {
  onSelectLevel: (worldId: string, level: ArenaLevelInfo) => void;
}

export function LevelCardList({ onSelectLevel }: LevelCardListProps) {
  const { t } = useTranslation();
  const [worlds, setWorlds] = useState<ArenaWorldInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    authFetch('/api/arena/levels')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { worlds: ArenaWorldInfo[] }) => {
        if (!cancelled) {
          setWorlds(data.worlds ?? []);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        {error}
      </div>
    );
  }

  const allLevels = worlds.flatMap((w) => w.levels);
  if (allLevels.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-lg font-semibold">
          {t('arena.empty.title' as TranslationKey)}
        </p>
        <p className="text-sm">
          {t('arena.empty.body' as TranslationKey)}
        </p>
      </div>
    );
  }

  // Single world: show levels directly without world title
  if (worlds.length === 1) {
    const world = worlds[0];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {world.levels.map((level) => (
          <LevelCard
            key={level.id}
            level={level}
            onStart={(lvl) => onSelectLevel(world.id, lvl)}
          />
        ))}
      </div>
    );
  }

  // Multiple worlds: group by world with titles
  return (
    <div className="flex flex-col gap-8">
      {worlds.map((world) => (
        <section key={world.id}>
          <h2 className="mb-4 text-lg font-semibold">{world.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {world.levels.map((level) => (
              <LevelCard
                key={level.id}
                level={level}
                onStart={(lvl) => onSelectLevel(world.id, lvl)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
