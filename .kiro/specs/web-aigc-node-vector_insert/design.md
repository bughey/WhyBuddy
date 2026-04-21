# 设计文档：向量插入节点

## 设计概述

`vector_insert` 属于向量写入节点，应和 RAG ingest 体系合流，而不是单独写库。

## 接口映射

- `web-aigc` 节点：`vector_insert`
- Cube 承接：`server/routes/rag.ts` ingest 能力与管理接口

## 运行流程

1. 校验写入权限
2. 执行切片与 embedding
3. 写入向量库
4. 返回写入结果
