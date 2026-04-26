# AI 协作讨论模式设计

## 概述

新增"讨论模式"作为独立侧边栏入口：所有 AI 的回复汇聚在一条统一时间线中，用户可以用 `@模型名` 精确指向某个 AI，AI 能看到完整对话上下文，实现真正的多 AI 协作讨论。

## 核心交互规则

- **普通消息（无 @）**：只发给当前选中的主参与者
- **@ 消息**：只发给被 @ 的参与者（可同时 @ 多个）；输入 `@` 后弹出下拉选择器
- **引用**：点击时间线中任意消息可将其设为引用，发送时显示引用气泡
- **主参与者切换**：点击 Header 中参与者头像即切换

### 交互示例

```
User → GPT-4.1（主参与者）: 我有个想法...
GPT-4.1: 这个想法不错，但有个问题...
User → GPT-4.1: 能详细说说吗？
GPT-4.1: 主要问题是...
User @ClaudeSonnet: 你怎么评价GPT-4.1的观点？
Claude Sonnet: 我认为GPT说的有道理，但...
User → GPT-4.1: 你同意Claude的说法吗？
GPT-4.1: 部分同意...
```

## 参与者模型（DiscussionParticipant）

@ 的粒度细化到**具体模型**，而非 bot 类型：

```ts
interface DiscussionParticipant {
  id: string           // 唯一键，e.g. 'towerai:gpt-4.1', 'claude'
  botId: BotId         // 底层 bot 类型
  displayName: string  // UI 显示名，e.g. 'GPT-4.1', 'Claude Sonnet'
  modelId?: string     // TowerAI 专用：调用 bot.setModel() 锁定模型
}
```

TowerAI 的每个模型（GPT-4.1、Claude Sonnet、Gemini 3.1 Pro Preview 等）都是独立参与者，通过 `TowerAIBot.setModel(modelId)` 实现模型锁定。

## 消息模型

```ts
interface DiscussionMessage {
  id: string
  author: 'user' | BotId
  authorDisplayName?: string  // bot 消息的显示名（e.g. 'GPT-4.1'）
  text: string
  replyTo?: string            // 被引用消息的 id
  mentionedBots?: BotId[]     // 这条消息 @ 了哪些 bot
}
```

## UI 布局

```
┌─────────────────────────────────────────────────┐
│ 侧边栏: All-In-One / 讨论模式 / Claude / TowerAI │
├─────────────────────────────────────────────────┤
│  [讨论模式页面]                                   │
│  ┌──────────────────────────────────────────┐   │
│  │ 讨论模式  [GPT-4.1] [Claude Sonnet] ...  │   │  ← ParticipantBar
│  ├──────────────────────────────────────────┤   │
│  │ 👤 User: 我有个想法...                    │   │
│  │ 🤖 GPT-4.1: 这个想法很棒...              │   │  ← DiscussionTimeline
│  │ 👤 User @ClaudeSonnet: 你怎么看？         │   │
│  │    └─ 引用: "GPT-4.1: 这个..."           │   │
│  │ 🤖 Claude Sonnet: GPT的观点在于...       │   │
│  │ ⏳ Gemini 3.1 正在回复...                │   │
│  ├──────────────────────────────────────────┤   │
│  │ 快捷@: [GPT-4.1] [Claude Sonnet]        │   │
│  │ ┌────────────────────────────────┐ Send │   │  ← DiscussionInput
│  │ │ @ClaudeSonnet 你觉得呢？        │      │   │
│  │ └────────────────────────────────┘      │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

输入 `@` 时弹出浮动下拉框，显示所有可用模型供选择。

## 文件结构

### 新增文件

```
src/app/pages/DiscussionPanel.tsx
src/app/hooks/use-discussion.ts
src/app/utils/discussion-participants.ts   # participant 工具函数
src/app/components/Discussion/
  DiscussionTimeline.tsx
  DiscussionMessageCard.tsx
  DiscussionInput.tsx                      # 含 @ 下拉选择器
  ParticipantBar.tsx
```

### 修改文件

- `src/app/router.tsx` — 新增 `/discussion` 路由
- `src/app/components/Sidebar/index.tsx` — 新增"讨论模式"侧边栏入口
- `src/types/chat.ts` — 新增 `DiscussionMessage`、`DiscussionParticipant` 类型

## 核心实现

### 参与者工具（discussion-participants.ts）

- `getAllParticipants()` — 返回所有可用参与者：TowerAI 各模型 + 其他 bot
- `createParticipantBot(p)` — 创建 bot 实例，TowerAI 参与者调用 `setModel()` 锁定模型
- `DEFAULT_PARTICIPANTS` — 默认取 TowerAI 前两个模型

### use-discussion hook

1. 维护统一 `messages: DiscussionMessage[]`
2. 维护 `participants: DiscussionParticipant[]` 和 `activeParticipant`
3. `parseMentions(input, participants)` — 解析 `@DisplayName`，匹配参与者
4. `formatHistoryPrompt(messages)` — 将时间线格式化为 prompt 传给 bot
5. 每次发送前 `bot.resetConversation()`，完整历史通过 prompt 传入

### Prompt 格式化

```
以下是多AI协作讨论的历史记录：

[User]: 我有个想法...
[GPT-4.1]: 这个想法很棒...
[Claude Sonnet]: 我补充一点...

请基于以上历史，回答用户的最新消息。

[User]: @ClaudeSonnet 你怎么看GPT-4.1的观点？
```

## 设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 入口位置 | 侧边栏独立入口（`/discussion` 路由） | 与 All-In-One、单 bot 对话并列，而非嵌入布局切换器 |
| @ 粒度 | 具体模型（而非 bot 类型） | 用户需要区分 GPT-4.1 vs Claude Sonnet vs Gemini |
| TowerAI 模型切换 | `TowerAIBot.setModel(modelId)` | Bot 层已提供此方法，无需修改 API 层 |
| @ 触发方式 | 输入 `@` 弹出下拉选择器 | 比预设快捷按钮更灵活，支持搜索过滤 |
| Bot 历史状态 | 每次发送前 `resetConversation()`，全量 prompt | 无需维护各 bot 内部状态，避免状态不一致 |
