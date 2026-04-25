# ChatHub AI 理解与扩展指南

本文档面向需要阅读、修改、扩展本仓库的 AI 或开发者，目标不是介绍产品功能，而是快速建立对代码结构、运行机制、消息链路和扩展点的准确心智模型。

## 1. 项目一句话

ChatHub 是一个基于 Chrome Extension Manifest V3 的多模型聊天客户端。它把不同来源的 Bot 适配到统一接口上，再通过 React UI 提供单 Bot 和多 Bot 的聊天体验。

可以把项目拆成四层：

1. 扩展壳层：`manifest.config.ts`、`src/background`、`src/content-script`
2. 应用 UI 层：`src/app`
3. Bot 适配层：`src/app/bots`
4. 服务与存储层：`src/services`、`src/types`、`src/utils`

## 2. 阅读顺序

如果目标是理解项目，推荐按下面顺序读：

1. `manifest.config.ts`
2. `src/background/index.ts`
3. `src/app/main.tsx`
4. `src/app/router.tsx`
5. `src/app/hooks/use-chat.ts`
6. `src/app/bots/abstract-bot.ts`
7. `src/app/bots/index.ts`
8. `src/services/user-config.ts`
9. `src/services/chat-history.ts`

如果目标是扩展功能，优先补读：

1. `src/app/consts.ts`
2. 目标 Bot 对应目录，例如 `src/app/bots/chatgpt`、`src/app/bots/claude`
3. `src/services/agent/index.ts`
4. `src/services/proxy-fetch.ts`

## 3. 仓库结构

### 3.1 顶层结构

```text
.
|- manifest.config.ts        # Chrome 扩展声明
|- vite.config.ts            # Vite + CRXJS 构建配置
|- app.html                  # 主应用入口 HTML
|- sidepanel.html            # 侧边栏入口 HTML
|- src/
|  |- app/                   # React 应用
|  |- background/            # 扩展后台
|  |- content-script/        # 内容脚本
|  |- services/              # 存储、代理、服务接口
|  |- types/                 # 通用类型
|  |- utils/                 # 基础工具
|- _locales/                 # 扩展国际化文案
```

### 3.2 `src/app` 结构

```text
src/app/
|- bots/                     # Bot 抽象和各模型实现
|- components/               # 共享 UI 组件
|- hooks/                    # React hooks，聊天主链路在这里
|- i18n/                     # 应用内国际化
|- pages/                    # 路由页面
|- state/                    # Jotai 状态定义
|- utils/                    # 仅 UI 层使用的工具
|- consts.ts                 # Bot 元数据、默认常量
|- main.tsx                  # 主应用入口
|- router.tsx                # 路由定义
|- sidepanel.tsx             # 侧边栏入口
```

## 4. 运行面

这个项目不是单一前端进程，而是多个运行面的组合。

### 4.1 主应用

- 入口：`app.html` -> `src/app/main.tsx`
- 作用：主聊天界面、设置页、会员页、多 Bot 对比页
- 技术：React + TanStack Router

### 4.2 侧边栏

- 入口：`sidepanel.html` -> `src/app/sidepanel.tsx`
- 作用：在浏览器侧边栏打开 ChatHub
- 特点：当前逻辑带 Premium 判断，未激活时展示引导页

### 4.3 后台脚本

- 入口：`src/background/index.ts`
- 作用：
  - 点击扩展图标时打开主应用
  - 安装后打开设置页
  - 监听快捷键 `open-app`
  - 响应发往 background 的消息

### 4.4 内容脚本

- 入口：`src/content-script/chatgpt-inpage-proxy.ts`
- 作用：注入页面上下文能力，用于特定站点的代理或兼容逻辑

## 5. 启动链路

### 5.1 扩展启动

1. 浏览器加载 Manifest V3 扩展
2. 注册 `background service_worker`
3. 注册 `content_scripts`
4. 注册 `side_panel`
5. 用户点击扩展图标或快捷键时，后台脚本打开 `app.html`

