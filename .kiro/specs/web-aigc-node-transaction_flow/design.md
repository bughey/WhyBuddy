# 设计文档：事务流程节点

## 设计概述

`transaction_flow` 是最高风险节点之一，必须与治理 spec 绑定，不宜作为第一波上线能力。

## 接口映射

- `web-aigc` 节点：`transaction_flow`
- Cube 承接：运营动作服务 + permissions / audit

## 运行流程

1. 校验事务权限
2. 触发确认闸门
3. 执行业务动作
4. 记录结果与补偿信息
