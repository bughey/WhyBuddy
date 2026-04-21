# 设计文档：透传接口节点

## 设计概述

`passthrough_api` 风险高于普通内部接口节点，默认应受更严格治理。

## 接口映射

- `web-aigc` 节点：`passthrough_api`
- Cube 承接：外部接口适配器 + permissions / audit

## 运行流程

1. 校验目标接口是否允许
2. 透传请求参数
3. 接收响应
4. 输出标准化结果
