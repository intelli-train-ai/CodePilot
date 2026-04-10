import { z } from 'zod';

/**
 * Gatekeeper 结构化输出 Schema (ORCH-02)
 *
 * 用于 Gatekeeper AI 模式下的结构化回复：
 * - message: 提问内容或结束语
 * - shouldEnd: 是否结束对话
 * - endReason: 结束原因（仅 shouldEnd=true 时填写）
 */
export const GatekeeperOutputSchema = z.object({
  message: z.string().describe('Gatekeeper 的提问内容或结束语'),
  shouldEnd: z.boolean().describe('是否结束对话'),
  endReason: z.string().optional().describe('结束原因（仅 shouldEnd=true 时填写）'),
});

export type GatekeeperOutput = z.infer<typeof GatekeeperOutputSchema>;
