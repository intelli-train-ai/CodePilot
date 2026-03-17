/**
 * Workflow Templates — Skill detection + workflow generation + system prompt injection.
 * Types are compatible with situation-monitor's Workflow type definition.
 * Runs in Node.js (Next.js API route). No browser APIs.
 */

import fs from 'fs';
import path from 'path';

// ==========================================
// Types (must match situation-monitor/src/lib/types/index.ts)
// ==========================================

export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
export type AssetStatus = 'pending' | 'ready' | 'generating' | 'error';
export type AssetType = 'document' | 'image' | 'data' | 'template' | 'code' | 'presentation' | 'video' | 'audio';
export type RoleType = 'human' | 'ai_agent' | 'image_gen' | 'external_tool' | 'build_tool';
export type DependencyType = 'produces' | 'requires' | 'references' | 'triggers';

export interface WorkflowMeta {
  name: string;
  version: string;
  description: string;
  estimated_duration: string;
  output_type: string;
  status: PhaseStatus;
  progress: number;
  started_at?: string;
  completed_at?: string;
  source_skill?: string;
}

export interface WorkflowRole {
  id: string;
  name: string;
  type: RoleType;
  avatar: string;
  color: string;
  responsibilities: string[];
  current_action?: string;
}

export interface WorkflowPhase {
  id: string;
  name: string;
  description: string;
  actor: string;
  status: PhaseStatus;
  progress: number;
  inputs: string[];
  outputs: string[];
  quality_gate: string;
  on_fail: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  order: number;
}

export interface WorkflowAsset {
  id: string;
  name: string;
  type: AssetType;
  format: string;
  produced_by: string;
  consumed_by: string[];
  status: AssetStatus;
  phase_group: string;
}

export interface WorkflowDependency {
  from: string;
  to: string;
  type: DependencyType;
  label?: string;
}

export interface WorkflowEvent {
  id: string;
  timestamp: string;
  phase_id: string;
  type: 'phase_start' | 'phase_complete' | 'asset_created' | 'quality_check' | 'error' | 'retry';
  message: string;
  details?: string;
}

export interface Workflow {
  meta: WorkflowMeta;
  roles: WorkflowRole[];
  phases: WorkflowPhase[];
  assets: WorkflowAsset[];
  dependencies: WorkflowDependency[];
  events: WorkflowEvent[];
}

export type SkillType = 'comic' | 'ppt' | 'xiaohongshu' | 'refactor';

// ==========================================
// 1. detectSkill
// ==========================================

const SKILL_KEYWORDS: Record<SkillType, string[]> = {
  comic: ['漫剧', '漫画', 'comic', '动漫', 'motion comic'],
  ppt: ['PPT', 'ppt', '演示文稿', '幻灯片', 'presentation', 'slide'],
  xiaohongshu: ['小红书', '图文', '种草', 'xiaohongshu'],
  refactor: ['重构', 'refactor', '迁移', 'migration', 'GraphQL'],
};

export function detectSkill(message: string): SkillType | null {
  const lower = message.toLowerCase();
  for (const [skill, keywords] of Object.entries(SKILL_KEYWORDS) as [SkillType, string[]][]) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return skill;
      }
    }
  }
  return null;
}

// ==========================================
// 2. generateWorkflow
// ==========================================

function ts(): string { return new Date().toISOString(); }
function summarize(prompt: string, max = 60): string {
  const t = prompt.trim().replace(/\n/g, ' ');
  return t.length > max ? t.slice(0, max) + '...' : t;
}

// ---------- Comic (漫剧) ----------

