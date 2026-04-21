# 设计文档：向量查询节点

## 设计概述

`vector_query` 与 Cube 的 RAG 检索基础高度兼容，是高价值、低风险迁移点。

## 接口映射

- `web-aigc` 节点：`vector_query`
- Cube 承接：`server/routes/rag.ts`

## 运行流程

1. 接收查询条件
2. 调用向量检索
3. 规范化结果
4. 输出给下游节点
