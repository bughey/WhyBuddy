# 设计文档：LLM 节点

## 设计概述

`llm` 节点是通用能力节点，目标是沉淀为多个智能节点共享的底层适配器，而不是页面级私有逻辑。

当前主仓已经形成较完整的服务端调用底座，因此本设计文档重点描述“已落地主链路”与“仍需保留的边界”。

## 接口映射

- `web-aigc` 节点：`llm`
- Cube 承接：共享 `LLM provider` 抽象、服务端 runtime、telemetry / cost 观测链路

## 当前主仓实现口径（2026-04-22）

- 共享契约层定义了统一的消息、参数、响应与 provider 接口。
- 服务端 runtime 统一挂接 `callLLM()` 与 `callLLMJson()`。
- LLM 客户端已处理 provider 选择、fallback、超时、错误归一与 JSON 解析容错。
- telemetry / cost 已能记录调用延迟、token 用量与成本结果，并通过 API 暴露。
- 浏览器直连路径存在，但不作为本 spec 当前完成度的主要判定依据。

## 运行流程

1. 上游节点或 runtime 组装提示消息、变量与调用参数。
2. 根据模型、温度、`maxTokens`、`jsonMode` 等参数选择调用策略。
3. 服务端通过统一 provider 抽象发起调用，必要时执行 fallback。
4. 普通文本结果走标准响应路径；结构化结果走 `callJson` / `invokeJson` 路径并做解析容错。
5. 调用过程把延迟、token 与成本写入 telemetry / cost 链路，供实时和历史接口读取。

## 边界与保留项

- 当前“4/4 已完成”的结论建立在服务端主链路，而不是所有端侧路径完全等价。
- 若后续把浏览器直连模式也纳入同等验收，需要补齐更精确的 token / cost 统计证据。
- 本 spec 当前不要求各业务节点分别重复实现 provider 选择、fallback 与指标写入逻辑。
