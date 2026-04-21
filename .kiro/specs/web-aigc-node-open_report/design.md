# 设计文档：打开报告节点

## 设计概述

`open_report` 可依托 Cube 当前 workflow report 与 replay report 能力，不需独立实现报告系统。

## 接口映射

- `web-aigc` 节点：`open_report`
- Cube 承接：`server/routes/workflows.ts` 报告接口

## 运行流程

1. 解析目标报告
2. 校验上下文与权限
3. 触发前端打开
4. 记录操作事件
