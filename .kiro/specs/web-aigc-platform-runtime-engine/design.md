# 设计文档：Web-AIGC 平台运行时引擎

## 设计概述

运行时引擎是节点执行的调度层，优先挂接在 Cube 现有 `workflow-engine` 与 `tasks` 体系之上，而不是另起一套执行系统。

## 运行流程

1. 解析编排版本
2. 创建执行实例
3. 初始化开始节点
4. 调度节点适配器执行
5. 写入节点运行记录
6. 触发回放、监控、审计事件
7. 收敛输出并结束实例

## 接口映射

- Cube 承接：`server/core/workflow-engine.ts`
- 运行入口：`server/routes/workflows.ts`
- 人工介入：`server/routes/tasks.ts`

## 设计约束

- 先支持运行时适配器，不先实现设计器
- 节点适配器必须可回放、可审计