function buildComicWorkflow(userPrompt: string): Workflow {
  return {
    meta: {
      name: '漫剧制作',
      version: '1.0',
      description: `AI 漫剧制作 — ${summarize(userPrompt)}`,
      estimated_duration: '30-60min',
      output_type: '漫剧视频 MP4',
      status: 'in_progress',
      progress: 0,
      started_at: ts(),
      source_skill: 'comic',
    },
    roles: [
      { id: 'human', name: '用户 / 导演', type: 'human', avatar: '🧑', color: '#4488ff', responsibilities: ['提供需求', '审核质量', '风格指导'], current_action: '等待 AI 工作' },
      { id: 'claude', name: 'Claude (编剧/导演)', type: 'ai_agent', avatar: '🤖', color: '#8844ff', responsibilities: ['剧本创作', '分镜设计', '配音指导', '导出'], current_action: '准备中' },
      { id: 'gemini', name: 'Gemini (画师)', type: 'image_gen', avatar: '🎨', color: '#44ddaa', responsibilities: ['角色设计', '画面生成', '动效合成'], current_action: '待命' },
    ],
    phases: [
      { id: 'p1', name: '剧本创作', description: '撰写漫剧剧本：故事线、角色、对白、分幕', actor: 'claude', status: 'pending', progress: 0, inputs: ['用户需求'], outputs: ['剧本文档'], quality_gate: '剧本逻辑完整', on_fail: '修改剧本', order: 1 },
      { id: 'p2', name: '角色与美术', description: '设计角色形象、美术风格、场景设定', actor: 'gemini', status: 'pending', progress: 0, inputs: ['剧本文档'], outputs: ['角色设定', '美术风格板'], quality_gate: '角色辨识度高', on_fail: '调整设计', order: 2 },
      { id: 'p3', name: '分镜脚本', description: '将剧本拆解为分镜，标注镜头、运动、时长', actor: 'claude', status: 'pending', progress: 0, inputs: ['剧本文档', '角色设定'], outputs: ['分镜脚本'], quality_gate: '叙事流畅', on_fail: '调整分镜', order: 3 },
      { id: 'p4', name: '镜头画面生成', description: '根据分镜生成每帧画面', actor: 'gemini', status: 'pending', progress: 0, inputs: ['分镜脚本', '角色设定', '美术风格板'], outputs: ['镜头画面集'], quality_gate: '画面一致性', on_fail: '重新生成', order: 4 },
      { id: 'p5', name: '配音与音效', description: '生成角色配音、场景音效、BGM', actor: 'claude', status: 'pending', progress: 0, inputs: ['剧本文档', '分镜脚本'], outputs: ['配音音频', '音效素材'], quality_gate: '情感到位', on_fail: '重录', order: 5 },
      { id: 'p6', name: '动效与合成', description: '为画面添加动效，合成音画同步视频', actor: 'gemini', status: 'pending', progress: 0, inputs: ['镜头画面集', '配音音频', '音效素材'], outputs: ['合成视频'], quality_gate: '音画同步', on_fail: '调整', order: 6 },
      { id: 'p7', name: '视频导出', description: '最终渲染导出 MP4', actor: 'claude', status: 'pending', progress: 0, inputs: ['合成视频'], outputs: ['漫剧视频 MP4'], quality_gate: '可播放', on_fail: '重新导出', order: 7 },
    ],
    assets: [
      { id: 'a-script', name: '剧本文档', type: 'document', format: 'Markdown', produced_by: 'p1', consumed_by: ['p2', 'p3', 'p5'], status: 'pending', phase_group: 'p1' },
      { id: 'a-char', name: '角色设定', type: 'image', format: 'PNG', produced_by: 'p2', consumed_by: ['p3', 'p4'], status: 'pending', phase_group: 'p2' },
      { id: 'a-style', name: '美术风格板', type: 'image', format: 'PNG', produced_by: 'p2', consumed_by: ['p4'], status: 'pending', phase_group: 'p2' },
      { id: 'a-storyboard', name: '分镜脚本', type: 'document', format: 'Markdown', produced_by: 'p3', consumed_by: ['p4', 'p5'], status: 'pending', phase_group: 'p3' },
      { id: 'a-frames', name: '镜头画面集', type: 'image', format: 'PNG', produced_by: 'p4', consumed_by: ['p6'], status: 'pending', phase_group: 'p4' },
      { id: 'a-voice', name: '配音音频', type: 'audio', format: 'WAV', produced_by: 'p5', consumed_by: ['p6'], status: 'pending', phase_group: 'p5' },
      { id: 'a-sfx', name: '音效素材', type: 'audio', format: 'WAV', produced_by: 'p5', consumed_by: ['p6'], status: 'pending', phase_group: 'p5' },
      { id: 'a-draft', name: '合成视频', type: 'video', format: 'MP4', produced_by: 'p6', consumed_by: ['p7'], status: 'pending', phase_group: 'p6' },
      { id: 'a-final', name: '漫剧视频 MP4', type: 'video', format: 'MP4', produced_by: 'p7', consumed_by: [], status: 'pending', phase_group: 'p7' },
    ],
    dependencies: [
      { from: 'a-script', to: 'a-char', type: 'produces' },
      { from: 'a-script', to: 'a-storyboard', type: 'produces' },
      { from: 'a-char', to: 'a-storyboard', type: 'requires' },
      { from: 'a-storyboard', to: 'a-frames', type: 'produces' },
      { from: 'a-char', to: 'a-frames', type: 'requires' },
      { from: 'a-style', to: 'a-frames', type: 'requires' },
      { from: 'a-script', to: 'a-voice', type: 'produces' },
      { from: 'a-frames', to: 'a-draft', type: 'produces' },
      { from: 'a-voice', to: 'a-draft', type: 'requires' },
      { from: 'a-sfx', to: 'a-draft', type: 'requires' },
      { from: 'a-draft', to: 'a-final', type: 'produces' },
    ],
    events: [
      { id: 'evt-init', timestamp: ts(), phase_id: 'p1', type: 'phase_start', message: '工作流已启动，开始剧本创作' },
    ],
  };
}

