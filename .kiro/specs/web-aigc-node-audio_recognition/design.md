# 设计文档：语音识别节点

## 设计概述

`audio_recognition` 是优先级较高的多模态节点，Cube 已有 `voice` 路由可承接。

## 接口映射

- `web-aigc` 节点：`audio_recognition`
- Cube 承接：`server/routes/voice.ts`

## 运行流程

1. 读取音频输入
2. 调用语音识别服务
3. 输出转写文本
4. 写入产物或上下文
