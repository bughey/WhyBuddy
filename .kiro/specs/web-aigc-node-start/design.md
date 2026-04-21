# 设计文档：开始节点

## 设计概述

`start` 节点不承担业务逻辑，重点是把 workflow 输入转换成图运行时上下文。

## 接口映射

- `web-aigc` 节点：`start`
- Cube 承接：`server/routes/workflows.ts`、`shared/workflow-input.ts`

## 运行流程

1. 接收 directive 与附件
2. 生成上下文签名
3. 初始化实例变量
4. 推进到下游节点
