# Tearframe Architecture

Tearframe 分为三层：

1. Web UI：纯数据驱动渲染，不调用 LLM，不解析视频。
2. Backend：样片管理、预处理流水线、拉片产物存储、模板聚合、MCP server。
3. External Agent：通过 Skill + MCP 按 schema 提交八维度卡片与关系。

核心数据流：样片入库 → 元信息抓取 → 预处理资源 → agent 拉片 → 卡片/模板/关系入库 → UI 渲染。
