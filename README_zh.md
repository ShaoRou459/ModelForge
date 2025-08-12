# ⚒️ ModelForge 中文介绍

**一个基于网页的 AI 模型评测系统，帮助你系统化地测试、比较多个 AI 模型在不同题集上的表现。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.18.0+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg)](https://reactjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.29.1-black.svg)](https://fastify.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-blue.svg)](https://github.com/WiseLibs/better-sqlite3)

---

## 🎯 项目目标

ModelForge 旨在帮助开发者、研究人员和团队，以标准化的方式评估不同提供商（如 OpenAI、Anthropic、Google Gemini 等）的 AI 模型性能。它提供完整的基准测试平台，支持自动评分、人工复核和深度分析。

---

## ✨ 核心功能

### 🌐 多平台支持
- 支持 **OpenAI 兼容接口**（OpenAI、OpenRouter、本地 vLLM / llama.cpp）
- 集成 **Anthropic Claude**
- 支持 **Google Gemini** REST API
- 可自定义 **HTTP 适配器**，接入实验性模型服务

### 📊 全面评测能力
- **文本类任务**：支持精确匹配、正则、模糊语义评分
- **HTML/CSS/JS 任务**：可渲染并对比实际输出与预期效果
- **自动评分**：使用中立模型进行判断
- **人工评审**：复杂结果可手动覆写
- **N 轮对战模式（N-way battle）**：两两对比模型输出，计算胜率与 ELO 排名

### 🎨 现代化 UI 体验
- Windows 11 风格暗色主题，带毛玻璃特效
- 实时仪表盘 + 交互式图表
- 模型响应 **实时流式输出**
- 响应式设计，适配桌面与移动端

### 📈 深度分析能力
- 模型排行榜（支持 ELO 类评分机制）
- 准确率与延迟分布分析
- 跨平台成本对比
- 题目难度评估
- 对战胜率矩阵（Win Rate Matrix）

### 🔐 安全与隐私
- API Key 使用 **AES-GCM 加密存储**
- HTML 渲染运行于安全沙箱（CSP + iframe 隔离）
- 前端 **不接触 API Key**
- 内置速率限制与 CORS 防护

![演示图](https://github.com/user-attachments/assets/387d8ca4-f2ea-4f3e-86a7-766de11510fa)

---

## 🚀 快速开始

### 🔧 前置要求
- **Node.js** 18.18.0 或更高版本
- **npm** 9.0.0 或以上

### 安装步骤
```bash
# 克隆仓库
git clone https://github.com/ShaoRou459/ModelForge
cd model-forge

# 安装所有依赖
npm run install:all

# 启动服务（API + 前端）
npm run start
```

🚀 应用将运行在：
- **网页端（UI）**: http://localhost:5175
- **API 服务**: http://localhost:5174

### 手动安装（可选）
```bash
npm run install:shared   # 安装共享包
npm run install:api      # 安装后端依赖
npm run install:web      # 安装前端依赖

npm run start:api        # 单独启动 API
npm run start:web        # 单独启动 UI
```

---

## 📋 使用流程

### 1. 添加模型提供商
1. 进入侧边栏 **Providers & Models**
2. 点击 **Add Provider**
3. 配置：
   - **Name**：显示名称（如 "OpenAI GPT-4"）
   - **Adapter**：选择厂商类型
   - **Base URL**：API 地址（如 `https://api.openai.com/v1`）
   - **API Key**：你的密钥（加密保存）
   - **Default Model**：默认模型
4. 点击 **Test Connection** 测试连接
5. 保存

#### 添加具体模型
1. 选择已有的提供商
2. 点击 **Add Model**
3. 配置：
   - **Label**：显示名（如 "GPT-4 Turbo"）
   - **Model ID**：厂商内模型标识符
   - **Settings**：可选参数（temperature, max_tokens 等）

---

### 2. 创建题目集（Problem Sets）

#### 创建题集
1. 进入 **Problem Sets**
2. 点击 **New Problem Set**
3. 输入名称与描述
4. 保存后添加题目

#### 添加题目
1. 选中题集，点击 **Add Problem**
2. 选择类型：
   - **Text**：自然语言任务
   - **HTML**：网页开发类任务
3. 配置：
   - **Prompt**：提示词
   - **Expected Answer**：标准答案
   - **HTML Assets**：HTML/CSS/JS 文件
   - **Scoring Rules**：评分规则

---

### 3. 运行评测（Benchmark Run）

#### 创建新评测
1. 进入 **Runs**
2. 点击 **New Run**
3. 配置：
   - **Name**：运行名称
   - **Problem Set**：选择题集
   - **Models**：选 2–8 个模型参与
   - **Judge Model**：用于自动评分的裁判模型
   - **Streaming**：是否开启实时输出

4. 点击 **Create Run**

#### 执行评测
1. 在列表中点击 **Start**
2. 实时查看：
   - 每个模型的 token 流
   - 每道题的完成状态
   - 各模型进度百分比

---

### 4. 查看结果

#### 仪表盘分析
1. 进入 **Dashboard**
2. 查看：
   - 所有模型的总体准确率
   - 性能排名
   - 题目难度分布
   - 成本与延迟统计

#### 详细结果
1. 点击任意已完成的运行
2. 查看：
   - 每题每模型的得分矩阵
   - 具体回答与评分依据
   - 手动修改评分选项

#### HTML 任务人工评审
1. 进入 **Review**
2. 对每个 HTML 任务：
   - 在沙箱中实时查看渲染效果
   - 对比预期与实际输出
   - 可手动更改自动评分结果

---

### 5. 对战模式（Battle Mode）（即将上线）
1. 进入 **Battle**
2. 选择多个模型进行两两对战
3. 生成胜率矩阵与 ELO 排名
4. 分析结果显著性

---

## 🏗️ 项目架构

### 目录结构
```
model-forge/
├── apps/
│   ├── api/                 # Fastify 后端服务
│   └── web/                 # React 前端界面
├── packages/
│   └── shared/              # 共享类型与工具
└── package.json
```

### 技术栈
- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **后端**：Fastify + TypeScript
- **数据库**：SQLite（better-sqlite3），API Key 加密存储
- **图表**：Apache ECharts
- **动画**：Framer Motion
- **表单**：React Hook Form + Zod 校验

---

## 🔧 开发脚本

```bash
npm run dev          # 启动全部服务
npm run start        # 同上
npm run start:api    # 仅启动后端
npm run start:web    # 仅启动前端

npm run build        # 构建生产包
npm run build:api
npm run build:web

npm run typecheck    # 类型检查
npm run lint         # 代码检查
npm run format       # 格式化代码
```

---

## 🌐 环境变量

**apps/api/.env**
```env
PORT=5174
ENCRYPTION_KEY=你的32位加密密钥（用于加密 API Key）
```

**apps/web/.env**
```env
VITE_API_URL=http://localhost:5174
```

---

## 🗃️ 数据库
- **路径**：`apps/api/var/data.sqlite`
- **自动创建**：首次启动时自动生成
- **加密**：API Key 使用 AES-GCM 加密
- **清理**：运行 `npm run clean:db` 可重置数据库（会清空数据）
- **备份**：直接复制 `.sqlite` 文件即可

---

## 🐛 常见问题

### 数据库连接失败
1. 确保目录可写
2. 检查是否有重复进程占用端口
3. 使用 `npm run clean:db` 重置

### API Key 无效
1. 检查服务商 API 是否可达
2. 确认密钥权限
3. 使用 **Test Connection** 功能验证

### CORS 错误
1. 确保 API 与 Web 的 URL 端口匹配
2. 检查 `.env` 配置是否正确

---

## 🚀 部署建议

### 生产构建
```bash
npm run build
```

### 云部署
- **API**：Render、Fly.io、Railway
- **Web**：Vercel、Netlify、GitHub Pages
- **数据库**：SQLite + Litestream 实现持久化

---

## 🤝 贡献指南
1. Fork 仓库
2. 创建分支：`git checkout -b feature/新功能`
3. 提交更改：`git commit -m '添加厉害的功能'`
4. 推送：`git push origin feature/新功能`
5. 提交 Pull Request

---

## 🙏 致谢
- **Windows 11 设计语言**：视觉灵感来源
- **Fastify**：高性能后端框架
- **React 生态**：现代化开发体验
- **Better SQLite3**：稳定可靠的数据库支持

---

<div align="center">
🌟 为 AI 评测社区而生，Built with ❤️
</div>
