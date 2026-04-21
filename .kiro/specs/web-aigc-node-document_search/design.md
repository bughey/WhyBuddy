# 设计文档：文档检索节点

## 设计概述

`document_search` 是 Cube 现有 RAG / knowledge 能力的自然承接点。

## 接口映射

- `web-aigc` 节点：`document_search`
- Cube 承接：`server/routes/rag.ts`、`server/routes/knowledge.ts`

## 运行流程

1. 选择文档范围
2. 执行检索
3. 输出命中文档与片段
4. 供下游消费