### 5.2 主应用启动

`src/app/main.tsx` 做的事情很少但很关键：

1. 初始化 Sentry
2. 初始化 i18n
3. 挂载 Router
4. 开启 Plausible 页面统计

因此，如果页面打不开、路由不生效、国际化异常，主入口是第一检查点。

## 6. UI 路由模型

`src/app/router.tsx` 定义了几条核心路由：

- `/`：多 Bot 聊天页面
- `chat/$botId`：单 Bot 聊天页面
- `setting`：设置页面
- `premium`：会员页面

理解这个项目时可以把页面视为两类：

1. 聊天相关：`MultiBotChatPanel`、`SingleBotChatPanel`
2. 管理相关：设置、会员、侧边栏

## 7. 核心对象模型

### 7.1 BotId

`src/app/bots/index.ts` 中的 `BotId` 是系统中的核心标识。很多配置、路由、历史记录、页面状态都依赖它。

如果新增 Bot，通常第一步是扩展 `BotId` 联合类型。

### 7.2 CHATBOTS

`src/app/consts.ts` 中的 `CHATBOTS` 定义 Bot 的展示元数据：

- 显示名
- 头像

它主要影响 UI 展示和默认启用列表，不负责真正的发送逻辑。

### 7.3 AbstractBot

`src/app/bots/abstract-bot.ts` 是最关键的抽象层。上层 UI 不直接关心某个模型怎么鉴权、怎么发请求、怎么处理流式响应，只要求它实现统一协议。

统一输入：

- `prompt`
- `rawUserInput`
- `image`
- `signal`

统一输出事件：

- `UPDATE_ANSWER`
- `DONE`
- `ERROR`

统一生命周期方法：

- `doSendMessage()`
- `resetConversation()`

这意味着：

1. Bot 目录是最主要的扩展点
2. UI 层和具体模型实现是解耦的
3. 新增 Bot 的关键是适配 `AbstractBot` 协议，而不是改 UI 主流程

### 7.4 AsyncAbstractBot

某些 Bot 初始化依赖异步准备，例如读取配置、建立客户端、准备会话上下文。这类 Bot 可以继承 `AsyncAbstractBot`，把真正实例延后到 `initializeBot()`。

这个抽象的意义是：

- 上层仍然只拿到一个 Bot 实例
- 初始化细节被封装
- 延迟失败会转为发送时错误

## 8. 消息主链路

消息发送主流程集中在 `src/app/hooks/use-chat.ts`。

可以把一次聊天理解为以下步骤：

1. UI 调用 `sendMessage(input, image?)`
2. 先往本地状态写入用户消息和一个空的 Bot 消息
3. 创建 `AbortController`
4. 如果有图片，先压缩图片
5. 调用 `chatState.bot.sendMessage(...)`
6. 按流式结果不断更新 Bot 消息文本
7. 结束或报错后清理 `generatingMessageId` 和 `abortController`
8. `useEffect` 监听消息变化并落盘到历史记录

### 8.1 重要事实

- UI 更新是乐观的，发送前就会先插入消息占位
- Bot 回复是流式覆盖更新，不是一次性替换
- 中断是通过 `AbortController` 完成
- 历史记录是副作用持久化，不是发送链路的一部分

### 8.2 为什么这很重要

如果你要改发送行为，优先判断修改应该落在哪一层：

- 改 UI 交互：看 `use-chat.ts` 和输入组件
- 改模型请求：看具体 Bot
- 改历史记录：看 `chat-history.ts`
- 改请求代理：看 `proxy-fetch.ts`

## 9. 状态与持久化

### 9.1 页面状态

应用状态主要在 `src/app/state`，聊天页通过 Jotai atom 管理会话状态。

在 `use-chat.ts` 中可见的关键信息包括：

- 当前 Bot 实例
- 当前消息列表
- 正在生成的消息 ID
- 当前的 `AbortController`
- 会话 ID

