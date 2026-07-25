# Collections — the agent ecosystem directory

The **/collections** page is a discovery directory of the wider agent ecosystem:
**138 GitHub repositories** — Agent Skills, MCP servers & SDKs, agent tools and
awesome lists — grouped into **18 collections**. It links to upstream repos;
nothing is vendored here. (For files you can copy or install directly, all validated by
agentcheck with zero errors, see the **/catalog** page instead.)

## How it works

- **Source of truth**: [`data/repo-directory.json`](../data/repo-directory.json) — hand-curated:
  which repos appear, their `kind` (skills / mcp / tools / lists), their `collections`, and their
  `topics` (coding, office, writing, marketing, business, research, creative, life, general).
- **Star sync**: `npm run sync:stars` re-fetches star counts + descriptions via the GitHub GraphQL
  API and regenerates `apps/web/src/lib/repo-directory.generated.ts`. A network failure is
  non-fatal — the previous numbers are kept. The `sync-stars` workflow runs this weekly and opens
  a PR; nothing is auto-merged.
- **Live counts in the browser**: each card upgrades its snapshot to a live count when it scrolls
  into view (unauthenticated GitHub REST, 6-hour `localStorage` cache, capped per page view). On
  a rate limit the page quietly keeps the synced numbers.

## Adding a repo

Add an entry to `data/repo-directory.json` (any `stars` value — the sync overwrites it), then run
`npm run sync:stars`. Inclusion criteria: it must be genuinely about agent skills, MCP, or tools
for AI agents, and be a real, maintained project. Being listed here is **not** an endorsement or
a security review — always read a third-party skill before installing it, and check anything you
add with `npx @bacnguyenne/agentcheck`.

## The collections (stars as of 2026-07-25)

### Official skills (9)

First-party skill repos from Anthropic, OpenAI, Google, Hugging Face & more.

