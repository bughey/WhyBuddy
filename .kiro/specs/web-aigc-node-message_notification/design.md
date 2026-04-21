# 设计文档：消息通知节点

## 设计概述

`message_notification` 属于高风险动作节点，需与任务运营动作和消息通道治理结合。

## 接口映射

- `web-aigc` 节点：`message_notification`
- Cube 承接：通知适配器 + audit

## 运行流程

1. 组装通知内容
2. 校验渠道与权限
3. 发送通知
4. 输出发送结果
