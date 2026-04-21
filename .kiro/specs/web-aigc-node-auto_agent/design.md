# 设计文档：自动代理节点

## 设计概述

`auto_agent` 节点适合复用 Cube 的 A2A、skills、guest agents 能力。

## 接口映射

- `web-aigc` 节点：`auto_agent`
- Cube 承接：`server/routes/a2a.ts`、`server/routes/skills.ts`、`server/routes/guest-agents.ts`

## 运行流程

1. 选择代理或能力
2. 下发输入载荷
3. 等待执行结果
4. 将结果写回上下文
