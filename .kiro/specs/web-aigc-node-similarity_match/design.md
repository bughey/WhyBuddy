# 设计文档：相似匹配节点

## 设计概述

`similarity_match` 节点适合接入 Cube 的向量检索或文本比较能力，作为控制流前置节点。

## 接口映射

- `web-aigc` 节点：`similarity_match`
- Cube 承接：RAG / embedding / 检索适配器

## 运行流程

1. 获取待比对输入
2. 执行相似度计算
3. 输出分值与命中结果
4. 交给条件节点使用
