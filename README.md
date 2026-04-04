<div id="prism-desktop-logo" align="center">
    <br />
    <h1>PRISM Desktop</h1>
    <h3>Materials Discovery Platform — by MARC27</h3>
    <p>A VS Code-based IDE for materials science, powered by the PRISM agent.</p>
</div>

---

## What is PRISM Desktop?

PRISM Desktop is a rebranded fork of [VSCodium](https://github.com/VSCodium/vscodium) (MIT-licensed VS Code OSS builds) extended with materials-science-specific panels, the PRISM AI agent, Jupyter notebook integration, 3D structure visualization, and the MARC27 marketplace.

**It's VS Code, but the "language" is materials science.**

### For Scientists
- Interactive periodic table and composition builder
- Jupyter notebooks with real kernel connections
- 3D crystal structure and molecular visualization
- Phase diagram rendering
- AI agent that understands materials science

### For Developers
- Full Monaco editor with LSP and autocomplete
- Integrated terminal
- Git integration
- MARC27 marketplace for tools and workflows
- Agent-assisted coding for PRISM tools

### For Project Managers
- Pipeline and job dashboards
- RBAC and user management
- Cost tracking and billing
- Audit trail

## Architecture

PRISM Desktop is a frontend — it consumes the existing PRISM backend APIs:

```
PRISM Desktop (this repo — Electron)
├── VSCodium core (editor, terminal, extensions)
└── PRISM extensions
    ├── prism.agent-chat          — AI agent conversation
    ├── prism.materials-explorer  — periodic table, composition builder
    ├── prism.jupyter-notebooks   — real Jupyter kernel connection
    ├── prism.structure-viewer    — 3D viz (Three.js)
    ├── prism.graph-explorer      — Neo4j knowledge graph
    ├── prism.phase-diagrams      — CALPHAD output rendering
    ├── prism.mesh-dashboard      — node health, job queue
    ├── prism.rbac-admin          — user/role management
    ├── prism.marketplace         — MARC27 tool/workflow store
    ├── prism.billing             — usage and cost tracking
    └── prism.workspace-presets   — Scientist/PM/Dev/Operator layouts

Backend (separate repo): github.com/Darth-Hidious/PRISM
├── prism-server (Axum REST + WebSocket)
├── prism-agent (Rust agent loop)
├── prism-node (compute daemon)
└── 48 Python tools
```

## Building

Prerequisites: Node.js 20+, npm, jq, git

```bash
# Development build (macOS)
./dev/build.sh

# With latest VS Code upstream
./dev/build.sh -l

# Skip source fetch (rebuild only)
./dev/build.sh -s
```

See the [VSCodium build docs](https://github.com/VSCodium/vscodium/blob/master/docs/build.md) for platform-specific instructions.

## Extension Marketplace

PRISM Desktop uses the [Open VSX Registry](https://open-vsx.org/) for community extensions, plus the MARC27 marketplace for materials-science-specific tools and workflows.

## License

- VSCodium build scripts: MIT (upstream)
- VS Code OSS source: MIT (Microsoft)
- PRISM extensions: MARC27 Source-Available License
- PRISM brand assets: Copyright MARC27

## Credits

- [VSCodium](https://github.com/VSCodium/vscodium) — the foundation
- [Microsoft VS Code](https://github.com/microsoft/vscode) — the upstream source
- [MARC27](https://marc27.com) — ESA SPARK Prime Contractor, ITER Supplier
