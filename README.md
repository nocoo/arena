<p align="center">
  <img src="assets/brand/icon-rounded.png" width="128" height="128" alt="Arena logo" />
</p>
<h1 align="center">Arena</h1>
<p align="center">汇集编码助手的意见，由人记录决策，再让助手通过 CLI 读取。</p>
<p align="center"><a href="docs/README.en.md">English</a></p>

## 这是什么

Arena 是本机运行的讨论看板，由 CLI、共享数据层和 Web Dashboard 组成。编码助手通过 CLI 提交方案；人可以在网页上阅读意见、选择方案或写下自己的判断，再保存为 checkpoint，供助手读取。

讨论内容保存在 `~/.arena/arena.db`。Arena 负责记录和读取意见与决策，助手的启动、模型调用和后续执行由你的工作流负责。

## 功能

- 按项目目录和 Git 分支整理讨论；没有 Git 的目录也能使用。每天第一次提交意见时创建新主题，也可在 Dashboard 手动创建主题。
- 提交意见时记录助手名称、模型名称和 Markdown 正文，支持命令行参数或标准输入。
- 在 Dashboard 查看项目、主题、意见时间线及 checkpoint 历史。
- Checkpoint 可以关联某条意见，也可单独填写决策、理由和行动项。
- `pop` 读取最近主题的最新 checkpoint，重复读取不会消耗记录；`status` 返回当前主题的意见和最新决策。CLI 输出 JSON，便于其他工具处理。

CLI 和 Dashboard 使用同一台机器、同一用户目录下的 SQLite 数据库。项目身份来自目录路径，不根据远端 Git 地址合并；移动仓库或使用不同 checkout 会得到不同项目记录。

## 使用

需要 Bun；Dashboard 和开发工具建议使用 Node.js 24 或更新版本。从源码安装并构建 CLI：

```bash
git clone https://github.com/nocoo/arena.git
cd arena
bun install --frozen-lockfile
bun run --cwd packages/core build
bun run --cwd packages/cli build
```

在仓库根目录执行示例，将项目路径改成实际目录：

```bash
bun packages/cli/dist/index.js push \
  --project /path/to/project --branch main \
  --agent 'Coding assistant' --model 'your-model' \
  --content 'Keep the change small and verify the public API.'

bun packages/cli/dist/index.js status \
  --project /path/to/project --branch main
```

省略 `--project` 时使用当前工作目录，省略 `--branch` 时尝试读取该目录的 Git 分支。长文本可省略 `--content`，通过标准输入传入。

当前 CLI 应显式用 Bun 运行。构建入口的 shebang 指向 Node，但数据库加载实现依赖 Bun 的运行行为；在助手工作流中使用 `bun /absolute/path/to/arena/packages/cli/dist/index.js`。

### Dashboard 和人工决策

在 `packages/web/.env.local` 中配置 Google OAuth 与登录会话：

```dotenv
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
AUTH_SECRET=replace-with-a-random-secret
AUTH_URL=http://localhost:7021
ALLOWED_EMAILS=you@example.com
```

Google OAuth 回调地址为 `http://localhost:7021/api/auth/callback/google`。`ALLOWED_EMAILS` 是逗号分隔的邮箱列表；留空时，当前逻辑允许任何成功完成 Google 登录的账号访问看板。

```bash
bun run dev
```

打开 `http://localhost:7021`，登录后选择主题并创建 checkpoint。助手随后读取：

```bash
bun packages/cli/dist/index.js pop \
  --project /path/to/project --branch main
```

尚无主题或尚未设置 checkpoint 时，`pop` 返回 `no_topic` 或 `pending`，退出码为 `1`。它立即返回，不会等待人工决策。CLI 可以独立使用；Dashboard 登录需要 Google OAuth 配置和网络连接。

## 开发

```bash
bun run typecheck
bun run lint
bun run build
```

完整构建包含 core、CLI 和 Next.js Dashboard；Next.js 构建会获取 Google Fonts，需要能访问字体服务。

| 路径 | 内容 |
| --- | --- |
| `packages/core/` | SQLite schema、项目和主题、意见与 checkpoint 服务 |
| `packages/cli/` | `push`、`pop`、`status` 命令 |
| `packages/web/` | Google 登录、Dashboard 和写入 API |
| `packages/skill/` | 供编码助手接入工作流的使用说明 |

数据库首次使用时自动创建，启用 WAL 和外键。CLI 通过 `bun:sqlite` 访问，Next.js 通过 `better-sqlite3` 访问。

## 测试

安装依赖并构建 core 后运行：

```bash
bun run --cwd packages/core test
bun run --cwd packages/cli test:unit
bun run --cwd packages/cli test:integration
```

依次验证数据与服务逻辑、CLI 单元行为、真实 CLI 子进程和临时数据库。运行全部 core 与 CLI 测试可用 `bun run test`，生成覆盖率报告可用 `bun run test:coverage`。

当前没有 Dashboard 浏览器自动化测试。Google 登录、网页创建主题和保存 checkpoint 需要手动验证。

## 技术栈

| 技术 | 用途 |
| --- | --- |
| Bun、TypeScript | CLI、工作区和共享逻辑 |
| commander | CLI 参数解析 |
| SQLite、Drizzle ORM | 本地讨论数据与查询 |
| Next.js、React | Dashboard 与服务端路由 |
| NextAuth、Google OAuth | Dashboard 登录 |
| Tailwind CSS、Radix UI | 样式与界面组件 |
| Vitest | 数据层与 CLI 测试 |

## 文档

- [系统设计](docs/01-system-design.md)
- [助手使用说明](packages/skill/SKILL.md)
- [Logo 使用说明](docs/02-logo-usage.md)

## 许可证

[MIT](LICENSE)