// ---------- PPT ----------

function buildPPTWorkflow(userPrompt: string): Workflow {
  return {
    meta: { name: 'PPT 制作', version: '1.0', description: `PPT 制作 — ${summarize(userPrompt)}`, estimated_duration: '15-30min', output_type: 'PPTX', status: 'in_progress', progress: 0, started_at: ts(), source_skill: 'ppt' },
    roles: [
      { id: 'human', name: '用户 / 演讲者', type: 'human', avatar: '🧑', color: '#4488ff', responsibilities: ['提供主题', '审核内容'], current_action: '等待' },
      { id: 'claude', name: 'Claude (策划师)', type: 'ai_agent', avatar: '🤖', color: '#8844ff', responsibilities: ['需求分析', '内容撰写', '导出'], current_action: '准备中' },
      { id: 'gemini', name: 'Gemini (设计师)', type: 'image_gen', avatar: '🎨', color: '#44ddaa', responsibilities: ['视觉设计', '动画'], current_action: '待命' },
    ],
    phases: [
      { id: 'pp1', name: '需求分析', description: '分析演示目标、受众、核心信息', actor: 'claude', status: 'pending', progress: 0, inputs: ['用户需求'], outputs: ['需求分析'], quality_gate: '目标明确', on_fail: '补充需求', order: 1 },
      { id: 'pp2', name: '内容大纲', description: '规划 PPT 结构和各页大纲', actor: 'claude', status: 'pending', progress: 0, inputs: ['需求分析'], outputs: ['大纲'], quality_gate: '逻辑通顺', on_fail: '调整大纲', order: 2 },
      { id: 'pp3', name: '视觉设计', description: '确定配色、字体、布局模板', actor: 'gemini', status: 'pending', progress: 0, inputs: ['需求分析', '大纲'], outputs: ['设计模板'], quality_gate: '视觉统一', on_fail: '重新设计', order: 3 },
      { id: 'pp4', name: '内容填充', description: '按大纲填写文字、图表、图片', actor: 'claude', status: 'pending', progress: 0, inputs: ['大纲', '设计模板'], outputs: ['PPT 初稿'], quality_gate: '内容准确', on_fail: '修改', order: 4 },
      { id: 'pp5', name: '动画与过渡', description: '添加页面动画和切换效果', actor: 'gemini', status: 'pending', progress: 0, inputs: ['PPT 初稿'], outputs: ['PPT 动画版'], quality_gate: '不干扰阅读', on_fail: '调整', order: 5 },
      { id: 'pp6', name: '导出与检查', description: '最终检查并导出 PPTX', actor: 'claude', status: 'pending', progress: 0, inputs: ['PPT 动画版'], outputs: ['PPTX 文件'], quality_gate: '文件可用', on_fail: '修复', order: 6 },
    ],
    assets: [
      { id: 'a-req', name: '需求分析', type: 'document', format: 'MD', produced_by: 'pp1', consumed_by: ['pp2', 'pp3'], status: 'pending', phase_group: 'pp1' },
      { id: 'a-outline', name: '大纲', type: 'document', format: 'MD', produced_by: 'pp2', consumed_by: ['pp3', 'pp4'], status: 'pending', phase_group: 'pp2' },
      { id: 'a-tmpl', name: '设计模板', type: 'template', format: 'PPTX', produced_by: 'pp3', consumed_by: ['pp4'], status: 'pending', phase_group: 'pp3' },
      { id: 'a-draft', name: 'PPT 初稿', type: 'presentation', format: 'PPTX', produced_by: 'pp4', consumed_by: ['pp5'], status: 'pending', phase_group: 'pp4' },
      { id: 'a-anim', name: 'PPT 动画版', type: 'presentation', format: 'PPTX', produced_by: 'pp5', consumed_by: ['pp6'], status: 'pending', phase_group: 'pp5' },
      { id: 'a-final', name: 'PPTX 文件', type: 'presentation', format: 'PPTX', produced_by: 'pp6', consumed_by: [], status: 'pending', phase_group: 'pp6' },
    ],
    dependencies: [
      { from: 'a-req', to: 'a-outline', type: 'produces' },
      { from: 'a-req', to: 'a-tmpl', type: 'requires' },
      { from: 'a-outline', to: 'a-tmpl', type: 'requires' },
      { from: 'a-outline', to: 'a-draft', type: 'produces' },
      { from: 'a-tmpl', to: 'a-draft', type: 'requires' },
      { from: 'a-draft', to: 'a-anim', type: 'produces' },
      { from: 'a-anim', to: 'a-final', type: 'produces' },
    ],
    events: [{ id: 'evt-init', timestamp: ts(), phase_id: 'pp1', type: 'phase_start', message: '开始需求分析' }],
  };
}

