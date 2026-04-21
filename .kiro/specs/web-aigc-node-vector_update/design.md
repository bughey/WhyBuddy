# 设计文档：向量更新节点

## 设计概述

`vector_update` 是高风险写操作节点，应后于 `vector_query` 实施。

## 接口映射

- `web-aigc` 节点：`vector_update`
- Cube 承接：RAG 管理接口与治理层

## 运行流程

1. 校验命名空间和权限
2. 执行更新
3. 写入审计与回放
4. 输出结果摘要
