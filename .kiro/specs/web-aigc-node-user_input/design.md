# 设计文档：用户输入节点

## 设计概述

`user_input` 节点优先复用 Cube 已有任务决策与人工介入能力，而不是重新发明交互模型。

## 接口映射

- `web-aigc` 节点：`user_input`
- Cube 承接：`server/routes/tasks.ts`

## 运行流程

1. 节点进入等待态
2. 前台展示输入表单
3. 用户提交输入
4. 实例恢复执行