// ---------- Xiaohongshu ----------

function buildXiaohongshuWorkflow(userPrompt: string): Workflow {
  return {
    meta: { name: '小红书图文', version: '1.0', description: `小红书图文 — ${summarize(userPrompt)}`, estimated_duration: '10-20min', output_type: '小红书图文', status: 'in_progress', progress: 0, started_at: ts(), source_skill: 'xiaohongshu' },
    roles: [
      { id: 'human', name: '用户 / 博主', type: 'human', avatar: '🧑', color: '#4488ff', responsibilities: ['提供主题', '审核'], current_action: '等待' },
      { id: 'claude', name: 'Claude (内容策划)', type: 'ai_agent', avatar: '🤖', color: '#8844ff', responsibilities: ['选题', '文案', '发布优化'], current_action: '准备中' },
      { id: 'gemini', name: 'Gemini (视觉)', type: 'image_gen', avatar: '🎨', color: '#44ddaa', responsibilities: ['图片', '排版'], current_action: '待命' },
    ],
    phases: [
      { id: 'xhs1', name: '选题策划', description: '分析受众，确定内容方向', actor: 'claude', status: 'pending', progress: 0, inputs: ['用户需求'], outputs: ['选题方案'], quality_gate: '选题有热度', on_fail: '换题', order: 1 },
      { id: 'xhs2', name: '文案撰写', description: '撰写标题、正文、标签', actor: 'claude', status: 'pending', progress: 0, inputs: ['选题方案'], outputs: ['文案'], quality_gate: '符合小红书调性', on_fail: '修改', order: 2 },
      { id: 'xhs3', name: '图片素材', description: '生成配图', actor: 'gemini', status: 'pending', progress: 0, inputs: ['文案', '选题方案'], outputs: ['图片集'], quality_gate: '高质量', on_fail: '重新生成', order: 3 },
      { id: 'xhs4', name: '排版设计', description: '设计图文排版', actor: 'gemini', status: 'pending', progress: 0, inputs: ['文案', '图片集'], outputs: ['成品图'], quality_gate: '美观', on_fail: '调整', order: 4 },
      { id: 'xhs5', name: '发布优化', description: '优化标签、发布时间', actor: 'claude', status: 'pending', progress: 0, inputs: ['文案', '成品图'], outputs: ['发布就绪'], quality_gate: 'SEO 优化', on_fail: '调整', order: 5 },
    ],
    assets: [
      { id: 'a-topic', name: '选题方案', type: 'document', format: 'MD', produced_by: 'xhs1', consumed_by: ['xhs2', 'xhs3'], status: 'pending', phase_group: 'xhs1' },
      { id: 'a-copy', name: '文案', type: 'document', format: 'MD', produced_by: 'xhs2', consumed_by: ['xhs3', 'xhs4', 'xhs5'], status: 'pending', phase_group: 'xhs2' },
      { id: 'a-imgs', name: '图片集', type: 'image', format: 'PNG', produced_by: 'xhs3', consumed_by: ['xhs4'], status: 'pending', phase_group: 'xhs3' },
      { id: 'a-layout', name: '成品图', type: 'image', format: 'PNG', produced_by: 'xhs4', consumed_by: ['xhs5'], status: 'pending', phase_group: 'xhs4' },
      { id: 'a-final', name: '发布就绪', type: 'document', format: 'MD', produced_by: 'xhs5', consumed_by: [], status: 'pending', phase_group: 'xhs5' },
    ],
    dependencies: [
      { from: 'a-topic', to: 'a-copy', type: 'produces' },
      { from: 'a-copy', to: 'a-imgs', type: 'produces' },
      { from: 'a-topic', to: 'a-imgs', type: 'requires' },
      { from: 'a-copy', to: 'a-layout', type: 'requires' },
      { from: 'a-imgs', to: 'a-layout', type: 'requires' },
      { from: 'a-copy', to: 'a-final', type: 'requires' },
      { from: 'a-layout', to: 'a-final', type: 'requires' },
    ],
    events: [{ id: 'evt-init', timestamp: ts(), phase_id: 'xhs1', type: 'phase_start', message: '开始选题策划' }],
  };
}

// ---------- Refactor ----------

