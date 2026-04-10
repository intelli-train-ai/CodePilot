'use client';

import { motion } from 'motion/react';
import { CheckCircle, XCircle } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n';
import type { GraderOutput } from '@/arena/schemas/grader-output';
import { cn } from '@/lib/utils';

interface GradeReportProps {
  grade: GraderOutput;
}

function getGradeBadgeClass(grade: 'A' | 'B' | 'C' | 'D'): string {
  switch (grade) {
    case 'A': return 'bg-status-success-muted text-status-success-foreground';
    case 'B': return 'bg-primary/10 text-primary';
    case 'C': return 'bg-status-warning-muted text-status-warning-foreground';
    case 'D': return 'bg-status-error-muted text-status-error-foreground';
  }
}

export function GradeReport({ grade }: GradeReportProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mt-12 border rounded-xl bg-card p-6"
    >
      {/* Section 1: Pass/Fail Banner */}
      <div
        className={cn(
          "rounded-lg p-4 border",
          grade.passed
            ? "bg-status-success-muted border-status-success-border"
            : "bg-status-error-muted border-status-error-border"
        )}
        aria-live="assertive"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold">
            {grade.passed
              ? t('arena.grade.passed' as TranslationKey)
              : t('arena.grade.failed' as TranslationKey)}
          </span>
          <Badge variant={grade.passed ? 'default' : 'destructive'}>
            {grade.passed ? 'PASS' : 'FAIL'}
          </Badge>
        </div>
      </div>

      {/* Section 2: Required Criteria */}
      <div className="mt-6">
        <h3 className="text-base font-semibold mb-4">
          {t('arena.grade.requiredCriteria' as TranslationKey)}
        </h3>
        <div className="space-y-3">
          {grade.requiredCriteria.map((criterion) => (
            <div key={criterion.name} className="flex items-start gap-3">
              {criterion.passed ? (
                <CheckCircle size={16} className="mt-0.5 shrink-0 text-status-success" />
              ) : (
                <XCircle size={16} className="mt-0.5 shrink-0 text-status-error" />
              )}
              <div>
                <span className="font-semibold text-sm">{criterion.name}</span>
                <p className="text-sm text-muted-foreground">{criterion.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Performance Dimensions */}
      <Separator className="my-6" />
      <div>
        <h3 className="text-base font-semibold mb-4">
          {t('arena.grade.performanceDimensions' as TranslationKey)}
        </h3>
        <div className="space-y-3">
          {grade.performanceDimensions.map((dimension) => (
            <div key={dimension.name} className="flex items-start gap-3">
              <Badge className={cn("shrink-0", getGradeBadgeClass(dimension.grade))}>
                {dimension.grade}
              </Badge>
              <div>
                <span className="font-semibold text-sm">{dimension.name}</span>
                <p className="text-sm text-muted-foreground">{dimension.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Improvement Suggestions */}
      {grade.suggestions.length > 0 && (
        <>
          <Separator className="my-6" />
          <div>
            <h3 className="text-base font-semibold mb-4">
              {t('arena.grade.suggestions' as TranslationKey)}
            </h3>
            <div className="space-y-3">
              {grade.suggestions.slice(0, 3).map((suggestion, i) => (
                <Card key={i} className="bg-muted/50">
                  <CardContent className="p-4">
                    <p className="text-sm">{suggestion.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('arena.grade.turnReference' as TranslationKey).replace(
                        '{n}',
                        String(suggestion.referenceTurn)
                      )}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
