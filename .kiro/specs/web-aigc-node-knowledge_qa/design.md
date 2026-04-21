# 设计文档：知识问答节点

## 设计概述

`knowledge_qa` 是最适合迁移进 Cube RAG 与 knowledge 体系的高价值节点之一。

## 接口映射

- `web-aigc` 节点：`knowledge_qa`
- Cube 承接：`server/routes/knowledge.ts`、`server/routes/rag.ts`

## 运行流程

1. 接收问题
2. 检索知识上下文
3. 合成答案
4. 输出答案与引用
