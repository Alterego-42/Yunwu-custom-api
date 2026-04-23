import type { TaskStatus } from "@yunwu/shared";

export type SessionItem = {
  id: string;
  title: string;
  summary: string;
  status: "idle" | "running" | "done";
  updatedAt: string;
  model: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  time: string;
};

export type TaskItem = {
  id: string;
  title: string;
  progress: number;
  status: TaskStatus;
  eta: string;
  tags: string[];
};

export type ImageResult = {
  id: string;
  prompt: string;
  size: string;
  model: string;
  badge: string;
};

export const sessions: SessionItem[] = [
  {
    id: "s-001",
    title: "品牌 KV 首轮出图",
    summary: "已产出 4 张候选图，等待继续细化光影与构图。",
    status: "running",
    updatedAt: "2 分钟前",
    model: "gpt-image-1",
  },
  {
    id: "s-002",
    title: "活动海报文案润色",
    summary: "已生成三版标题与副标题。",
    status: "done",
    updatedAt: "18 分钟前",
    model: "gpt-image-1.5",
  },
  {
    id: "s-003",
    title: "角色设定整理",
    summary: "待补充世界观设定与视觉提示词。",
    status: "idle",
    updatedAt: "今天 09:42",
    model: "gpt-image-2",
  },
];

export const messages: ChatMessage[] = [
  {
    id: "m-001",
    role: "system",
    content: "已加载演示会话。当前为前端静态壳，后续会接入真实 Gateway API。",
    time: "14:20",
  },
  {
    id: "m-002",
    role: "user",
    content: "帮我为春季发布会做一版高级感主视觉，保留轻雾和金属反光。",
    time: "14:21",
  },
  {
    id: "m-003",
    role: "assistant",
    content:
      "已创建图像任务：品牌 KV / 暗色背景 / 金属边缘高光 / 雾感层次。建议先出 4 张构图方向，再挑 1 张继续编辑。",
    time: "14:22",
  },
];

export const tasks: TaskItem[] = [
  {
    id: "task-1138",
    title: "主视觉文生图",
    progress: 72,
    status: "running",
    eta: "约 40 秒",
    tags: ["image.generate", "openai-compatible"],
  },
  {
    id: "task-1134",
    title: "提示词拆解与重写",
    progress: 100,
    status: "succeeded",
    eta: "已完成",
    tags: ["prompt"],
  },
];

export const imageResults: ImageResult[] = [
  {
    id: "img-201",
    prompt: "高级感发布会主视觉，冷灰背景，金属切面，柔雾，高光边缘。",
    size: "1536 × 1024",
    model: "gpt-image-1",
    badge: "候选 A",
  },
  {
    id: "img-202",
    prompt: "中心构图，玻璃与铝材质混合，轻薄体积雾，品牌蓝点缀。",
    size: "1536 × 1024",
    model: "gpt-image-1",
    badge: "候选 B",
  },
];

export const modelOptions = ["gpt-image-1", "gpt-image-1.5", "gpt-image-2"];
export const capabilityOptions = ["文生图", "图片编辑", "蒙版编辑", "任务追踪"];

export const adminModelToggles = [
  {
    key: "gpt-image-1",
    label: "GPT Image 1",
    enabled: true,
    desc: "用于首轮 OpenAI-compatible 文生图与图片编辑。",
  },
  {
    key: "gpt-image-1.5",
    label: "GPT Image 1.5",
    enabled: true,
    desc: "预留更高质量图像生成能力。",
  },
  {
    key: "qwen-image-max",
    label: "Qwen Image Max",
    enabled: false,
    desc: "文档状态异常，首轮默认隐藏，管理员可手动启用。",
  },
];

export const adminTasks = [
  { id: "job-8102", type: "image.generate", owner: "demo-user", status: "running", updatedAt: "1 分钟前" },
  { id: "job-8098", type: "image.edit", owner: "demo-user", status: "queued", updatedAt: "6 分钟前" },
  { id: "job-8081", type: "image.generate", owner: "admin", status: "succeeded", updatedAt: "今天 10:12" },
];