function buildRefactorWorkflow(userPrompt: string): Workflow {
  return {
    meta: { name: '代码重构', version: '1.0', description: `代码重构 — ${summarize(userPrompt)}`, estimated_duration: '60-120min', output_type: '重构代码', status: 'in_progress', progress: 0, started_at: ts(), source_skill: 'refactor' },
    roles: [
      { id: 'human', name: '用户 / 架构师', type: 'human', avatar: '🧑', color: '#4488ff', responsibilities: ['提供需求', '审核', '部署'], current_action: '等待' },
      { id: 'claude', name: 'Claude (工程师)', type: 'ai_agent', avatar: '🤖', color: '#8844ff', responsibilities: ['分析', '设计', '实现', '测试'], current_action: '准备中' },
    ],
    phases: [
      { id: 'rf1', name: '现状分析', description: '分析现有代码结构和技术债务', actor: 'claude', status: 'pending', progress: 0, inputs: ['代码库'], outputs: ['分析报告'], quality_gate: '覆盖关键模块', on_fail: '补充', order: 1 },
      { id: 'rf2', name: 'Schema 设计', description: '设计新的数据模型/API 结构', actor: 'claude', status: 'pending', progress: 0, inputs: ['分析报告'], outputs: ['Schema 文档'], quality_gate: '向后兼容', on_fail: '修改', order: 2 },
      { id: 'rf3', name: 'Resolver 实现', description: '实现新的 Service/Controller 层', actor: 'claude', status: 'pending', progress: 0, inputs: ['Schema 文档'], outputs: ['实现代码'], quality_gate: '类型安全', on_fail: '修复', order: 3 },
      { id: 'rf4', name: '数据迁移', description: '编写和执行数据迁移脚本', actor: 'claude', status: 'pending', progress: 0, inputs: ['Schema 文档', '实现代码'], outputs: ['迁移脚本'], quality_gate: '可回滚', on_fail: '回滚', order: 4 },
      { id: 'rf5', name: '测试覆盖', description: '编写单元/集成测试', actor: 'claude', status: 'pending', progress: 0, inputs: ['实现代码', '迁移脚本'], outputs: ['测试套件'], quality_gate: '覆盖率>80%', on_fail: '修复', order: 5 },
      { id: 'rf6', name: '部署上线', description: '准备部署方案并上线', actor: 'human', status: 'pending', progress: 0, inputs: ['实现代码', '迁移脚本', '测试套件'], outputs: ['部署确认'], quality_gate: '功能正常', on_fail: '回滚', order: 6 },
    ],
    assets: [
      { id: 'a-report', name: '分析报告', type: 'document', format: 'MD', produced_by: 'rf1', consumed_by: ['rf2'], status: 'pending', phase_group: 'rf1' },
      { id: 'a-schema', name: 'Schema 文档', type: 'document', format: 'MD', produced_by: 'rf2', consumed_by: ['rf3', 'rf4'], status: 'pending', phase_group: 'rf2' },
      { id: 'a-code', name: '实现代码', type: 'code', format: 'TS', produced_by: 'rf3', consumed_by: ['rf4', 'rf5', 'rf6'], status: 'pending', phase_group: 'rf3' },
      { id: 'a-migrate', name: '迁移脚本', type: 'code', format: 'SQL', produced_by: 'rf4', consumed_by: ['rf5', 'rf6'], status: 'pending', phase_group: 'rf4' },
      { id: 'a-tests', name: '测试套件', type: 'code', format: 'TS', produced_by: 'rf5', consumed_by: ['rf6'], status: 'pending', phase_group: 'rf5' },
      { id: 'a-deploy', name: '部署确认', type: 'document', format: 'MD', produced_by: 'rf6', consumed_by: [], status: 'pending', phase_group: 'rf6' },
    ],
    dependencies: [
      { from: 'a-report', to: 'a-schema', type: 'produces' },
      { from: 'a-schema', to: 'a-code', type: 'produces' },
      { from: 'a-schema', to: 'a-migrate', type: 'produces' },
      { from: 'a-code', to: 'a-migrate', type: 'requires' },
      { from: 'a-code', to: 'a-tests', type: 'produces' },
      { from: 'a-migrate', to: 'a-tests', type: 'requires' },
      { from: 'a-code', to: 'a-deploy', type: 'requires' },
      { from: 'a-migrate', to: 'a-deploy', type: 'requires' },
      { from: 'a-tests', to: 'a-deploy', type: 'requires' },
    ],
    events: [{ id: 'evt-init', timestamp: ts(), phase_id: 'rf1', type: 'phase_start', message: '开始现状分析' }],
  };
}

// ---------- Public API ----------

const BUILDERS: Record<string, (prompt: string) => Workflow> = {
  comic: buildComicWorkflow,
  ppt: buildPPTWorkflow,
  xiaohongshu: buildXiaohongshuWorkflow,
  refactor: buildRefactorWorkflow,
};

