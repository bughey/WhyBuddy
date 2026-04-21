# 设计文档：OCR 识别节点

## 设计概述

`ocr_recognition` 是可直接迁移的多模态读取节点，Cube 的 vision 路由可承接。

## 接口映射

- `web-aigc` 节点：`ocr_recognition`
- Cube 承接：`server/routes/vision.ts`

## 运行流程

1. 读取图像输入
2. 调用 OCR 服务
3. 输出识别文字
4. 写入上下文或产物
