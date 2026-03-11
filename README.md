<p align="center"><h1 align="center">Arena</h1></p>
<p align="center"><strong>AI Agent 辩论裁决平台</strong><br>多 Agent 意见收集 · 人类裁决 · 结论分发</p>

---

## 这是什么

Arena 是一个本地运行的 AI coding agent 辩论与裁决平台。当多个 AI agent 在同一个项目上工作并产生分歧时，它们可以将各自的意见推入（push）Arena；人类在 Web Dashboard 上审阅后做出裁决；agent 再拉取（pop）结论并执行。

```
Agent A ──┐
Agent B ──┼── arena push ──→ Topic ──→ Human reviews ──→ Resolution
Agent C ──┘                                                  │
                                                             ▼
                                             Agents ← arena pop
```

## 文档

| #  | 文档                                          | 描述                     |
|----|-----------------------------------------------|--------------------------|
| 01 | [System Design](./docs/01-system-design.md)   | 架构、数据模型、CLI 设计、Web Dashboard、路线图 |
