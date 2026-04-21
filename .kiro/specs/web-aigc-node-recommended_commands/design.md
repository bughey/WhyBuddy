# 设计文档：推荐命令节点

## 设计概述

该节点适合承接 Cube 的自然语言命令中心与操作建议能力。

## 接口映射

- `web-aigc` 节点：`recommended_commands`
- Cube 承接：`server/routes/nl-command.ts`

## 运行流程

1. 读取当前上下文
2. 生成推荐命令列表
3. 输出推荐理由
4. 交由下游选择或确认节点处理
