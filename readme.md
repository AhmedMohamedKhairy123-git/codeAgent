# 🧠 codeAgent — The Nervous System for AI Agents
![codeAgent Demo](videocodeagent.gif)

> *Your AI agent finally understands your codebase. Not just searches it — **understands** it.*

<div align="center">


[![License](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![Trendshift](https://trendshift.io/api/badge/repositories/19809)](https://trendshift.io/repositories/19809)

**[🌐 Try Web UI](https://code-agent-eta.vercel.app/)** · **[📦 npm](https://www.npmjs.com/package/codeAgent)**

</div>

---

> ⚠️ **No Crypto.** codeAgent has zero official tokens, coins, or anything on Pump.fun. Don't get scammed.

---

## 💡 Why codeAgent Exists

Every AI coding tool — Cursor, Claude Code, Codex, Windsurf — has the same blind spot:

```
🤖 AI edits UserService.validate()
❌ Doesn't know 47 things depend on its return type
💥 Breaking changes ship to production
```

They search your code. They don't *know* it.

codeAgent fixes this by building a **knowledge graph** of your entire codebase at index time — every dependency, every call chain, every execution flow — and exposing it through smart tools your AI agent can actually use.

---

## ✨ What Makes It Different

| Traditional RAG | 🧠 codeAgent |
|---|---|
| LLM gets raw graph edges | Pre-computed, structured intelligence |
| 4–10 queries to understand one function | Complete answer in a single tool call |
| Misses cross-file dependencies | Full blast radius, always |
| Only works well with large models | **Small models get full architectural clarity** |

---

## 🚀 Get Started in 30 Seconds

```bash
# Index your repo (run from root)
npx codeAgent analyze
```

That one command indexes your codebase, installs agent skills, registers Claude Code hooks, and creates `AGENTS.md` / `CLAUDE.md` — everything your AI needs to work safely.

---

## 🗺️ Two Ways to Use It

### ⚙️ CLI + MCP *(recommended for daily dev)*

Indexes repos locally and connects your AI agents via the Model Context Protocol.

```bash
npm install -g codeAgent

codeAgent setup        # one-time: configures MCP for your editors
codeAgent analyze      # index current repo
codeAgent mcp          # start MCP server
```

### 🌐 Web UI *(for quick exploration)*

No install. Drag & drop a ZIP. Start exploring.
→ **[codeAgent.vercel.app](https://codeAgent.vercel.app)**

Or connect the two: `codeAgent serve` lets the web UI browse all your locally-indexed repos.

---

## 🔌 Editor Support

| Editor | MCP | Skills | Auto-Hooks |
|--------|:---:|:------:|:----------:|
| **Claude Code** | ✅ | ✅ | ✅ Full |
| **Cursor** | ✅ | ✅ | — |
| **Codex** | ✅ | ✅ | — |
| **Windsurf** | ✅ | — | — |
| **OpenCode** | ✅ | ✅ | — |

**Claude Code** gets the deepest integration — MCP tools, agent skills, and pre/post commit hooks that automatically re-index after changes.

### Quick MCP Setup

**Claude Code:**
```bash
claude mcp add codeAgent -- npx -y codeAgent@latest mcp
```

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "codeAgent": {
      "command": "npx",
      "args": ["-y", "codeAgent@latest", "mcp"]
    }
  }
}
```

**Codex** (`~/.codex/config.toml`):
```toml
[mcp_servers.codeAgent]
command = "npx"
args = ["-y", "codeAgent@latest", "mcp"]
```

---

## 🛠️ Tools Your Agent Gets

7 MCP tools, exposed automatically:

| 🔧 Tool | 💬 What It Does |
|--------|----------------|
| `query` | Hybrid search (BM25 + semantic + RRF), results grouped by execution flow |
| `context` | 360° symbol view — every caller, callee, and process it touches |
| `impact` | Blast radius analysis before you edit anything |
| `detect_changes` | Pre-commit check — what did your changes actually affect? |
| `rename` | Multi-file rename that understands the call graph |
| `cypher` | Raw graph queries for power users |
| `list_repos` | See all indexed repositories |

### 💥 Impact Analysis in Action

```
impact({target: "UserService", direction: "upstream"})

▸ Depth 1 — WILL BREAK:
    handleLogin     [CALLS 90%]  src/api/auth.ts:45
    handleRegister  [CALLS 90%]  src/api/auth.ts:78
    UserController  [CALLS 85%]  src/controllers/user.ts:12

▸ Depth 2 — LIKELY AFFECTED:
    authRouter      [IMPORTS]    src/routes/auth.ts
```

### 🔍 Process-Grouped Search

```
query({query: "authentication middleware"})

▸ LoginFlow (7 steps, cross-community)
    validateUser → src/auth/validate.ts (step 2)
    AuthConfig   → src/types/auth.ts
```

### 🔄 Safe Multi-File Rename

```
rename({symbol_name: "validateUser", new_name: "verifyUser", dry_run: true})

✅ 5 files affected, 8 total edits
   6 graph edits    → safe, apply automatically
   2 text edits     → review manually
```

---

## 📚 Resources & Live Context

Access structured codebase data instantly:

```
codeAgent://repo/{name}/context     → stats, staleness, available tools
codeAgent://repo/{name}/clusters    → all functional communities + cohesion scores
codeAgent://repo/{name}/processes   → all execution flows
codeAgent://repo/{name}/process/{n} → full step-by-step trace
codeAgent://repo/{name}/schema      → graph schema for Cypher queries
```

---

## 🌍 13 Languages Supported

TypeScript · JavaScript · Python · Java · Kotlin · C# · Go · Rust · PHP · Ruby · Swift · C · C++

| Capability | Coverage |
|---|---|
| Explicit type annotations | All 13 languages |
| Constructor inference | All 13 languages |
| For-loop element typing | 12 languages (Swift pending) |
| Cross-file binding propagation | All 13 languages |
| Field/property chain resolution | 9 languages (up to 3 levels deep) |
| Method overload disambiguation | Java, Kotlin, C#, C++, TypeScript |
| MRO-aware inheritance walking | Java, Kotlin, C#, C++, TypeScript, Python |
| Pattern / null-check narrowing | TypeScript, Kotlin, C# |

---

## 🏗️ How Indexing Works

codeAgent builds its knowledge graph in 6 phases:

```
① Structure    → file tree, folder relationships
② Parsing      → functions, classes, methods via Tree-sitter ASTs
③ Resolution   → imports, call edges, receiver types, cross-file bindings
④ Clustering   → Leiden community detection → functional areas
⑤ Processes    → execution flow tracing from entry points
⑥ Search       → BM25 + vector hybrid index
```

The type resolution layer alone spans 3 tiers — explicit annotations → constructor inference → fixpoint propagation — across a unified loop that handles arbitrary-depth chains like:

```typescript
const user = getUser()        // callResult  → User
const addr = user.address     // fieldAccess → Address
const city = addr.getCity()   // methodCall  → City
city.save()                   // resolved ✅
```

---

## 📖 Wiki Generation

Auto-generate documentation from your knowledge graph:

```bash
codeAgent wiki                          # uses gpt-4o-mini by default
codeAgent wiki --model gpt-4o           # custom model
codeAgent wiki --base-url <api-url>     # custom provider
codeAgent wiki --force                  # full regeneration
```

Produces per-module docs with cross-references, all grounded in the actual call graph — not hallucinated summaries.

---

## 🧩 Agent Skills (Auto-Installed)

Running `codeAgent analyze` drops 4 skill files into `.claude/skills/`:

| 🎯 Skill | When to Use |
|----------|-------------|
| **Exploring** | Navigate unfamiliar code using the knowledge graph |
| **Debugging** | Trace bugs through call chains |
| **Impact Analysis** | Assess blast radius before changes |
| **Refactoring** | Plan safe refactors using dependency maps |

Run `--skills` to also generate **repo-specific skills** — one per detected functional community, describing key files, entry points, and cross-area connections.

---

## ⚡ CLI Reference

```bash
codeAgent setup                      # configure MCP for editors (one-time)
codeAgent analyze [path]             # index or update repo
codeAgent analyze --force            # force full re-index
codeAgent analyze --skills           # generate repo-specific skill files
codeAgent analyze --embeddings       # enable semantic search (slower)
codeAgent analyze --skip-embeddings  # skip embeddings (faster)
codeAgent mcp                        # start MCP server (stdio)
codeAgent serve                      # start HTTP server for web UI
codeAgent list                       # list all indexed repos
codeAgent status                     # index status for current repo
codeAgent clean                      # delete index for current repo
codeAgent clean --all --force        # delete everything
codeAgent wiki [path]                # generate wiki from knowledge graph
```

---

## 🔒 Privacy & Security

- **CLI**: 100% local. Zero network calls. Index lives in `.codeAgent/` (gitignored). Only paths stored in `~/.codeAgent/registry.json`.
- **Web UI**: 100% in-browser. Your code never touches a server. API keys stay in localStorage only.
- **Open source**: audit it yourself.

---

## 🏛️ Tech Stack

| Layer | CLI | Web |
|-------|-----|-----|
| Runtime | Node.js native | Browser (WASM) |
| Parsing | Tree-sitter native | Tree-sitter WASM |
| Database | LadybugDB native | LadybugDB WASM |
| Embeddings | transformers.js (GPU/CPU) | transformers.js (WebGPU) |
| Search | BM25 + semantic + RRF | BM25 + semantic + RRF |
| Clustering | Graphology (Leiden) | Graphology (Leiden) |
| Visualization | — | Sigma.js + WebGL |
| Agent Interface | MCP (stdio) | LangChain ReAct |

---

## 🗺️ Roadmap

### 🔨 In Progress
- [ ] LLM-powered cluster naming (semantic labels via API)
- [ ] AST decorator detection (`@Controller`, `@Get`, etc.)
- [ ] Incremental indexing — only re-index changed files

### ✅ Recently Shipped
- [x] Cross-file binding propagation across all 13 languages
- [x] Unified fixpoint loop — arbitrary-depth chain resolution
- [x] MRO-aware inheritance walking + `this`/`self` resolution
- [x] Constructor-visible virtual dispatch (Java, C#, TS, C++, Kotlin)
- [x] Optional parameter arity resolution (7 languages)
- [x] Wiki generation, multi-file rename, git-diff impact analysis
- [x] Multi-repo MCP, zero-config setup
- [x] Phase 14: Cross-file binding propagation (all 13 languages)

---

## 🤝 Community Integrations

| 🔗 Project | 👤 Author | 📝 Description |
|-----------|----------|---------------|
| [pi-codeAgent](https://github.com/tintinweb/pi-codeAgent) | @tintinweb | codeAgent plugin for pi — `pi install npm:pi-codeAgent` |
| [codeAgent-stable-ops](https://github.com/ShunsukeHayashi/codeAgent-stable-ops) | @ShunsukeHayashi | Stable ops & deployment workflows |

Built something on codeAgent? Open a PR to add it here! 🙌

---

## 💖 Acknowledgements

Big thanks to the shoulders this stands on:

- 🌳 [Tree-sitter](https://tree-sitter.github.io/) — AST parsing across 13 languages
- 🐞 [LadybugDB](https://ladybugdb.com/) — embedded graph database with vector support
- 🌐 [Sigma.js](https://www.sigmajs.org/) — WebGL graph rendering
- 🤗 [transformers.js](https://huggingface.co/docs/transformers.js) — in-browser ML
- 📊 [Graphology](https://graphology.github.io/) — graph data structures & Leiden clustering
- 🔌 [MCP](https://modelcontextprotocol.io/) — Model Context Protocol

---

## ⭐ Star History



---

<div align="center">

**Built for engineers who are tired of their AI breaking things it didn't know about.**

[⭐ Star on GitHub](https://github.com/AhmedMohamedKhairy123-git/codeAgent) · 

</div>