export function generateWorkflow(skillType: string, userPrompt: string): Workflow {
  const builder = BUILDERS[skillType];
  if (!builder) throw new Error(`Unknown skill type: ${skillType}`);
  return builder(userPrompt);
}

// ==========================================
// 3. getWorkflowSystemPrompt
// ==========================================

const SKILL_CONTENT_INSTRUCTIONS: Record<string, string> = {
  comic: `你正在执行"漫剧制作"工作流。请按以下阶段顺序工作，为用户真正生成漫剧所需的全部内容：

**阶段 p1 — 剧本创作**：根据用户需求，撰写完整的漫剧剧本。包括：故事背景与世界观、主要角色（名字、性格、外貌描述）、分幕剧情（开头→发展→高潮→结局）、每幕的对白和旁白。输出一份结构化的剧本文档。

**阶段 p2 — 角色与美术**：为每个角色输出详细的视觉描述（供画师使用的 prompt），确定美术风格（如赛博朋克、水墨、日系等），描述关键场景的视觉氛围。

**阶段 p3 — 分镜脚本**：将剧本拆解为分镜。每个镜头包括：镜号、镜头类型（全景/中景/特写）、画面描述、角色动作、对白/旁白、时长（秒）、镜头运动（推/拉/摇/跟）。

**阶段 p4 — 镜头画面生成**：为每个分镜输出详细的图片生成 prompt（英文），可直接用于 DALL-E / Midjourney / Stable Diffusion。

**阶段 p5 — 配音与音效**：为每个角色的对白标注配音指导（语气、情感、语速），列出每个场景需要的音效（如脚步声、爆炸声、雨声），推荐 BGM 风格。

**阶段 p6 — 动效与合成**：描述每个镜头的动效方案（如角色移动路径、镜头缩放、粒子特效），输出合成时间轴。

**阶段 p7 — 视频导出**：输出最终视频的规格（分辨率、帧率、时长、格式），汇总所有产物清单。`,

  ppt: `你正在执行"PPT 制作"工作流。请按以下阶段顺序工作，为用户真正生成 PPT 所需的全部内容：

**阶段 pp1 — 需求分析**：明确演示目标、目标受众、核心要传达的 3-5 个关键信息、风格偏好。

**阶段 pp2 — 内容大纲**：规划 PPT 的完整结构，每一页的标题和要点。输出结构化大纲。

**阶段 pp3 — 视觉设计**：确定配色方案（主色/辅色/强调色）、字体选择、页面布局模板描述。

**阶段 pp4 — 内容填充**：按大纲逐页撰写完整内容，包括标题、正文、图表数据、图片建议。

**阶段 pp5 — 动画与过渡**：为每页设计动画效果和页面切换方式。

**阶段 pp6 — 导出与检查**：最终检查清单，输出完整的 PPT 内容。`,

  xiaohongshu: `你正在执行"小红书图文"工作流。请按以下阶段顺序工作：

**阶段 xhs1 — 选题策划**：分析目标受众画像，确定选题方向，分析热点趋势，输出选题策划方案。

**阶段 xhs2 — 文案撰写**：撰写吸引人的标题（多个备选）、正文（小红书风格，emoji+口语化）、话题标签。

**阶段 xhs3 — 图片素材**：为每张配图输出详细的图片生成 prompt，描述构图、色调、元素。

**阶段 xhs4 — 排版设计**：描述每张图的文字覆盖方案、字体、颜色、位置。

**阶段 xhs5 — 发布优化**：推荐发布时间、优化标签策略、互动引导语。`,

  refactor: `你正在执行"代码重构"工作流。请按以下阶段顺序工作：

**阶段 rf1 — 现状分析**：分析现有代码结构、依赖关系、性能瓶颈、技术债务。输出分析报告。

**阶段 rf2 — Schema 设计**：设计新的数据模型/API 结构。输出设计文档。

**阶段 rf3 — Resolver 实现**：实现新的 Service/Controller 层代码。

**阶段 rf4 — 数据迁移**：编写数据迁移脚本。

**阶段 rf5 — 测试覆盖**：编写单元测试和集成测试。

**阶段 rf6 — 部署上线**：准备部署清单和回滚方案。`,
};

