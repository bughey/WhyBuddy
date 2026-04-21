# 设计文档：Web-AIGC 平台实例与会话

## 设计概述

该 spec 直接参考 `web-aigc/src/pages/aigc/agent-monitoring/services/monitorApi.ts` 中的实例监控模型，但输出应对齐 Cube 的运行时接口。

## 设计要点

1. 实例列表映射到 workflow 运行态列表
2. 节点详情映射到 replay 快照与节点运行记录
3. 会话详情映射到聊天消息与工具调用记录
4. 终止能力复用任务取消与执行器取消链路

## Cube 承接

- `server/routes/workflows.ts`
- `server/routes/tasks.ts`
- `server/routes/replay.ts`

## 设计约束

- 实例监控优先于编排设计器实现
- 节点详情必须可回放、可定位、可追踪
