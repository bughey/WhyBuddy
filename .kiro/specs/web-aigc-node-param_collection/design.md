# 设计文档：参数采集节点

## 设计概述

`param_collection` 是用户输入节点的结构化版本，适合复用任务决策与表单输入模型。

## 接口映射

- `web-aigc` 节点：`param_collection`
- Cube 承接：`server/routes/tasks.ts`

## 运行流程

1. 渲染参数字段定义
2. 等待用户提交
3. 校验字段
4. 回写参数对象
