import { z } from 'zod';

/** 评分标准单项 Schema -- required (Pass/Fail) 或 performance (A/B/C/D) */
export const RubricItemSchema = z.object({
  name: z.string().describe('评分项名称'),
  type: z.enum(['required', 'performance']).describe('required=必须项 Pass/Fail, performance=表现项 A/B/C/D'),
  description: z.string().describe('评分项说明'),
  gradeDescriptions: z.record(z.string(), z.string()).optional().describe('等级行为描述 mapping，required 类型不需要，performance 类型应包含 A/B/C/D 键'),
});

/** 关卡配置 Schema -- 包含场景、rubric anchoring、角色级 provider/model 覆盖 */
export const LevelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().describe('场景描述（展示给用户）'),
  challengerSystemPrompt: z.string().describe('Challenger 的 system prompt'),
  gatekeeperSystemPrompt: z.string().describe('Gatekeeper 的 system prompt'),
  graderSystemPrompt: z.string().optional().describe('Grader 的 system prompt（可选，有默认值）'),
  rubric: z.array(RubricItemSchema).min(1).describe('评分标准，至少 1 项'),
  maxTurns: z.number().int().positive().default(10).describe('最大对话轮数'),
  maxTokens: z.number().int().positive().optional().describe('Token 预算上限（覆盖默认 200,000）'),
  roleConfig: z.object({
    gatekeeper: z.object({ providerId: z.string().optional(), model: z.string().optional() }).optional(),
    challenger: z.object({ providerId: z.string().optional(), model: z.string().optional() }).optional(),
    grader: z.object({ providerId: z.string().optional(), model: z.string().optional() }).optional(),
  }).optional().describe('角色级别的 provider/model 覆盖'),
  sortOrder: z.number().int().default(0).describe('关卡在世界内的排序'),
});

/** 世界配置 Schema -- 世界元数据 */
export const WorldConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export type LevelConfig = z.infer<typeof LevelConfigSchema>;
export type WorldConfig = z.infer<typeof WorldConfigSchema>;
export type RubricItem = z.infer<typeof RubricItemSchema>;
