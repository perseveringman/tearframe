# ShadowEnglish 对话日志导入 + AI 分析模块

> 所属项目：ShadowEnglish Electron 桌面应用 → v1.1 语料管理扩展之后
> 场景：用户每天跟豆包 AI 英语 Agent 聊天，下载文字记录，导入 ShadowEnglish 做卡片提取和记忆沉淀
> 日期：2026年6月3日

---

## 一、模块定位

影子跟读解决「跟读原声」，AI 对话解决「真实开口交流」。豆包英语 Agent 产生的聊天记录是**极佳的被动词→主动词转化素材**——每一句都带着真实的语境、真实的卡壳点、真实被纠正的表达。

在这个模块中，ShadowEnglish 新增一个**导入入口**：用户把豆包的聊天文字记录（txt/markdown/json）拖入或粘贴到应用中 → AI 自动解析 → 提取五维卡片 → 写入当天的学习日报 → 沉淀到 TiMem 画像。

---

## 二、输入格式约定

豆包下载的聊天记录通常有两种格式。系统自动识别：

### 格式 A：纯文本对话（每行一条，带角色前缀）

```
User: I want to order a coffee.
豆包: Sure! What kind of coffee would you like? We have latte, cappuccino...
User: A latte please. And can I have... um... 少糖怎么说？
豆包: "Less sugar" or "a little less sugar". Great choice!
```

### 格式 B：JSON 对话数组

```json
[
  {"role": "user", "content": "I want to order a coffee."},
  {"role": "assistant", "content": "Sure! What kind of coffee would you like?"},
  {"role": "user", "content": "A latte please. And can I have... um... 少糖怎么说？"},
  {"role": "assistant", "content": "\"Less sugar\" or \"a little less sugar\". Great choice!"}
]
```

### 导入方式

- **拖拽**：把 `.txt` / `.md` / `.json` 文件拖到 ShadowEnglish 窗口
- **粘贴**：在语料/对话管理页粘贴文本
- **自动识别**：文件扩展名或文本结构判断格式，无需用户选择

---

## 三、分析流水线

```
拖入/粘贴聊天记录
        │
        ▼
  格式检测（纯文本 / JSON）
        │
        ▼
  拆成用户消息 + AI 回复 的逐轮对（pair）
        │
        ▼
  每轮标注：
  · 用户是否用了中文（代码混用）
  · 用户是否卡壳/被打断（"um..."、"..."）
  · AI 是否纠正了用户的表达
  · 对话场景分类（点餐/问路/闲聊/工作/面试...）
        │
        ▼
  全量对话喂给 DeepSeek V4 Pro
  提示词要求输出：
  1. 五维卡片（词汇/句式/短语/场景/错误纠正，≤10张）
  2. 对话摘要（100字中文）
  3. 新能力标签（"今天用了现在完成时，用了3次错了1次"）
        │
        ▼
  卡片 → 写入 SQLite + FSRS 调度
  摘要 → 合并入当日学习日报
  能力标签 → 写入 TiMem（画像更新）
  错误日志 → 写入 error_log 表（跨会话关联）
```

---

## 四、AI 分析提示词

```text
你是 ShadowEnglish 的语言学习分析引擎。用户每天会跟英语 AI Agent 聊天练口语。
以下是今天完整的聊天记录。用户英语水平：语法发音学过、有被动词汇、但开口不流利、目标是日常交流。

请从以下五个维度提取学习卡片（总共不超过 10 张）：

1. 词汇卡：用户在对话中用中文问的、或明显卡壳想不起来的英语词汇。
   正面用中文场景描述，反面给英文词 + 该词在对话中的原句。

2. 句式卡：用户使用了的完整口语句式，或 AI 纠正后给的替代句式。
   正面描述使用场景，反面给完整英文句式框架。

3. 口语短语卡：用户每个词都认识、但没这样组合过的地道搭配。
   正面中文场景，反面英文短语 + 对话中的原上下文。

4. 场景对话卡：选 1 个今天最有代表性的对话片段（3-5 轮）。
   正面场景描述，反面完整英文对话。

5. 错误纠正卡：AI 在对话中明确纠正了用户的表达。
   正面用户说的错误版本，反面纠正后的正确版本 + 解释。

注意：
- 只选日常口语高频的。太学术、太偏门的不要。
- 用户已经流利说对的不要。
- 每张卡的正面用中文写场景（让用户回忆场景而非背单词）。

额外输出：
- summary：100 字中文对话摘要
- tags：用户今天展示/练习了哪些语言能力（如"点餐场景""现在完成时""比较级"）
- weak_points：今天暴露了什么弱项（如"时态混用""介词 in/on 混淆"）

聊天记录如下：
---
{chat_log}
---
```

---

## 五、主进程实现