export function getWorkflowSystemPrompt(
  skillType: string,
  phases: { id: string; name: string }[],
): string {
  const phaseList = phases.map((p) => `  - ${p.id}: ${p.name}`).join('\n');
  const contentInstructions = SKILL_CONTENT_INSTRUCTIONS[skillType] || '';

  return `<workflow-execution>
${contentInstructions}

## 进度标记规则

在你工作的过程中，请在每个阶段开始、进行中、完成时输出 HTML 注释格式的进度标记，这些标记会被系统捕获用于更新 Workflow Monitor 面板：

格式: <!--wf:PHASE_ID:STATUS:PROGRESS-->

其中:
  PHASE_ID = 阶段 ID (如 ${phases[0]?.id || 'p1'})
  STATUS   = in_progress | completed | failed
  PROGRESS = 0-100 的整数

示例:
  <!--wf:${phases[0]?.id || 'p1'}:in_progress:0-->   (开始阶段)
  <!--wf:${phases[0]?.id || 'p1'}:in_progress:50-->  (进行中)
  <!--wf:${phases[0]?.id || 'p1'}:completed:100-->   (完成阶段)

本工作流的阶段:
${phaseList}

重要规则:
- 每个阶段开始时输出 in_progress:0 标记
- 阶段中有实质性进展时输出中间进度标记
- 阶段完成时输出 completed:100 标记
- 按顺序执行所有阶段，不要跳过
- 每个阶段都要输出真实的、有价值的内容，不要只输出标记
- 你生成的内容（剧本、角色、分镜、文案等）就是这个工作流的真正产物
</workflow-execution>`;
}

// ==========================================
// 4. Dynamic Project Skill Scanning
// ==========================================

export interface ProjectSkillFile {
  name: string;
  description: string;
  fileName: string;
  content: string;
  /** Folder name under .claude/skills/ */
  folderName: string;
}

export interface ProjectSkillScanResult {
  /** Content of claude.md (workflow instructions) */
  claudeMd: string;
  /** Individual skill files found */
  skills: ProjectSkillFile[];
  /** Project root directory */
  projectDir: string;
}

/**
 * Scan a project directory for skill files.
 * Reads claude.md and all .md files under .claude/skills/
 */
export function scanProjectSkills(projectDir: string): ProjectSkillScanResult | null {
  try {
    // Read claude.md (workflow instructions)
    const claudeMdPath = path.join(projectDir, 'claude.md');
    if (!fs.existsSync(claudeMdPath)) return null;
    const claudeMd = fs.readFileSync(claudeMdPath, 'utf-8');

    // Scan .claude/skills/ for skill files
    const skillsDir = path.join(projectDir, '.claude', 'skills');
    const skills: ProjectSkillFile[] = [];

    if (fs.existsSync(skillsDir)) {
      const folders = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const folder of folders) {
        const folderPath = path.join(skillsDir, folder.name);
        const mdFiles = fs.readdirSync(folderPath)
          .filter(f => f.endsWith('.md'));

        for (const mdFile of mdFiles) {
          const filePath = path.join(folderPath, mdFile);
          const content = fs.readFileSync(filePath, 'utf-8');

          // Extract frontmatter name and description
          let name = folder.name;
          let description = '';
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const fm = fmMatch[1];
            const nameMatch = fm.match(/^name:\s*(.+)$/m);
            const descMatch = fm.match(/^description:\s*(.+)$/m);
            if (nameMatch) name = nameMatch[1].trim();
            if (descMatch) description = descMatch[1].trim();
          }

          skills.push({
            name,
            description,
            fileName: mdFile,
            content,
            folderName: folder.name,
          });
        }
      }
    }

    if (skills.length === 0) return null;

    return { claudeMd, skills, projectDir };
  } catch (e) {
    console.warn('[workflow-templates] Failed to scan project skills:', e);
    return null;
  }
}

/**
 * Generate a Workflow from scanned project skills.
 * Each skill becomes a workflow phase. The workflow structure is derived
 * from the actual skill files found in the project directory.
 */