### 9.2 用户配置

`src/services/user-config.ts` 负责用户配置的读取与更新，持久化位置是 `Browser.storage.sync`。

这类配置包括：

- ChatGPT 模式选择：Webapp / API / Azure / Poe / OpenRouter
- Claude 模式选择：Webapp / API / Poe / OpenRouter
- 启动页
- 启用的 Bot 列表
- 各平台 API Key
- Web Access 开关

理解点：

- `sync` 存放“设置”
- 设置通常跨设备同步

### 9.3 聊天历史

`src/services/chat-history.ts` 负责历史消息，持久化位置是 `Browser.storage.local`。

键设计如下：

```text
conversations:$botId
conversation:$botId:$cid:messages
```

理解点：

- `local` 存放“内容”
- 历史记录按 `botId` 和 `conversationId` 分片
- 写入入口主要是 `setConversationMessages()`

## 10. Bot 适配体系

### 10.1 工厂函数

`src/app/bots/index.ts` 中的 `createBotInstance(botId)` 是 Bot 实例分发中心。

它负责把 `BotId` 映射到具体实现，例如：

- `chatgpt` -> `ChatGPTBot`
- `claude` -> `ClaudeBot`
- `bing` -> `BingWebBot`
- 若干开源模型 -> `LMSYSBot(...)`

这是新增 Bot 时必须更新的地方。

### 10.2 一个 Bot 可能有多种模式

这个仓库不是简单地“一模型一实现”，而是“一类产品可有多种接入方式”。

例如：

- ChatGPT：Webapp / API / Azure / Poe / OpenRouter
- Claude：Webapp / API / Poe / OpenRouter
- Perplexity：Webapp / API

因此，新增能力时先判断你是在做：

1. 新 Bot
2. 已有 Bot 的新模式
3. 已有模式下的新参数

三者对应的改动范围不同。

### 10.3 Web Access Agent

`src/services/agent/index.ts` 提供了一个轻量工具调用流程，用于在需要时先执行 Web Search，再把上下文交给 LLM 生成最终回答。

可把它理解成：

1. 先让模型判断是否需要工具
2. 若需要，执行搜索
3. 把搜索上下文重新拼回 Prompt
4. 再次请求模型生成最终答案

这不是整个系统的统一 Agent 框架，而是一个为 Web Access 场景服务的定向实现。

## 11. 扩展运行机制

### 11.1 Manifest 关注点

`manifest.config.ts` 里最重要的是：

- `background`
- `content_scripts`
- `side_panel`
- `host_permissions`
- `optional_host_permissions`
- `declarative_net_request`

如果你要扩展新的站点、接新的网页服务、增加站点权限，通常需要先检查这里。

### 11.2 Background 的职责边界

`src/background/index.ts` 当前职责比较聚焦：

- 打开应用页面
- 响应安装事件
- 响应快捷键
- 处理部分运行时消息

不要把所有逻辑都堆到 background。只有明确依赖扩展后台能力的逻辑才应该放进去。

### 11.3 Proxy Fetch

`src/services/proxy-fetch.ts` 的作用是通过 `tabs.connect` 建立端口，把请求转发到特定 tab 或上下文中执行，再把响应流传回调用方。

这个机制通常用于：

- 规避某些站点环境限制
- 复用站点上下文中的会话或权限
- 处理必须从页面侧发起的请求

如果某个 Bot 无法直接在扩展上下文中 `fetch`，优先检查是否应该走这条链路。

## 12. 新增一个 Bot 的最小改动集

如果目标是新增一个新的 Bot，通常按下面顺序改：

1. 在 `src/app/bots/index.ts` 扩展 `BotId`
2. 在 `src/app/consts.ts` 为 `CHATBOTS` 增加展示元数据
3. 新建 `src/app/bots/<bot-name>/index.ts`
4. 让该实现继承 `AbstractBot` 或 `AsyncAbstractBot`
5. 在 `createBotInstance()` 中注册新实例
6. 如果需要用户配置，在 `src/services/user-config.ts` 增加配置项
7. 如果需要设置 UI，在 `src/app/components/Settings` 下增加对应表单
8. 如果需要额外权限或站点匹配，更新 `manifest.config.ts`