```typescript
// src/main/corpus/chat-log-importer.ts
import { v4 as uuid } from 'uuid';
import Database from 'better-sqlite3';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnalysisResult {
  cards: CardDraft[];
  summary: string;
  tags: string[];
  weakPoints: string[];
}

export class ChatLogImporter {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** 输入文本 → 自动检测格式 → 解析为消息数组 */
  parseRawText(raw: string): ChatMessage[] {
    // 尝试 JSON
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed[0]?.role) {
        return parsed as ChatMessage[];
      }
    } catch { /* 不是 JSON，继续 */ }

    // 纯文本格式：按行拆分，识别 "User:" / "豆包:" / "AI:" 等前缀
    const messages: ChatMessage[] = [];
    const lines = raw.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const userMatch = trimmed.match(/^(?:User|我|You)\s*[：:]\s*(.+)/i);
      const aiMatch = trimmed.match(/^(?:豆包|AI|Assistant|Bot)\s*[：:]\s*(.+)/i);

      if (userMatch) {
        messages.push({ role: 'user', content: userMatch[1] });
      } else if (aiMatch) {
        messages.push({ role: 'assistant', content: aiMatch[1] });
      } else {
        // 无法识别角色，归为用户消息
        messages.push({ role: 'user', content: trimmed });
      }
    }
    return messages;
  }

  /** 主流程：导入 → 分析 → 写库 */
  async importAndAnalyze(raw: string): Promise<{
    sessionId: string;
    cardCount: number;
    summary: string;
  }> {
    const messages = this.parseRawText(raw);
    if (messages.length < 2) {
      throw new Error('对话记录至少需要 2 条消息');
    }

    // 1. 创建学习会话
    const sessionId = uuid();
    this.db.prepare(`
      INSERT INTO sessions (id, type, started_at, metadata)
      VALUES (?, 'ai_chat', ?, ?)
    `).run(sessionId, Date.now(), JSON.stringify({
      source: 'doubao_import',
      messageCount: messages.length
    }));

    // 2. 预标注（本地轻量规则，不做全量 LLM 调用）
    const annotations = this.preAnnotate(messages);

    // 3. 构建分析 prompt
    const chatLog = messages
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n');

    const analysis = await this.callAIForAnalysis(chatLog, annotations);

    // 4. 写入卡片
    let cardCount = 0;
    const insertCard = this.db.prepare(`
      INSERT INTO cards (id, type, front, back, tags, source_session_id,
        fsrs_difficulty, fsrs_stability, next_review_at, review_count, correct_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0.3, 0, ?, 0, 0, ?)
    `);

    const now = Date.now();
    const tomorrow = now + 86400000;

    const tx = this.db.transaction(() => {
      for (const card of analysis.cards) {
        insertCard.run(
          uuid(), card.type, card.front, card.back,
          JSON.stringify(card.tags || []),
          sessionId, tomorrow, now
        );
        cardCount++;
      }

      // 5. 写入错误日志（与 TiMem 联动）
      for (const wp of analysis.weakPoints) {
        this.db.prepare(`
          INSERT INTO error_log (id, session_id, category, detail, context, created_at)
          VALUES (?, ?, 'grammar', ?, ?, ?)
        `).run(uuid(), sessionId, wp, chatLog.slice(0, 500), now);
      }
    });
    tx();

    // 6. 推送画像更新到 TiMem
    await memoryAgent.updateProfile({
      sessionId,
      tags: analysis.tags,
      weakPoints: analysis.weakPoints,
      summary: analysis.summary,
      messageCount: messages.length
    });

    return {
      sessionId,
      cardCount,
      summary: analysis.summary
    };
  }

  /** 本地规则预标注（零 API 成本） */
  private preAnnotate(messages: ChatMessage[]): Record<string, any> {
    const annotations: any = {
      chineseMixedCount: 0,
      stumbleCount: 0,
      correctionCount: 0
    };

    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      // 中文混用检测
      if (/[\u4e00-\u9fff]/.test(msg.content)) {
        annotations.chineseMixedCount++;
      }
      // 卡壳检测
      if (/um+[.,]*|er+[.,]*|\.{2,}|呃+|嗯+/.test(msg.content.toLowerCase())) {
        annotations.stumbleCount++;
      }
      // AI 纠正检测（AI 消息中包含 "Actually it's" "You should say" 等）
    }
    // 场景检测（关键词匹配：点餐/问路/工作/闲聊）
    const fullText = messages.map(m => m.content).join(' ');
    const sceneKeywords: Record<string, string[]> = {
      'restaurant': ['order', 'menu', 'coffee', 'latte', 'bill', 'waiter', '点餐', '菜单'],
      'directions': ['where is', 'how to get', 'left', 'right', 'street', '问路', '怎么走'],
      'work': ['meeting', 'deadline', 'project', '同事', '会议', '项目'],
      'travel': ['hotel', 'flight', 'airport', '酒店', '机票', '机场'],
      'daily': ['weather', 'hobby', 'movie', '天气', '爱好', '电影']
    };

    annotations.scenes = [];
    for (const [scene, keywords] of Object.entries(sceneKeywords)) {
      if (keywords.some(k => fullText.toLowerCase().includes(k))) {
        annotations.scenes.push(scene);
      }
    }

    return annotations;
  }

  /** 调用 DeepSeek V4 Pro 做深度分析 */
  private async callAIForAnalysis(
    chatLog: string,
    annotations: Record<string, any>
  ): Promise<AnalysisResult> {
    const prompt = this.buildAnalysisPrompt(chatLog, annotations);
    const result = await deepseekRouter.chat('card_generation', [
      { role: 'system', content: prompt },
      { role: 'user', content: `以下是今日聊天记录：\n---\n${chatLog}\n---\n请按上述格式输出 JSON。` }
    ]);

    // 解析 LLM 返回的 JSON
    const text = result.choices[0].message.content || '';
    return this.parseAnalysisJSON(text);
  }

  private buildAnalysisPrompt(chatLog: string, annotations: any): string {
    return `你是 ShadowEnglish 的语言学习分析引擎。用户每天会跟英语 AI Agent 聊天练口语。
