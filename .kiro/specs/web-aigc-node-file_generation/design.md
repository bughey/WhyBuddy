# 设计文档：文件生成节点

## 设计概述

`file_generation` 是对 Cube artifact 体系的直接增益节点。

## 接口映射

- `web-aigc` 节点：`file_generation`
- Cube 承接：`server/routes/tasks.ts` artifact 路由

## 运行流程

1. 接收内容
2. 写入目标文件
3. 注册产物元数据
4. 输出下载地址
