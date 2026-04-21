# 设计文档：对话节点

## 设计概述

`dialogue` 节点是高优先级迁移对象，直接连接 `web-aigc` 的编排能力和 Cube 的对话系统。

## 接口映射

- `web-aigc` 节点：`dialogue`
- Cube 承接：`server/routes/chat.ts`、workflow 详情、实例会话

## 运行流程

1. 读取当前会话
2. 注入上下文增强信息
3. 生成回复
4. 写入会话消息与节点输出
