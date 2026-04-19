# kkghrsbsb.github.io

基于 Astro 框架搭建的个人博客，模板来自 [astro-erudite](https://github.com/jktrn/astro-erudite)，在此基础上扩展了音乐播放器、评论系统和全文搜索。

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | Astro 5.x（SSG 静态生成） |
| UI | React 19（Islands 架构）+ Tailwind CSS v4 |
| 内容 | Markdown / MDX，支持 KaTeX 数学公式 |
| 代码高亮 | astro-expressive-code + rehype-pretty-code |
| 搜索 | FlexSearch（客户端全文搜索） |
| 评论 | Giscus（基于 GitHub Discussions） |
| 音乐播放器 | APlayer + Meting API（网易云歌单） |
| 图标 | astro-icon + Lucide + Iconify |

## 页面路由

```
/                   首页
/blog               博客列表（分页）
/blog/[slug]        文章详情
/tags/[tag]         按标签筛选
/authors/[slug]     作者页
/about              关于页
/rss.xml            RSS 订阅
/robots.txt         爬虫协议
```

## 内容管理

内容存放在 `src/content/`，使用 Astro Content Collections：

- `blog/` — 博客文章（`.md` / `.mdx`），字段：title、description、date、tags、authors、draft
- `authors/` — 作者信息，字段：name、avatar、bio、github 等
- `projects/` — 项目展示，字段：name、description、tags、image、link

## 快速开始

```bash
npm install
npm run dev      # 开发服务器，端口 1234
npm run build    # 类型检查 + 构建
npm run preview  # 预览构建产物
```

## 部署方式

有两套部署流程，通过环境变量 `DEPLOY_TARGET` 区分：

**自有服务器（主要）**：`.github/workflows/deploy.yml`
- 触发：push to `main`
- 构建：`DEPLOY_TARGET=prod`，站点域名 `kkghrsbsbsb.com`
- 推送：rsync 到服务器暂存目录，再执行脚本原子切换并重载 Caddy

**GitHub Pages（备用）**：`.github/workflows/pages.yml`
- 站点域名 `kkghrsbsb.github.io`

## 项目结构

```
src/
├── components/     UI 组件（Astro + React）
├── content/        内容集合（blog、authors、projects）
├── layouts/        页面布局
├── lib/            工具函数
├── pages/          路由页面
├── styles/         全局样式
├── consts.ts       站点常量配置
└── content.config.ts  内容集合 schema 定义
docs/               mdBook 文档（本文档）
patches/            patch-package 补丁
public/             静态资源
```
