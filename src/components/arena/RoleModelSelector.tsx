'use client';

import { useProviderModels } from '@/hooks/useProviderModels';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n';

interface RoleModelSelectorProps {
  role: 'gatekeeper' | 'challenger' | 'grader';
  providerId?: string;
  model?: string;
  onProviderChange: (providerId: string) => void;
  onModelChange: (model: string) => void;
}

export function RoleModelSelector({ role, providerId, model, onProviderChange, onModelChange }: RoleModelSelectorProps) {
  const { t } = useTranslation();
  const { providerGroups, modelOptions } = useProviderModels(providerId, model);

  const roleKey = `arena.role.${role}` as TranslationKey;
  const providerPlaceholder = t('arena.provider.default' as TranslationKey);
  const modelPlaceholder = t('arena.model.default' as TranslationKey);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold w-20 shrink-0">{t(roleKey)}</span>
      <Select value={providerId || ''} onValueChange={onProviderChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={providerPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {providerGroups.map((g) => (
            <SelectItem key={g.provider_id} value={g.provider_id}>
              {g.provider_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={model || ''} onValueChange={onModelChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={modelPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {modelOptions.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
