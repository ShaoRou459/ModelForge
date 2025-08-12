# ⚒️ ModelForge

**A comprehensive web-based AI model benchmarking system for evaluating and comparing AI models across multiple providers and problem sets.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.18.0+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg)](https://reactjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.29.1-black.svg)](https://fastify.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-blue.svg)](https://github.com/WiseLibs/better-sqlite3)

</div>

## 🎯 Purpose

ModelForge is designed to help developers, researchers, and organizations systematically evaluate AI models across different providers (OpenAI, Anthropic, Google Gemini, etc.) using standardized problem sets. It provides a complete benchmarking platform with automated judging, manual review capabilities, and comprehensive analytics.

## ✨ Key Features

### 🏗️ **Multi-Provider Support**
- **OpenAI-compatible** endpoints (OpenAI, OpenRouter, local vLLM/llama.cpp)
- **Anthropic Claude** integration
- **Google Gemini** REST API
- **Custom HTTP** adapters for experimental providers

### 📊 **Comprehensive Benchmarking**
- **Text-based problems** with exact/regex/fuzzy matching
- **HTML/CSS/JS tasks** with DOM-based evaluation
- **Automated LLM judging** using neutral models
- **Manual review override** for complex cases
- **N-way battle mode** for pairwise model comparisons

### 🎨 **Modern UI/UX**
- **Windows 11-inspired** dark theme with glass effects
- **Real-time dashboards** with interactive charts
- **Live streaming** of model responses during runs
- **Responsive design** for desktop and mobile

### 📈 **Advanced Analytics**
- **Model performance rankings** with ELO-like ratings
- **Accuracy and latency** distributions
- **Cost analysis** across providers
- **Problem difficulty** analysis
- **Win rate matrices** for battle mode

### 🔐 **Security & Privacy**
- **Encrypted API keys** using AES-GCM
- **Secure HTML sandbox** with CSP and iframe isolation
- **No API key exposure** to frontend
- **Rate limiting** and CORS protection

![Demo(1)](https://github.com/user-attachments/assets/387d8ca4-f2ea-4f3e-86a7-766de11510fa)

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18.18.0 or higher
- **npm** 9.0.0 or higher

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd model-forge

# Install all dependencies
npm run install:all

# Start development servers (API + Web)
npm run start
```

The application will be available at:
- **Web UI**: http://localhost:5175
- **API**: http://localhost:5174

### Manual Installation

```bash
# Install shared packages
npm run install:shared

# Install API dependencies
npm run install:api

# Install Web dependencies
npm run install:web

# Start individual services
npm run start:api    # API server only
npm run start:web    # Web UI only
```

## 📋 Workflows

### 1. **Setting Up Providers**

#### Adding a Provider
1. Navigate to **Providers & Models** in the sidebar
2. Click **Add Provider**
3. Configure:
   - **Name**: Display name (e.g., "OpenAI GPT-4")
   - **Adapter**: Provider type (OpenAI, Anthropic, Gemini, Custom)
   - **Base URL**: API endpoint (e.g., `https://api.openai.com/v1`)
   - **API Key**: Your provider API key (encrypted at rest)
   - **Default Model**: Primary model for this provider

4. Click **Test Connection** to validate
5. Save the provider

#### Adding Models
1. Select a provider from the list
2. Click **Add Model**
3. Configure:
   - **Label**: Display name (e.g., "GPT-4 Turbo")
   - **Model ID**: Provider-specific model identifier
   - **Settings**: Optional model parameters (temperature, max_tokens, etc.)

### 2. **Creating Problem Sets**

#### Create Problem Set
1. Navigate to **Problem Sets**
2. Click **New Problem Set**
3. Enter:
   - **Name**: Descriptive title
   - **Description**: Optional detailed description
4. Save and add problems

#### Add Problems
1. Select a problem set
2. Click **Add Problem**
3. Choose problem type:
   - **Text**: Natural language tasks
   - **HTML**: Web development tasks

4. Configure:
   - **Prompt**: The task description
   - **Expected Answer**: For text problems
   - **HTML Assets**: For HTML problems (HTML/CSS/JS)
   - **Scoring Rules**: Custom evaluation criteria

### 3. **Running Benchmarks**

#### Create a New Run
1. Navigate to **Runs**
2. Click **New Run**
3. Configure:
   - **Name**: Optional run identifier
   - **Problem Set**: Select from available sets
   - **Models**: Choose 2-8 models to compare
   - **Judge Model**: Select a model for automated judging
   - **Streaming**: Enable real-time response viewing

4. Click **Create Run**

#### Execute the Run
1. From the runs list, click **Start** on your new run
2. Monitor progress in real-time:
   - **Live tokens** streaming for each model
   - **Problem-by-problem** status updates
   - **Completion percentages** for each model

### 4. **Reviewing Results**

#### Dashboard Analysis
1. Navigate to **Dashboard**
2. View:
   - **Overall accuracy** across models
   - **Model performance** rankings
   - **Problem difficulty** analysis
   - **Cost and latency** metrics

#### Detailed Results
1. Click on any completed run
2. View:
   - **Problem × Model** matrix with verdicts
   - **Individual responses** and judgments
   - **Manual override** options for disputed results

#### Manual Review (HTML Tasks)
1. Navigate to **Review**
2. For each HTML task:
   - View **live sandbox** rendering
   - Compare **expected vs actual** output
   - Override automated judgments if needed

### 5. **Battle Mode**
1. Navigate to **Battle** (coming soon)
2. Select models for pairwise comparison
3. View **win rate matrices** and **ELO ratings**
4. Analyze **statistical significance** of results

## 🏗️ Architecture

### Project Structure
```
model-forge/
├── apps/
│   ├── api/                 # Fastify TypeScript API
│   │   ├── src/
│   │   │   └── server.ts    # Main server with 2000+ lines
│   │   └── package.json
│   └── web/                 # React TypeScript frontend
│       ├── src/
│       │   ├── app/         # Routes and layouts
│       │   ├── features/    # Domain modules
│       │   ├── components/  # Design system
│       │   └── lib/         # API and utilities
│       └── package.json
├── packages/
│   └── shared/              # Shared types and utilities
└── package.json             # Root workspace configuration
```

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Fastify, TypeScript, SQLite (better-sqlite3)
- **Database**: SQLite with encrypted API keys
- **Charts**: Apache ECharts for analytics
- **Animation**: Framer Motion for smooth transitions
- **Forms**: React Hook Form with Zod validation

## 🔧 Development

### Available Scripts
```bash
# Development
npm run dev          # Start all services
npm run start        # Alias for dev
npm run start:api    # API server only
npm run start:web    # Web UI only

# Building
npm run build        # Build all packages
npm run build:api    # Build API only
npm run build:web    # Build web only

# Quality
npm run typecheck    # Type checking across all packages
npm run lint         # Lint all packages
npm run format       # Format code with Prettier
```

### Environment Variables
Create `.env` files in respective directories:

**apps/api/.env**
```bash
PORT=5174
ENCRYPTION_KEY=your-32-char-encryption-key
```

**apps/web/.env**
```bash
VITE_API_URL=http://localhost:5174
```

### Database
- **Location**: Auto-created at `apps/api/apps/api/var/data.sqlite`
- **Schema**: Auto-created on server start
- **Encryption**: API keys encrypted with AES-GCM
- **Cleanup**: Use `npm run clean:db` to remove database files for a fresh start
- **Backup**: SQLite file can be copied for backup

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Issues
1. Ensure database directory is writable
2. Check if another instance is running
3. Use `npm run clean:db` to reset database (will lose data)

#### API Key Issues
1. Verify provider endpoints are accessible
2. Check API key permissions
3. Use the **Test Connection** feature before saving

#### CORS Issues
1. Ensure API and web are running on expected ports
2. Check `.env` configuration matches actual URLs

## 📊 Performance

### Benchmarking Capabilities
- **Concurrent model evaluation**: 2-8+ models simultaneously
- **Problem sets**: Unlimited problems per set
- **Real-time streaming**: Live token updates during runs
- **Scoring accuracy**: Automated + manual override
- **Cost tracking**: Per-model and per-run cost analysis

### System Requirements
- **Memory**: 512MB+ RAM for basic usage
- **Storage**: 100MB+ for database and logs
- **Network**: Stable internet for API calls

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Cloud Deployment
- **API**: Render, Fly.io, or Railway
- **Web**: Vercel, Netlify, or GitHub Pages
- **Database**: SQLite with Litestream for persistence

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🙏 Acknowledgments

- **Windows 11 Design System** for visual inspiration
- **Fastify** for high-performance API framework
- **React ecosystem** for modern web development
- **Better SQLite3** for reliable database operations

---

<div align="center">

**Built with ❤️ for the AI benchmarking community**

</div>
