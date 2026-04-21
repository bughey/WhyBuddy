# 设计文档：静态网页读取节点

## 设计概述

`static_webpage_read` 是网页搜索链上的读取节点，适合与 web_search / web_qa 配套。

## 接口映射

- `web-aigc` 节点：`static_webpage_read`
- Cube 承接：网页读取适配器

## 运行流程

1. 获取网页地址
2. 抓取页面内容
3. 提取正文信息
4. 输出文本结果
