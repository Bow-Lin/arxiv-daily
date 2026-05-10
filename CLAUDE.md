# SciPhant

桌面应用，用于抓取、过滤和分析 arXiv 论文及会议论文。

## 技术栈

- **框架**: Electron + Vue 3 + TypeScript
- **构建**: Vite + electron-builder
- **状态管理**: Pinia
- **数据库**: sql.js（内存 SQLite，原子写入文件持久化）
- **UI 图标**: lucide-vue-next
- **数学公式**: KaTeX
- **Markdown**: marked + DOMPurify
- **PDF 解析**: pdf-parse
- **测试**: Vitest + @vitest/coverage-v8

## 常用命令

```bash
npm run build          # 构建前端 + 主进程 TypeScript
npx electron .         # 启动应用（需先 build）
npm run package        # 构建并打包
npm run test           # 运行测试（含覆盖率）
npm run typecheck:web  # 仅检查前端类型
```

## 目录结构

```
src/
├── main/                          # Electron 主进程
│   ├── index.ts                   # 应用入口、窗口创建、数据库初始化
│   ├── preload.ts                 # preload 脚本（IPC 桥接）
│   ├── ipc-handlers.ts            # IPC handler 注册
│   ├── database/
│   │   ├── connection.ts          # arxiv_papers.db（papers, analyses, categories）
│   │   ├── paper-topics.ts        # paper_topics.db（topics, arxiv_paper_topics, conference_paper_topics）
│   │   ├── settings.ts            # settings.db（app_config）
│   │   ├── conference-analyses.ts # conference_analyses.db
│   │   └── migrations/            # SQL 迁移脚本
│   ├── commands/                  # 数据库操作（按职责拆分）
│   │   ├── paper.ts               # arXiv 论文 CRUD、分页查询
│   │   ├── paper-shared.ts        # 论文查询共用逻辑（rowToPaper, BASE_SQL）
│   │   ├── summary.ts             # 论文总结
│   │   ├── analysis.ts            # 论文分析
│   │   ├── fetch.ts               # arXiv 抓取
│   │   ├── config.ts              # 主题/分类/配置 CRUD
│   │   ├── llm.ts                 # LLM 调用
│   │   ├── conference-paper.ts    # 会议论文查询
│   │   ├── conference-summary.ts  # 会议论文总结
│   │   ├── conference-analysis.ts # 会议论文分析
│   │   ├── rebuild-arxiv-topics.ts       # 全量/增量重建 arXiv 话题关联
│   │   └── rebuild-conference-topics.ts  # 全量/增量重建会议话题关联
│   ├── services/
│   │   ├── arxiv-api.ts           # arXiv API 封装
│   │   ├── llm-client.ts          # OpenAI 兼容 API 客户端
│   │   ├── filter.ts              # 话题关键词匹配（filterPaperTopics）
│   │   ├── paper-analyzer.ts      # 论文分析 prompt 构建
│   │   ├── pdf-extractor.ts       # PDF 文本提取
│   │   ├── net-fetch.ts           # 网络请求工具
│   │   └── zotero-client.ts       # Zotero API 客户端
│   └── types/
├── renderer/                      # Vue 前端
│   ├── api/index.ts               # IPC 调用封装
│   ├── stores/
│   │   ├── papers.ts              # arXiv 论文状态
│   │   ├── conference-papers.ts   # 会议论文状态
│   │   ├── config.ts              # 配置状态（主题、分类、LLM、Zotero）
│   │   ├── mode.ts                # arXiv/会议 模式切换
│   │   ├── summaryQueue.ts        # 总结队列（基于 createProcessingQueue）
│   │   ├── analysisQueue.ts       # 分析队列
│   │   ├── downloadQueue.ts       # 下载队列
│   │   ├── createProcessingQueue.ts # 通用异步处理队列
│   │   ├── progress.ts            # 全局进度状态
│   │   └── toast.ts               # 通知提示
│   ├── components/
│   │   ├── paper/                 # PaperCard, PaperList, PaperDetail
│   │   ├── config/                # TopicEditor, CategoryEditor, LLMSettings, ZoteroSettings
│   │   ├── layout/                # AppHeader, Sidebar, MainContent
│   │   └── ui/                    # LoadingSpinner
│   ├── views/                     # HomeView, ConfigView
│   ├── types/                     # 前端类型定义
│   ├── utils/                     # format, katex 渲染
│   └── assets/theme.css           # 主题变量（浅色/暗色）
└── resources/                     # 图标、会议数据库等静态资源
```

## 数据库布局

| 数据库 | 表 |
|---|---|
| `arxiv_papers.db` | papers, analyses, categories |
| `paper_topics.db` | topics, arxiv_paper_topics, conference_paper_topics |
| `settings.db` | app_config |
| `conference_analyses.db` | analyses |
| `conference_papers.db` | papers（只读，外部提供） |

## 架构要点

- **双模式**: arXiv 模式和会议模式共享队列和 UI 框架，通过 `modeStore.isConference` 切换
- **队列模式标识**: 每个队列 item 入队时记录 `conference` 标记，处理时使用该标记而非当前模式，避免切换模式导致 API 调用错误
- **话题关联**: 使用 junction table（`arxiv_paper_topics` / `conference_paper_topics`）存储论文-话题多对多关系，增删改 topic 时只做增量更新而非全量重建
- **IPC 串行队列**: topic 关联更新通过 Promise chain 保证顺序执行
- **配置持久化**: LLM/Zotero/theme 配置通过 300ms debounce 自动保存到 settings.db；主题和分类变更立即保存
- **sql.js 持久化**: 所有数据库为内存实例，通过 `save()` 原子写入磁盘（write-to-temp + rename）
- **暗色模式**: 通过 CSS 变量 + `[data-theme="dark"]` 选择器实现，监听系统偏好
