# arXiv Daily

一个用于抓取、过滤和分析 arXiv 论文的桌面应用。

## 功能

- 从 arXiv API 抓取论文（支持按日期范围、按分类）
- 按关键词搜索、按研究方向过滤
- LLM 驱动的论文摘要生成与深度分析（支持全文 PDF 提取）
- 批量分析，支持进度查看和取消
- 三栏布局：侧边栏（日期/筛选） | 论文列表 | 论文详情（可调整宽度）

## 技术栈

- **Electron** + **Vue 3** + **TypeScript**
- **Pinia** 状态管理
- **SQL.js** 本地数据库（SQLite WASM）
- **Vite** 构建工具

## 开发

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
npm run dev:electron
```

### 构建

```bash
npm run build
```

### 打包

```bash
npm run package
```

## 配置

在应用内的设置页面配置：

- **LLM 设置**：API Key、Base URL、模型名称、温度参数
- **arXiv 分类**：管理监控的分类（如 cs.CV、cs.AI）
- **研究方向**：自定义主题及关键词，用于论文匹配
- **代理设置**：HTTP/HTTPS 代理

## 项目结构

```
src/
├── main/                # Electron 主进程
│   ├── commands/        # IPC 命令处理
│   ├── database/        # 数据库和迁移
│   └── services/        # 后端服务（API、PDF、LLM 等）
└── renderer/            # Vue 渲染进程
    ├── components/      # UI 组件
    ├── stores/          # Pinia 状态管理
    └── views/           # 页面视图
```
