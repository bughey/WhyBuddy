# 设计文档：意图识别节点

## 设计概述

`intent_recognition` 节点适合承接到 Cube 现有自然语言命令与任务启动能力之上。

## 接口映射

- `web-aigc` 节点：`intent_recognition`
- Cube 承接：`server/routes/nl-command.ts`、workflow 入口

## 运行流程

1. 接收输入文本
2. 执行分类或判定
3. 输出意图标签
4. 将结果传递给分支或命令节点