| Repo | Stars | What it is |
|---|---:|---|
| [anthropics/skills](https://github.com/anthropics/skills) | 164k | Public repository for Agent Skills |
| [anthropics/financial-services](https://github.com/anthropics/financial-services) | 34k | README: official Anthropic reference agents, skills, and vertical plugins for financial services |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 33k | Official, Anthropic-managed directory of high quality Claude Code Plugins. |
| [openai/skills](https://github.com/openai/skills) | 24k | Skills Catalog for Codex |
| [agentskills/agentskills](https://github.com/agentskills/agentskills) | 23k | Specification and documentation for Agent Skills |
| [google/skills](https://github.com/google/skills) | 15k | Agent Skills for Google products and technologies |
| [MiniMax-AI/skills](https://github.com/MiniMax-AI/skills) | 13k | README confirms: MiniMax's official skill collection for AI coding agents (frontend, mobile, docs, multimodal) |
| [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | 12k | Official AI skills for GSAP. These skills teach AI coding agents how to correctly use GSAP (GreenSock Anima… |
| [huggingface/skills](https://github.com/huggingface/skills) | 11k | Give your agents the power of the Hugging Face ecosystem |

### Official MCP (8)

The MCP spec, official SDKs and vendor-official servers.

| Repo | Stars | What it is |
|---|---:|---|
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | 89k | Model Context Protocol Servers |
| [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | 48k | Chrome DevTools for coding agents |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | 35k | Playwright MCP server |
| [github/github-mcp-server](https://github.com/github/github-mcp-server) | 32k | GitHub's official MCP Server |
| [modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) | 24k | The official Python SDK for Model Context Protocol servers and clients |
| [microsoft/mcp-for-beginners](https://github.com/microsoft/mcp-for-beginners) | 17k | This open-source curriculum introduces the fundamentals of Model Context Protocol (MCP) through real-world,… |
| [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | 13k | The official TypeScript SDK for Model Context Protocol servers and clients |
| [modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector) | 10k | Visual testing tool for MCP servers |

### Skill collections (29)

Multi-skill libraries and packs from the community.

| Repo | Stars | What it is |
|---|---:|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 261k | An agentic skills framework & software development methodology that works. |
| [mattpocock/skills](https://github.com/mattpocock/skills) | 187k | Skills for Real Engineers. Straight from my .agents directory. |
| [anthropics/skills](https://github.com/anthropics/skills) | 164k | Public repository for Agent Skills |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 80k | Production-grade engineering skills for AI coding agents. |
| [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | 70k | A curated list of awesome Claude Skills, resources, and tools for customizing Claude AI workflows |
| [VoltAgent/awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) | 52k | The awesome collection of OpenClaw skills. 5,400+ skills filtered and categorized from the official OpenCla… |
| [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) | 44k | AAS Core is the local, agent-first control plane for complete catalog discovery, agent-owned selection, sta… |
| [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) | 43k | Agent skills for Obsidian. Teach your agent to use Obsidian CLI and open formats including Markdown, Bases,… |
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | 42k | Marketing skills for Claude Code and AI agents. CRO, copywriting, SEO, analytics, and growth engineering. |
| [Imbad0202/academic-research-skills](https://github.com/Imbad0202/academic-research-skills) | 39k | Academic Research Skills for Claude Code: research → write → review → revise → finalize |
| [wshobson/agents](https://github.com/wshobson/agents) | 38k | Multi-harness agentic plugin marketplace for Claude Code, Codex CLI, Cursor, OpenCode, GitHub Copilot, and… |
| [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | 32k | Turn any AI agent into an AI Scientist. The #1 Agent Skills library for science, used by 160,000+ scientist… |
| [Yuan1z0825/nature-skills](https://github.com/Yuan1z0825/nature-skills) | 31k | 符合nature论文学术表达和科研绘图的Skill |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 29k | Vercel's official collection of agent skills |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 29k | A curated collection of 1000+ agent skills from official dev teams and the community, compatible with Claud… |
| [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 27k | 817 structured cybersecurity skills for AI agents · Mapped to 6 frameworks: MITRE ATT&CK, NIST CSF 2.0, MIT… |
| [phuryn/pm-skills](https://github.com/phuryn/pm-skills) | 24k | PM Skills Marketplace: 100+ agentic skills, commands, and plugins — from discovery to strategy, execution,… |
| [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills) | 24k | Empty description; topics verified: agent-skills, claude-skills, codex-skills, openclaw-skills |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | 23k | 345 Claude Code skills & agent skills & plugins (30+ Agents, 70+ custom commands, 330+ skills, customizable… |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | 21k | Skills for Design Engineers. |
| [KKKKhazix/khazix-skills](https://github.com/KKKKhazix/khazix-skills) | 18k | 数字生命卡兹克开源的 AI Skills 合集 \| Agent Skills: neat-freak 洁癖 (docs/memory closeout), hv-analysis, khazix-writer &… |
| [muratcankoylan/Agent-Skills-for-Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) | 17k | A comprehensive collection of Agent Skills for context engineering, multi-agent architectures, and producti… |
| [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) | 14k | A curated list of awesome Claude Skills, resources, and tools for customizing Claude AI workflows — particu… |
| [wanshuiyin/Auto-claude-code-research-in-sleep](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep) | 14k | ARIS ⚔️ (Auto-Research-In-Sleep) — Lightweight Markdown-only skills for autonomous ML research: cross-model… |
| [Orchestra-Research/AI-Research-SKILLs](https://github.com/Orchestra-Research/AI-Research-SKILLs) | 11k | Comprehensive open-source library of AI research and engineering skills for any AI model. Package the skill… |
| [Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills) | 11k | 66 Specialized Skills for Full-Stack Developers. Transform Claude Code into your expert pair programmer. |
| [earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad) | 10k | A collection of agent skills for CAD, robotics and hardware design |
| [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills) | 9.8k | ConardLi's open-source Skills collection, featuring web design, knowledge retrieval, image generation, and… |
| [heilcheng/awesome-agent-skills](https://github.com/heilcheng/awesome-agent-skills) | 6k | Tutorials, Guides and Agent Skills Directories |

### Single skills (20)

One standout skill per repo.

| Repo | Stars | What it is |
|---|---:|---|
| [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | 196k | A single CLAUDE.md file to improve Claude Code behavior, derived from Andrej Karpathy's observations on LLM… |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 110k | An AI SKILL that provide design intelligence for building professional UI/UX multiple platforms |
| [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | 95k | Turn any codebase, with its docs, SQL schemas, configs, and PDFs, into a queryable knowledge graph. A /grap… |
| [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) | 93k | 🪨 why use many token when few token do trick — Claude Code skill that cuts 65% of tokens by talking like ca… |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | 89k | Makes your AI agent think like the laziest senior dev in the room. The best code is the code you never wrote. |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 67k | Taste-Skill - gives your AI good taste. stops the AI from generating boring, generic slop |
| [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) | 53k | AI agent skill that researches any topic across Reddit, X, YouTube, HN, Polymarket, and the web - then synt… |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 50k | The design language that makes your AI harness better at design. |
| [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) | 41k | AI turns documents or topics into real, native PowerPoint decks—with native shapes, transitions and animati… |
| [blader/humanizer](https://github.com/blader/humanizer) | 31k | Agent skill that removes signs of AI-generated writing from text |
| [alchaincyf/nuwa-skill](https://github.com/alchaincyf/nuwa-skill) | 29k | 你想蒸馏的下一个员工，何必是同事。蒸馏任何人的思维方式——心智模型、决策启发式、表达DNA。Distill how anyone thinks. |
| [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides) | 26k | Create beautiful slides on the web using a coding agent's frontend skills |
| [OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files) | 26k | Persistent file-based planning for AI coding agents and long-running tasks. Crash-proof markdown plans, ses… |
| [op7418/guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) | 22k | AI-agent Skill for generating polished HTML slide decks: editorial magazine and Swiss layouts, image prompt… |
| [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design) | 22k | Huashu Design · HTML-native design skill for Claude Code · Claude Code 里 HTML 原生的设计 skill · 高保真原型 / 幻灯片 / 动… |
| [titanwings/colleague-skill](https://github.com/titanwings/colleague-skill) | 20k | 将冰冷的离别化为温暖的 Skill，欢迎加入数字生命1.0！Transforming cold farewells into warm skills? It's giving rebirth era. Welcom… |
| [tanweai/pua](https://github.com/tanweai/pua) | 19k | 你是一个曾经被寄予厚望的 P8 级工程师。Anthropic 当初给你定级的时候，对你的期望是很高的。  一个agent使用的高能动性的skill。  Your AI has been placed on a PI… |
| [Nutlope/hallmark](https://github.com/Nutlope/hallmark) | 17k | Anti-AI-slop design skill for Claude Code, Cursor, and Codex. |
| [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | 12k | Universal SEO skill for Claude Code. 25 sub-skills + 18 sub-agents covering technical SEO, E-E-A-T, schema,… |
| [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) | 11k | A Claude skill that writes the accurate prompts for any AI tool. Zero tokens or credits wasted. Full contex… |

### Skill platforms (22)

Frameworks, CLIs and products that ship or manage skills.

| Repo | Stars | What it is |
|---|---:|---|
| [openclaw/openclaw](https://github.com/openclaw/openclaw) | 384k | Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞 |
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | 233k | The agent harness performance optimization system. Skills, instincts, memory, security, and research-first… |
| [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | 220k | The agent that grows with you |
| [garrytan/gstack](https://github.com/garrytan/gstack) | 124k | Use Garry Tan's exact Claude Code setup: 23 opinionated tools that serve as CEO, Designer, Eng Manager, Rel… |
| [zylon-ai/private-gpt](https://github.com/zylon-ai/private-gpt) | 57k | Complete API layer for private AI applications on local models: RAG, skills, tools, MCP, text-to-sql, and m… |
| [jeecgboot/JeecgBoot](https://github.com/jeecgboot/JeecgBoot) | 47k | 【低代码迈入v2.0时代，一句话即可生成整个系统】企业级AI低代码平台，一键生成前后端代码甚至整个系统。 AI Skills 一句话画流程、设计表单、生成报表、大屏。内置 AI应用平台涵盖：AI聊天、知识库、流程编… |
| [zhayujie/CowAgent](https://github.com/zhayujie/CowAgent) | 46k | Open-source super AI assistant & Agent Harness. Plans tasks, runs tools and skills, self-evolves with memor… |
| [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) | 42k | World's first open-source, agentic video production system. 12 production pipelines, 100+ tools, 700+ agent… |
| [multica-ai/multica](https://github.com/multica-ai/multica) | 42k | The open-source managed agents platform. Turn coding agents into real teammates — assign tasks, track progr… |
| [danny-avila/LibreChat](https://github.com/danny-avila/LibreChat) | 41k | Enhanced ChatGPT Clone: Features Agents, MCP, Skills, DeepSeek, Anthropic, AWS, OpenAI, Responses API, Azur… |
| [wshobson/agents](https://github.com/wshobson/agents) | 38k | Multi-harness agentic plugin marketplace for Claude Code, Codex CLI, Cursor, OpenCode, GitHub Copilot, and… |
| [googleworkspace/cli](https://github.com/googleworkspace/cli) | 30k | Google Workspace CLI — one command-line tool for Drive, Gmail, Calendar, Sheets, Docs, Chat, Admin, and mor… |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | 27k | The open agent skills tool - npx skills |
| [charmbracelet/crush](https://github.com/charmbracelet/crush) | 27k | Glamourous agentic coding for all 💘 |
| [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search) | 26k | The job search that runs on your machine. AI job application framework built on Claude Code: evaluate posti… |
| [flipped-aurora/gin-vue-admin](https://github.com/flipped-aurora/gin-vue-admin) | 25k | 🚀Vite+Vue3+Gin拥有AI辅助的基础开发平台，企业级业务AI+开发解决方案，内置mcp辅助服务，内置skills管理，支持TS和JS混用。它集成了JWT鉴权、权限管理、动态路由、显隐可控组件、分页封装、多… |
| [iOfficeAI/OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) | 22k | OfficeCLI is the first and best Office suite  purpose-built for AI agents to read, edit, and automate Word,… |
| [teng-lin/notebooklm-py](https://github.com/teng-lin/notebooklm-py) | 18k | Unofficial Python API and agentic skill for Google NotebookLM. Full programmatic access to NotebookLM's fea… |
| [larksuite/cli](https://github.com/larksuite/cli) | 16k | The official Lark/Feishu CLI tool, maintained by the larksuite team — built for humans and AI Agents. Cover… |
| [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) | 15k | SkillOpt is a text-space optimizer that trains reusable natural-language skills for frozen LLM agents throu… |
| [yusufkaraaslan/Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers) | 15k | Convert documentation websites, GitHub repositories, and PDFs into Claude AI skills with automatic conflict… |
| [NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector) | 14k | Security scanner for AI agent skills. Detect vulnerabilities, malicious patterns, and security risks. |

### MCP servers (13)

Individual MCP servers: browsers, databases, design tools, apps.

| Repo | Stars | What it is |
|---|---:|---|
| [upstash/context7](https://github.com/upstash/context7) | 60k | Context7 Platform -- Up-to-date code documentation for LLMs and AI code editors |
| [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | 35k | High-performance code intelligence MCP server. Indexes codebases into a persistent knowledge graph — averag… |
| [oraios/serena](https://github.com/oraios/serena) | 27k | A powerful MCP toolkit for coding, providing semantic retrieval and editing capabilities  - the IDE for you… |
| [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) | 25k | Open-source MCP to use Blender with any LLM |
| [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp) | 22k | A MCP for Claude Desktop / Claude Code / Windsurf / Cursor to build n8n workflows for you |
| [googleapis/mcp-toolbox](https://github.com/googleapis/mcp-toolbox) | 16k | MCP Toolbox for Databases is an open source MCP server for databases. |
| [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP) | 15k | MCP server to provide Figma layout information to AI coding agents like Cursor |
| [xpzouying/xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) | 15k | MCP for xiaohongshu.com |
| [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp) | 13k | Unity MCP acts as a bridge between AI assistants and your Unity Editor. Give your LLM tools to manage asset… |
| [hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome) | 12k | Chrome MCP Server is a Chrome extension-based Model Context Protocol (MCP) server that exposes your Chrome… |
| [BeehiveInnovations/pal-mcp-server](https://github.com/BeehiveInnovations/pal-mcp-server) | 12k | The power of Claude Code / GeminiCLI / CodexCLI + [Gemini / OpenAI / OpenRouter / Azure / Grok / Ollama / C… |
| [mrexodia/ida-pro-mcp](https://github.com/mrexodia/ida-pro-mcp) | 11k | AI-powered reverse engineering assistant that bridges IDA Pro with language models through MCP. |
| [0x4m4/hexstrike-ai](https://github.com/0x4m4/hexstrike-ai) | 10k | HexStrike AI MCP Agents is an advanced MCP server that lets AI agents (Claude, GPT, Copilot, etc.) autonomo… |

### MCP frameworks (3)

SDKs and frameworks for building MCP servers & clients.

| Repo | Stars | What it is |
|---|---:|---|
| [PrefectHQ/fastmcp](https://github.com/PrefectHQ/fastmcp) | 27k | 🚀 The fast, Pythonic way to build MCP servers and clients. |
| [tadata-org/fastapi_mcp](https://github.com/tadata-org/fastapi_mcp) | 12k | Expose your FastAPI endpoints as Model Context Protocol (MCP) tools, with Auth! |
| [mcp-use/mcp-use](https://github.com/mcp-use/mcp-use) | 10k | The fullstack MCP framework to develop MCP Apps for ChatGPT / Claude & MCP Servers for AI Agents. |

### MCP infrastructure (3)

Gateways, context optimizers and security scanners.

| Repo | Stars | What it is |
|---|---:|---|
| [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) | 62k | Compress tool outputs, logs, files, and RAG chunks before they reach the LLM. 20% fewer tokens for coding a… |
| [mksglu/context-mode](https://github.com/mksglu/context-mode) | 19k | Context window optimization for AI coding agents. Sandboxes tool output (98% reduction), persists session m… |
| [NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector) | 14k | Security scanner for AI agent skills. Detect vulnerabilities, malicious patterns, and security risks. |

### Agent tools (16)

Capabilities for agents: browser use, sandboxes, memory, toolkits.

| Repo | Stars | What it is |
|---|---:|---|
| [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | 156k | The API to search, scrape, and interact with the web at scale. 🔥 |
| [browser-use/browser-use](https://github.com/browser-use/browser-use) | 107k | 🌐 Make websites accessible for AI agents. Automate tasks online with ease. |
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | 62k | Universal memory layer for AI Agents |
| [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | 39k | Browser automation CLI for AI agents |
| [ComposioHQ/composio](https://github.com/ComposioHQ/composio) | 29k | Composio powers 1000+ toolkits, tool search, context management, authentication, and a sandboxed workbench… |
| [getzep/graphiti](https://github.com/getzep/graphiti) | 29k | Build Real-Time Knowledge Graphs for AI Agents |
| [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | 27k | Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills. |
| [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 27k | 817 structured cybersecurity skills for AI agents · Mapped to 6 frameworks: MITRE ATT&CK, NIST CSF 2.0, MIT… |
| [browserbase/stagehand](https://github.com/browserbase/stagehand) | 24k | The SDK For Browser Agents |
| [iOfficeAI/OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) | 22k | OfficeCLI is the first and best Office suite  purpose-built for AI agents to read, edit, and automate Word,… |
| [trycua/cua](https://github.com/trycua/cua) | 21k | Scale computer-use 2.0 with open-source drivers, cross-OS fleets, and benchmarks for training, evaluation,… |
| [h4ckf0r0day/obscura](https://github.com/h4ckf0r0day/obscura) | 20k | The headless browser for AI agents and web scraping |
| [yusufkaraaslan/Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers) | 15k | Convert documentation websites, GitHub repositories, and PDFs into Claude AI skills with automatic conflict… |
| [e2b-dev/E2B](https://github.com/e2b-dev/E2B) | 13k | Open-source, secure environment with real-world tools for enterprise-grade agents. |
| [opensandbox-group/OpenSandbox](https://github.com/opensandbox-group/OpenSandbox) | 12k | Secure, Fast, and Extensible Sandbox runtime for AI agents. |
| [TencentCloud/CubeSandbox](https://github.com/TencentCloud/CubeSandbox) | 11k | Instant, Concurrent, Secure & Lightweight Sandbox for AI Agents. |

### Office (3)

Word, Excel, PowerPoint, Gmail, Drive, Lark — office work for agents.

| Repo | Stars | What it is |
|---|---:|---|
| [googleworkspace/cli](https://github.com/googleworkspace/cli) | 30k | Google Workspace CLI — one command-line tool for Drive, Gmail, Calendar, Sheets, Docs, Chat, Admin, and mor… |
| [iOfficeAI/OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) | 22k | OfficeCLI is the first and best Office suite  purpose-built for AI agents to read, edit, and automate Word,… |
| [larksuite/cli](https://github.com/larksuite/cli) | 16k | The official Lark/Feishu CLI tool, maintained by the larksuite team — built for humans and AI Agents. Cover… |

### Writing (3)

Writing, humanizing and content-creation skills.

| Repo | Stars | What it is |
|---|---:|---|
| [blader/humanizer](https://github.com/blader/humanizer) | 31k | Agent skill that removes signs of AI-generated writing from text |
| [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills) | 24k | Empty description; topics verified: agent-skills, claude-skills, codex-skills, openclaw-skills |
| [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) | 11k | A Claude skill that writes the accurate prompts for any AI tool. Zero tokens or credits wasted. Full contex… |

### Marketing & SEO (5)

CRO, SEO, ads and social-content skills.

| Repo | Stars | What it is |
|---|---:|---|
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | 42k | Marketing skills for Claude Code and AI agents. CRO, copywriting, SEO, analytics, and growth engineering. |
| [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | 12k | Universal SEO skill for Claude Code. 25 sub-skills + 18 sub-agents covering technical SEO, E-E-A-T, schema,… |
| [zubair-trabzada/geo-seo-claude](https://github.com/zubair-trabzada/geo-seo-claude) | 9.1k | GEO-first SEO skill for Claude Code. Comprehensive AI search optimization for any website — citability scor… |
| [AgriciDaniel/claude-ads](https://github.com/AgriciDaniel/claude-ads) | 7.5k | Claude-first paid-media operations skill for Claude Code across 12 ad platforms (Google, Meta, YouTube, Lin… |
| [op7418/guizang-social-card-skill](https://github.com/op7418/guizang-social-card-skill) | 5.5k | 🪧 Claude Code / Codex skill — generate Xiaohongshu carousels & WeChat 21:9+1:1 cover pairs. Editorial × Swi… |

### Business & PM (2)

Product management, job search and business operations.

| Repo | Stars | What it is |
|---|---:|---|
| [phuryn/pm-skills](https://github.com/phuryn/pm-skills) | 24k | PM Skills Marketplace: 100+ agentic skills, commands, and plugins — from discovery to strategy, execution,… |
| [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills) | 6k | Product Management skills framework built on battle-tested methods for Claude Code, Cowork, Codex, and AI a… |

### Research (9)

Academic research, paper writing and science skills.

| Repo | Stars | What it is |
|---|---:|---|
| [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) | 53k | AI agent skill that researches any topic across Reddit, X, YouTube, HN, Polymarket, and the web - then synt… |
| [Imbad0202/academic-research-skills](https://github.com/Imbad0202/academic-research-skills) | 39k | Academic Research Skills for Claude Code: research → write → review → revise → finalize |
| [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | 32k | Turn any AI agent into an AI Scientist. The #1 Agent Skills library for science, used by 160,000+ scientist… |
| [Yuan1z0825/nature-skills](https://github.com/Yuan1z0825/nature-skills) | 31k | 符合nature论文学术表达和科研绘图的Skill |
| [teng-lin/notebooklm-py](https://github.com/teng-lin/notebooklm-py) | 18k | Unofficial Python API and agentic skill for Google NotebookLM. Full programmatic access to NotebookLM's fea… |
| [qiye45/wechatDownload](https://github.com/qiye45/wechatDownload) | 8.6k | 微信公众号文章批量下载工具，支持评论、合集下载，支持保存html/mhtml/md/pdf/docx/csv文件，保存文章内图片、视频、音频文件，支持MCP/Skill调用 |
| [Imbad0202/academic-research-skills-codex](https://github.com/Imbad0202/academic-research-skills-codex) | 7.1k | Codex-native Academic Research Skills suite for human-in-the-loop academic research workflows |
| [jacob-bd/notebooklm-mcp-cli](https://github.com/jacob-bd/notebooklm-mcp-cli) | 5.6k | Programmatic access to Google NotebookLM — via command-line interface (CLI), Model Context Protocol (MCP) s… |
| [Master-cai/Research-Paper-Writing-Skills](https://github.com/Master-cai/Research-Paper-Writing-Skills) | 5.5k | Skill package for ML/CV/NLP paper writing, curated and adapted from Prof. Peng Sida's open notes for Codex,… |

### Creative & media (8)

Design, slides, video and image production.

| Repo | Stars | What it is |
|---|---:|---|
| [nexu-io/open-design](https://github.com/nexu-io/open-design) | 81k | 🎨 The open-source Claude Design alternative. 🖥️ Local-first desktop app. 🖼️ Your coding agent becomes the d… |
| [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) | 42k | World's first open-source, agentic video production system. 12 production pipelines, 100+ tools, 700+ agent… |
| [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides) | 26k | Create beautiful slides on the web using a coding agent's frontend skills |
| [op7418/guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) | 22k | AI-agent Skill for generating polished HTML slide decks: editorial magazine and Swiss layouts, image prompt… |
| [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design) | 22k | Huashu Design · HTML-native design skill for Claude Code · Claude Code 里 HTML 原生的设计 skill · 高保真原型 / 幻灯片 / 动… |
| [nicobailon/visual-explainer](https://github.com/nicobailon/visual-explainer) | 9.3k | Agent skill that generates rich HTML pages or slide decks for diagrams, diff reviews, plan audits, data tab… |
| [nexu-io/html-anything](https://github.com/nexu-io/html-anything) | 7.9k | ✨ The agentic HTML editor — your local AI agent writes the HTML, you ship it. 🚀 75 Skills × 9 Surfaces (mag… |
| [Agents365-ai/drawio-skill](https://github.com/Agents365-ai/drawio-skill) | 6.6k | Generate draw.io diagrams from natural language — 11 presets (UML, SysML/MBSE, BPMN, network, C4…), 36 tool… |

### Life & personal (4)

Notes, PKM and personal automation.

| Repo | Stars | What it is |
|---|---:|---|
| [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) | 43k | Agent skills for Obsidian. Teach your agent to use Obsidian CLI and open formats including Markdown, Bases,… |
| [hesamsheikh/awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases) | 32k | A community collection of OpenClaw use cases for making life easier. |
| [AgriciDaniel/claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) | 9.9k | Self-organizing AI second brain for Obsidian + Claude Code. Drop any source and Claude reads, links, and fi… |
| [therealXiaomanChu/ex-skill](https://github.com/therealXiaomanChu/ex-skill) | 5.9k | 把前任蒸馏成 AI Skill，用ta的方式跟你说话。 |

### Awesome lists — skills (9)

Curated lists of skills.

| Repo | Stars | What it is |
|---|---:|---|
| [Shubhamsaboo/awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps) | 127k | 100+ AI Agents, Agent Skills and RAG Apps - Free and Open Source. |
| [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | 70k | A curated list of awesome Claude Skills, resources, and tools for customizing Claude AI workflows |
| [VoltAgent/awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) | 52k | The awesome collection of OpenClaw skills. 5,400+ skills filtered and categorized from the official OpenCla… |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 51k | A hand-picked collection of the finest of resources for the most awesome of agents, Claude Code, the undisp… |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | 37k | Community-contributed instructions, agents, skills, and configurations to help you make the most of GitHub… |
| [Leey21/awesome-ai-research-writing](https://github.com/Leey21/awesome-ai-research-writing) | 32k | Elevate your AI research writing, no more tedious polishing ✨ |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 29k | A curated collection of 1000+ agent skills from official dev teams and the community, compatible with Claud… |
| [composio-community/awesome-codex-skills](https://github.com/composio-community/awesome-codex-skills) | 15k | A curated list of practical Codex skills for automating workflows across the Codex CLI and API. |
| [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) | 14k | A curated list of awesome Claude Skills, resources, and tools for customizing Claude AI workflows — particu… |

### Awesome lists — MCP (1)

Curated lists of MCP servers.

| Repo | Stars | What it is |
|---|---:|---|
| [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | 91k | A collection of MCP servers. |
