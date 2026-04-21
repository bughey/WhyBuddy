# 设计文档：Web-AIGC 平台可观测与审计

## 设计概述

该 spec 将图编排事件融合到 Cube 已有 `telemetry / replay / audit / lineage` 体系，而不是另起监控栈。

## 设计要点

1. 节点事件写入 replay 事件流
2. 关键操作写入 audit 事件流
3. 外部调用与数据操作写入 lineage 或证据链
4. UI 上按实例、节点、任务三层查看

## Cube 承接

- `server/routes/replay.ts`
- `server/routes/audit.ts`
- `server/routes/telemetry.ts`
- `server/routes/lineage.ts`

## 设计约束

- 每个高风险节点都必须定义审计点
- 每个等待输入节点都必须有回放证据
