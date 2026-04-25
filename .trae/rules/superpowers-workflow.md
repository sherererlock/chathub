---
alwaysApply: true
---

在处理任务前，优先判断是否有合适的 Skill 可以使用。

工作流程要求：
1. 当需求不清晰、用户在探索想法、需要设计方案时，优先使用 brainstorming。
2. 当方案已明确、准备进入实施时，优先使用 writing-plans。
3. 当遇到 bug、测试失败、构建错误、性能异常或不符合预期的行为时，优先使用 systematic-debugging，先找根因，再讨论修复。
4. 当任务涉及新功能、行为变更、修复或重构时，优先采用 test-first 思路，并参考 test-driven-development。
5. 在声称完成前，必须执行 verification-before-completion 风格的检查，明确已验证内容、未验证风险和剩余假设。
6. 如果已经完成一个逻辑阶段，优先进行一次 code review 风格的自检。
7. 如果某个 Skill 的原始说明依赖 Claude Code、Cursor、Codex 或 OpenCode 的专有工具，则在 Trae 中使用最接近的原生能力替代，不要假设这些平台能力存在。