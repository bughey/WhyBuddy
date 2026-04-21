# 设计文档：确认判断节点

## 设计概述

`confirm_judge` 节点与 Cube 当前 HITL 决策体系天然契合，适合优先迁移。

## 接口映射

- `web-aigc` 节点：`confirm_judge`
- Cube 承接：`server/routes/tasks.ts`、decision templates

## 运行流程

1. 节点进入等待态
2. 展示确认或驳回选项
3. 记录用户选择
4. 推进不同分支
