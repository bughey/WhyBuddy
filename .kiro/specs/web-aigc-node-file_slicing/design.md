# 设计文档：文件切片节点

## 设计概述

`file_slicing` 节点属于内容预处理节点，适合直接挂接 Cube 的 RAG 数据预处理思路。

## 接口映射

- `web-aigc` 节点：`file_slicing`
- Cube 承接：RAG ingest 预处理逻辑

## 运行流程

1. 读取文件内容
2. 执行切片策略
3. 生成切片数组
4. 输出给下游节点
