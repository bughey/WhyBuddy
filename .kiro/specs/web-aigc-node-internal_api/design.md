# 设计文档：内部接口节点

## 设计概述

`internal_api` 节点属于高耦合企业节点，适合后期再做定制适配。

## 接口映射

- `web-aigc` 节点：`internal_api`
- Cube 承接：内部服务适配器 + permissions / audit

## 运行流程

1. 校验调用权限
2. 组装请求
3. 调用内部接口
4. 输出结果或错误
