# 设计文档：MCP 节点

## 设计概述

`mcp` 是高价值、高风险节点，Cube 的 A2A / skills / tool 体系可作为承接层。

## 接口映射

- `web-aigc` 节点：`mcp`
- Cube 承接：`server/routes/a2a.ts`、`server/routes/skills.ts`

## 运行流程

1. 解析工具目标
2. 校验权限
3. 发起调用
4. 输出标准化结果
