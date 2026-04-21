# 设计文档：Web-AIGC 平台安全与治理

## 设计概述

安全治理不按页面做，而按“操作类型 + 节点风险等级 + 数据类别”三层控制。

## 设计要点

1. 定义操作权限矩阵
2. 定义节点风险等级
3. 定义外部调用和数据写入的审计要求
4. 定义高风险节点的人工审批闸门

## Cube 承接

- `server/routes/permissions.ts`
- `server/routes/audit.ts`
- `server/routes/tasks.ts`

## 设计约束

- `vector_update / vector_insert / vector_delete / transaction_flow / mcp` 不能裸奔上线
- 发布与恢复必须进审计链