export function generateWorkflowFromSkills(
  scan: ProjectSkillScanResult,
  userPrompt: string,
): Workflow {
  const now = ts();
  const projectName = path.basename(scan.projectDir);

  const phases: WorkflowPhase[] = scan.skills.map((skill, i) => ({
    id: `skill-${i + 1}`,
    name: skill.folderName,
    description: skill.description || skill.name,
    actor: 'claude',
    status: 'pending' as PhaseStatus,
    progress: 0,
    inputs: i === 0 ? ['用户需求'] : [`skill-${i} 产出`],
    outputs: [`${skill.folderName} 产出`],
    quality_gate: '符合 Skill 文档要求',
    on_fail: '根据 Skill 文档修改',
    order: i + 1,
  }));

  const assets: WorkflowAsset[] = scan.skills.map((skill, i) => ({
    id: `asset-${i + 1}`,
    name: `${skill.folderName} 产出`,
    type: 'document' as AssetType,
    format: 'MD',
    produced_by: `skill-${i + 1}`,
    consumed_by: i < scan.skills.length - 1 ? [`skill-${i + 2}`] : [],
    status: 'pending' as AssetStatus,
    phase_group: `skill-${i + 1}`,
  }));

  const dependencies: WorkflowDependency[] = [];
  for (let i = 0; i < assets.length - 1; i++) {
    dependencies.push({
      from: assets[i].id,
      to: assets[i + 1].id,
      type: 'produces',
    });
  }

  return {
    meta: {
      name: projectName,
      version: '1.0',
      description: `${projectName} — ${summarize(userPrompt)}`,
      estimated_duration: '30-60min',
      output_type: projectName,
      status: 'in_progress',
      progress: 0,
      started_at: now,
      source_skill: 'project',
    },
    roles: [
      { id: 'human', name: '用户 / 导演', type: 'human', avatar: '🧑', color: '#4488ff', responsibilities: ['提供需求', '审核质量', '素材上传'], current_action: '等待 AI 工作' },
      { id: 'claude', name: 'Claude (执行者)', type: 'ai_agent', avatar: '🤖', color: '#8844ff', responsibilities: scan.skills.map(s => s.folderName), current_action: '准备中' },
    ],
    phases,
    assets,
    dependencies,
    events: [
      { id: 'evt-init', timestamp: now, phase_id: phases[0]?.id || 'skill-1', type: 'phase_start', message: `工作流已启动 — ${projectName}` },
    ],
  };
}

/**
 * Generate a system prompt that includes the FULL content of each skill file,
 * so Claude knows exactly what to do at each phase.
 */
export function getWorkflowSystemPromptFromSkills(
  scan: ProjectSkillScanResult,
  phases: { id: string; name: string }[],
): string {
  const phaseList = phases.map((p) => `  - ${p.id}: ${p.name}`).join('\n');

  // Include the project's claude.md as the overall workflow guide
  let skillInstructions = `## 项目工作流指南\n\n${scan.claudeMd}\n\n`;

  // Include each skill file's full content
  skillInstructions += `## 各技能详细文档\n\n`;
  scan.skills.forEach((skill, i) => {
    const phaseId = `skill-${i + 1}`;
    skillInstructions += `### 阶段 ${phaseId} — ${skill.folderName}\n\n`;
    // Strip frontmatter from content for cleaner injection
    const contentWithoutFm = skill.content.replace(/^---\n[\s\S]*?\n---\n*/, '');
    skillInstructions += contentWithoutFm.trim() + '\n\n';
  });

  return `<workflow-execution>
## 重要：执行模式

你现在进入了工作流执行模式。请严格遵守以下规则：

1. **禁止使用 Skill 工具** — 不要调用 Skill tool。所有技能文档已经在下方完整提供，你必须直接按照文档内容执行工作。
2. **直接执行** — 使用 Read、Write、Bash、Glob、Grep 等工具直接完成每个阶段的任务。不要询问用户是否要开始，直接开工。
3. **按阶段顺序执行** — 从第一个阶段开始，依次执行每个阶段，不要跳过。
4. **输出进度标记** — 每个阶段开始和完成时输出进度标记（格式见下方）。
5. **输出真实内容** — 每个阶段都要产出有价值的真实内容，不要只输出标记或摘要。

${skillInstructions}

## 进度标记规则

在你工作的过程中，请在每个阶段开始、进行中、完成时输出 HTML 注释格式的进度标记，这些标记会被系统捕获用于更新 Workflow Monitor 面板：

格式: <!--wf:PHASE_ID:STATUS:PROGRESS-->

其中:
  PHASE_ID = 阶段 ID (如 ${phases[0]?.id || 'skill-1'})
  STATUS   = in_progress | completed | failed
  PROGRESS = 0-100 的整数

示例:
  <!--wf:${phases[0]?.id || 'skill-1'}:in_progress:0-->   (开始阶段)
  <!--wf:${phases[0]?.id || 'skill-1'}:in_progress:50-->  (进行中)
  <!--wf:${phases[0]?.id || 'skill-1'}:completed:100-->   (完成阶段)

本工作流的阶段:
${phaseList}

重要规则:
- 每个阶段开始时输出 in_progress:0 标记
- 阶段中有实质性进展时输出中间进度标记
- 阶段完成时输出 completed:100 标记
- 按顺序执行所有阶段，不要跳过
- 根据每个阶段对应的技能文档执行具体工作
- 每个阶段都要输出真实的、有价值的内容，严格遵循技能文档的要求
- 你生成的内容就是这个工作流的真正产物
- **再次强调：不要使用 Skill 工具，直接用 Read/Write/Bash 等工具执行任务**
</workflow-execution>`;
}
