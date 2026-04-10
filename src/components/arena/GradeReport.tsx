'use client';

import type { GraderOutput } from '@/arena/schemas/grader-output';

interface GradeReportProps {
  grade: GraderOutput;
}

/** Placeholder -- full implementation in Task 2 */
export function GradeReport({ grade }: GradeReportProps) {
  return (
    <div className="mt-12">
      {grade.passed ? 'Passed' : 'Failed'}
    </div>
  );
}
