# 设计文档：Web-AIGC 平台领域模型

## 设计概述

该 spec 负责定义迁移总模型，不直接承载某个具体节点逻辑，而是为所有节点 spec 提供统一命名和运行时语义。

## 核心设计

1. 定义态：`graph_definition / graph_version / node_schema / edge_schema`
2. 运行态：`graph_instance / node_run / edge_transition / session_link`
3. 投影态：`workflow_link / mission_link / replay_link / audit_link`

## 接口映射

- `web-aigc` 来源：编排定义 API、版本 API、监控 API
- Cube 承接：`server/routes/workflows.ts`、`server/routes/tasks.ts`、`server/routes/replay.ts`

## 设计约束

- 不先做可视化设计器，先做统一模型
- 不允许每个节点各自定义一套状态和值结构