### 12.1 Bot 实现的最小职责

一个合格的 Bot 实现至少要回答以下问题：

1. 如何发送请求
2. 如何解析流式返回
3. 如何在结束时发出 `DONE`
4. 如何在异常时发出 `ERROR`
5. 如何重置会话

### 12.2 不要优先改的地方

新增 Bot 时，通常不需要先改这些地方：

- `use-chat.ts`
- `router.tsx`
- 主应用入口

除非你的需求确实改变了全局消息模型或页面结构。

## 13. 新增功能时的定位规则

为了减少误改，可按下面规则判断代码应该落在哪：

- 跟页面展示相关：`src/app/components` 或 `src/app/pages`
- 跟消息发送编排相关：`src/app/hooks/use-chat.ts`
- 跟具体模型接入相关：`src/app/bots/*`
- 跟浏览器扩展能力相关：`src/background`、`src/content-script`、`manifest.config.ts`
- 跟存储相关：`src/services/user-config.ts`、`src/services/chat-history.ts`
- 跟通用请求代理或基础设施相关：`src/services/*`、`src/utils/*`

## 14. 常见改动场景

### 14.1 增加新的模型供应商

优先查看：

- `src/app/bots/index.ts`
- `src/app/bots/abstract-bot.ts`
- `src/app/consts.ts`
- `src/services/user-config.ts`

### 14.2 给现有模型增加配置项

优先查看：

- `src/services/user-config.ts`
- `src/app/components/Settings`
- 对应 Bot 实现目录

### 14.3 调整消息持久化行为

优先查看：

- `src/app/hooks/use-chat.ts`
- `src/services/chat-history.ts`

### 14.4 处理某个网站请求失败

优先查看：

- 目标 Bot 实现
- `src/services/proxy-fetch.ts`
- `manifest.config.ts`
- `src/content-script`

## 15. 关键不变量

理解和修改本项目时，尽量保持以下不变量不被破坏：

1. 上层 UI 通过统一 Bot 接口工作，不直接依赖某个模型的私有实现
2. `BotId` 是跨 UI、配置、历史、工厂函数的共享主键
3. 历史记录与用户设置分开存储，前者偏内容，后者偏配置
4. 扩展能力相关逻辑优先留在扩展边界层，不混入普通 UI 代码
5. 页面结构和 Bot 实现尽量解耦

## 16. 给 AI 的修改建议

如果你是 AI，并且准备修改这个仓库，建议先做以下判断：

1. 这次改动属于 UI、Bot、扩展机制、存储，还是通用基础设施
2. 是否会新增或修改 `BotId`
3. 是否需要新增用户配置项
4. 是否需要 Manifest 权限或内容脚本支持
5. 是否会影响流式消息更新和中断逻辑

推荐工作流：

1. 先定位改动层级
2. 再从入口文件追到具体实现
3. 只在真正需要的层做修改
4. 修改后优先验证构建和类型检查

## 17. 本项目当前的工程特征

- 单仓库，不是 monorepo
- 构建入口简单，核心命令是 `yarn dev` 和 `yarn build`
- 自动化测试痕迹较少，很多改动需要依赖构建和手动验证
- Bot 目录是业务复杂度最高的区域
- 扩展权限和站点兼容性是变更风险较高的区域

## 18. 结论

理解这个项目最重要的不是先记住所有页面，而是掌握下面三件事：

1. Bot 通过 `AbstractBot` 统一抽象
2. 消息主链路集中在 `use-chat.ts`
3. 扩展特性由 `manifest.config.ts`、`background`、`content-script` 共同支撑

只要先建立这三个认知，再做新增 Bot、改设置、调请求、修页面，定位成本会显著降低。
