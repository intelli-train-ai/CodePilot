import { z } from 'zod';

/**
 * Grader 结构化输出 Schema (GRAD-02, GRAD-04, GRAD-05)
 *
 * 混合评分制：必须项 Pass/Fail + 表现项 A/B/C/D
 * 最多 3 条改进建议，每条须引用具体对话轮次
 */
export const GraderOutputSchema = z.object({
  passed: z.boolean().describe('是否通关（所有必须项全部 Pass 才为 true）'),
  requiredCriteria: z.array(z.object({
    name: z.string().describe('必须项名称（对应 rubric 中 type=required 的项）'),
    passed: z.boolean().describe('是否通过'),
    reason: z.string().describe('判定理由'),
  })).describe('必须项评估结果'),
  performanceDimensions: z.array(z.object({
    name: z.string().describe('表现维度名称（对应 rubric 中 type=performance 的项）'),
    grade: z.enum(['A', 'B', 'C', 'D']).describe('等级评分'),
    reason: z.string().describe('判定理由'),
  })).describe('表现项评估结果'),
  suggestions: z.array(z.object({
    content: z.string().describe('改进建议内容'),
    referenceTurn: z.number().int().min(0).describe('引用的对话轮次编号（从 0 开始）'),
  })).max(3).describe('最多 3 条改进建议，须引用具体对话轮次'),
});

export type GraderOutput = z.infer<typeof GraderOutputSchema>;
