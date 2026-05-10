# SciPhant

一款桌面应用，用于抓取、过滤和分析 arXiv 论文及会议论文。支持 LLM 驱动的论文总结与深度分析，并可导出至 Zotero。

## 功能

### arXiv 模式

- 从 arXiv API 抓取论文，支持按日期范围、按分类筛选
- 按自定义话题关键词自动匹配论文，支持增量更新
- LLM 生成论文总结（基于标题和摘要）
- LLM 深度分析论文（基于全文 PDF 提取）
- 批量总结/分析，队列管理，进度查看与取消

### 会议模式

- 内置会议论文数据库（外部提供），支持多个会议
- 按 Track 和话题关键词筛选
- 同样支持 LLM 总结与深度分析

### 通用功能

- 多选论文批量操作
- 论文摘要 LaTeX 公式渲染
- 导出论文至 Zotero（支持选择集合）
- 浅色/暗色主题，跟随系统偏好
- PDF 下载与本地缓存
- BibTeX 复制

## 截图

<!-- TODO: 添加截图 -->

## 安装

从 [Releases](../../releases) 下载对应平台的安装包。

- **macOS**: `.dmg` 或 `.zip`
- **Linux**: `.AppImage`
- **Windows**: portable 可执行文件

## 使用

### 1. 配置 LLM

在设置页面填入 LLM 的 API Key、Base URL 和模型名称。支持所有 OpenAI 兼容 API。

### 2. arXiv 模式

- 点击侧边栏「获取论文」按日期或分类抓取
- 在「设置 → 话题管理」中添加研究方向及关键词，系统会自动匹配论文
- 选中论文后点击「论文总结」或「论文分析」

### 3. 会议模式

- 点击顶部切换至会议模式
- 选择会议后浏览论文列表
- 按 Track 或话题筛选感兴趣的论文

### 4. 导出 Zotero

- 在设置页面配置 Zotero API Key 和 User ID
- 论文详情页点击「导出到 Zotero」并选择目标集合

## 开发

### 环境要求

- Node.js >= 18
- npm

### 安装依赖

```bash
npm install
```

### 开发

```bash
npm run build          # 构建前端和主进程
npx electron .         # 启动应用
```

> 每次修改代码后需要重新 `npm run build` 再启动。

### 测试

```bash
npm test               # 运行测试（含覆盖率）
```

### 打包

```bash
npm run package        # 构建并打包为安装程序
```

### 项目结构

```
src/
├── main/                          # Electron 主进程
│   ├── index.ts                   # 应用入口、窗口创建、数据库初始化与迁移
│   ├── preload.ts                 # preload 脚本（IPC 桥接）
│   ├── ipc-handlers.ts            # IPC handler 注册
│   ├── database/
│   │   ├── connection.ts          # arxiv_papers.db
│   │   ├── paper-topics.ts        # paper_topics.db（话题与论文关联）
│   │   ├── settings.ts            # settings.db（应用配置）
│   │   ├── conference-analyses.ts # 会议论文分析结果
│   │   └── migrations/            # SQL 迁移脚本
│   ├── commands/                  # 数据库操作层
│   │   ├── paper.ts               # arXiv 论文查询
│   │   ├── summary.ts / analysis.ts  # 总结与分析
│   │   ├── fetch.ts               # arXiv 抓取
│   │   ├── config.ts              # 配置 CRUD
│   │   ├── conference-*.ts        # 会议论文相关
│   │   └── rebuild-*-topics.ts    # 话题关联重建
│   └── services/                  # 外部服务封装
│       ├── arxiv-api.ts           # arXiv API
│       ├── llm-client.ts          # LLM 客户端
│       ├── zotero-client.ts       # Zotero API
│       └── pdf-extractor.ts       # PDF 文本提取
└── renderer/                      # Vue 前端
    ├── stores/                    # Pinia 状态管理
    ├── components/
    │   ├── paper/                 # 论文卡片、列表、详情
    │   ├── config/                # 设置页面组件
    │   └── layout/                # 布局（侧边栏、顶栏）
    ├── views/                     # 页面（首页、设置）
    └── assets/theme.css           # 主题变量
```

### 技术栈

- **Electron** + **Vue 3** + **TypeScript**
- **Vite** 构建
- **Pinia** 状态管理
- **sql.js** 本地数据库（SQLite WASM，内存模式 + 原子写入持久化）
- **KaTeX** 数学公式渲染
- **marked** + **DOMPurify** Markdown 渲染
- **lucide-vue-next** 图标
- **Vitest** 测试框架

## 许可

MIT
