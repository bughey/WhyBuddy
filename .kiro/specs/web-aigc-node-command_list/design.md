# 设计文档：命令列表节点

## 设计概述

`command_list` 节点更像任务编排中的候选动作输出节点，重点是结构化命令呈现。

## 接口映射

- `web-aigc` 节点：`command_list`
- Cube 承接：`server/routes/nl-command.ts`、`server/routes/tasks.ts`

## 运行流程

1. 生成候选命令
2. 写入命令列表结果
3. 输出给选择或推荐节点
4. 记录最终命中结果