用户英语水平：语法发音学过、有被动词汇、开口不流利、目标是日常交流。

预标注信息：
- 中文混用次数: ${annotations.chineseMixedCount}
- 卡壳次数: ${annotations.stumbleCount}  
- 可能场景: ${(annotations.scenes || []).join(', ') || '未识别'}

请从以下五个维度提取学习卡片（总不超过10张）：
...（完整提示词见第四章）`;
  }

  private parseAnalysisJSON(text: string): AnalysisResult {
    // 从 LLM 回复中提取 JSON（可能被 markdown 代码块包裹）
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // 容错：尝试提取 cards 数组
      return { cards: [], summary: text.slice(0, 100), tags: [], weakPoints: [] };
    }
  }
}
```

---

## 六、UI 入口

在 ShadowEnglish 首页增加一个快捷入口：

```
┌────────────────────────────────────────────┐
│          今日学习  6月3日 周三               │
│                                            │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ 🎤       │ │ 💬       │ │ 📥         │  │
│  │ 影子跟读  │ │ 豆包对话  │ │ 导入记录    │  │
│  │ 继续上次  │ │ 去聊天    │ │ 拖拽文件    │  │
│  └──────────┘ └──────────┘ └────────────┘  │
│                                            │
├────────────────────────────────────────────┤
│  📊 今日卡片  待复习 8 张  │  新增 0 张      │
│  📝 日报      暂未生成                      │
└────────────────────────────────────────────┘
```

点击「导入记录」或拖拽文件到窗口后：

```
┌────────────────────────────────────────────┐
│         导入聊天记录                         │
│                                            │
│   ✅ 已检测到 28 条对话（14 轮）             │
│   📍 场景: restaurant                      │
│   🔤 中文混用: 3 次                         │
│   😰 卡壳: 5 次                             │
│                                            │
│   ┌──────────────────────────────────────┐ │
│   │ 用户: I want to order a coffee.      │ │
│   │ AI: Sure! What kind of coffee ...?   │ │
│   │ 用户: A latte please. 少糖怎么说？   │ │  ← 中文混用
│   │ AI: "Less sugar". Great choice!       │ │
│   │ ...                                  │ │
│   └──────────────────────────────────────┘ │
│                                            │
│           [ 开始分析 ]                      │
│                                            │
│   分析完成后：                              │
│   ✅ 提取了 7 张学习卡片                    │
│   ✅ 生成了日报摘要                         │
│   ✅ 画像已更新（新增 2 个能力标签）         │
│                                            │
│           [ 查看卡片 ]   [ 返回首页 ]       │
└────────────────────────────────────────────┘
```

---

## 七、新增 IPC 通道

```typescript
// preload/index.ts 新增
contextBridge.exposeInMainWorld('electronAPI', {
  // ... 原有 ...

  // 对话导入
  importChatLog: (rawText: string) => 
    ipcRenderer.invoke('chatlog:import', rawText),
  previewChatLog: (rawText: string) =>
    ipcRenderer.invoke('chatlog:preview', rawText),
});
```

---

## 八、集成到项目结构

```
src/
├── main/
│   ├── corpus/
│   │   ├── chat-log-importer.ts    # 新增：对话日志导入+分析+写库
│   │   └── ...
│   └── ...
├── renderer/
│   ├── pages/
│   │   ├── ChatLogImport.tsx        # 新增：导入页（预览+分析触发）
│   │   └── ...
│   └── components/
│       └── ChatLogPreview.tsx       # 新增：对话预览组件
└── ...
```

---

> 本模块与现有的 `card-generator.ts`（每日卡片引擎）共享五维卡片格式和 FSRS 写入逻辑，与 `memory-agent.ts`（TiMem）共享画像更新接口。区别在于：`card-generator.ts` 是每天定时汇总全部学习材料的批处理，`chat-log-importer.ts` 是导入一段新对话的即时处理——两者最终汇入同一张 cards 表。
