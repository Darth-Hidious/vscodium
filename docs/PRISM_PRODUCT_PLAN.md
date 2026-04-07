# PRISM Desktop — Complete Product Plan

*Updated 2026-04-07 with full CLI capability mapping and market research*

---

## 1. Architecture: How Everything Connects

```
┌──────────────────────────────────────────────────────────────────┐
│                    MARC27 Platform                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Auth/SSO │  │ Billing  │  │ Node Reg │  │ Marketplace API  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└──────────────────────┬───────────────────────────────────────────┘
                       │ WebSocket + REST
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ PRISM    │  │ PRISM    │  │ PRISM    │  ← Federated mesh
   │ Node A   │  │ Node B   │  │ Node C   │    (Kafka + mDNS)
   │ (Lab)    │  │ (HPC)    │  │ (Cloud)  │
   └────┬─────┘  └──────────┘  └──────────┘
        │
   ┌────┴────────────────────────────────────┐
   │ PRISM CLI (Rust binary, v2.6.1)         │
   │                                          │
   │ 16 crates │ 50+ slash commands           │
   │ 40+ Python tools │ 10 skills             │
   │ 3 workflows │ Plugin system              │
   │                                          │
   │ Services: Neo4j, Qdrant, Kafka, Docker   │
   │ Security: E2EE (X25519), RBAC, OPA/Rego  │
   │ Compute: Local, MARC27 Cloud, BYOC       │
   └────┬────────────────────────────────────┘
        │ JSON-RPC 2.0 (stdio)
        ▼
   ┌─────────────────────────────────────────┐
   │ PRISM Desktop (this IDE)                 │
   │                                          │
   │ Bundled extensions (free)                │
   │ + Marketplace extensions (free/paid)     │
   │ + VS Code extensions (Open VSX)          │
   └─────────────────────────────────────────┘
```

**Key principle:** The CLI is the engine. The IDE is a GUI surface. Every paid extension wraps existing CLI capabilities with a visual interface. Scientists who prefer terminal get the CLI. Scientists who prefer GUI get the IDE. Both authenticate through MARC27, both access the same marketplace.

---

## 2. What PRISM CLI Already Has (Complete Inventory)

### 2.1 Rust Crates (16)

| Crate | Purpose | Key Capabilities |
|-------|---------|-----------------|
| **cli** | Entry point | 20+ commands, dynamic workflow dispatch |
| **agent** | AI runtime | TAOR loop, 100+ tool implementations, 50+ slash commands, session management |
| **server** | HTTP API | 16 endpoints, 5 query modes (NL, Cypher, Graph, Semantic, Federated), WebSocket, embedded dashboard |
| **node** | Daemon | Platform registration, heartbeat, job dispatch, capability probing (GPU/CPU/storage/datasets), container execution |
| **mesh** | Networking | mDNS + Platform discovery, Kafka pub/sub (9 message types), federated queries, peer tracking |
| **compute** | Job dispatch | 3 backends (Local Docker, MARC27 Cloud, BYOC via SSH/K8s/SLURM), job tracking |
| **ingest** | Data pipeline | CSV/Parquet → LLM entity extraction → Neo4j graph + Qdrant embeddings |
| **workflows** | YAML engine | DAG execution, Mustache templating, policy checks, parallel steps |
| **core** | Shared logic | RBAC (4 roles, 8 permissions), audit trail (10 action types), config (8 sections), tool registry |
| **policy** | Authorization | OPA/Rego engine (pure Rust), per-workflow + per-tool checks |
| **proto** | Wire types | Node↔Platform protocol, JSON-RPC envelopes, capability advertisement |
| **ipc** | CLI↔TUI bridge | JSON-RPC 2.0 over stdio pipes |
| **client** | Platform API | REST client, device-flow OAuth, marketplace, node registry |
| **python-bridge** | Worker mgmt | Spawns Python TAOR worker, venv management |
| **runtime** | Primitives | XDG paths, credential storage, platform endpoints |
| **orch** | Orchestration | Docker Compose lifecycle for Neo4j, Qdrant, Kafka, Spark |

### 2.2 Python Tools (40+)

**Materials Search & Data**
| Tool | What It Does | Data Sources |
|------|-------------|--------------|
| `search_materials` | Federated OPTIMADE search across 20+ providers | NOMAD, MP, OQMD, COD, Alexandria, GNoME |
| `query_materials_project` | Direct Materials Project queries | Materials Project API |
| `literature_search` | Academic paper search | arXiv, Semantic Scholar |
| `patent_search` | Patent database search | Lens.org API |
| `import_dataset` | Load CSV/JSON/Parquet into PRISM DataStore | Local files |
| `export_results_csv` | Export results | Local files |
| `knowledge_search` | Graph entity search (200K+ nodes, 6M+ edges) | MARC27 Knowledge Graph |
| `knowledge_entity` | Entity + neighbor traversal | MARC27 Knowledge Graph |
| `knowledge_paths` | Shortest path between entities | MARC27 Knowledge Graph |
| `knowledge_stats` | Graph statistics | MARC27 Knowledge Graph |
| `semantic_search` | Embedding-based search (6K+ docs) | MARC27 Embeddings (Gemini 3072-dim) |
| `list_corpora` | Available datasets (MP, JARVIS-DFT, QMOF, MatKG...) | MARC27 Platform |
| `knowledge_ingest` | Entity extraction from URL/text | LLM + Neo4j + Qdrant |

**ML & Prediction**
| Tool | What It Does |
|------|-------------|
| `predict_property` | Composition → property prediction (RF, XGBoost, LightGBM, Linear) |
| `predict_structure` | GNN prediction from crystal structure (M3GNet, MEGNet) |
| `list_models` | Enumerate trained + pretrained models |
| `list_predictable_properties` | Scan dataset for trainable properties |

**Simulation & CALPHAD**
| Tool | What It Does |
|------|-------------|
| `create_structure` | Build crystal (FCC/BCC/HCP/diamond) |
| `modify_structure` | Supercell, strain, vacancy, substitution |
| `get_structure_info` | Composition, cell, volume, symmetry |
| `list_potentials` | Available interatomic potentials (EAM, MEAM, Tersoff, LJ) |
| `run_simulation` | Execute MD/DFT/LAMMPS/VASP/ABINIT/GPAW/QE |
| `submit_hpc_job` | Batch to SLURM/PBS/SGE |
| `run_convergence_test` | Parameter sweep (encut/kpoints) |
| `run_workflow` | Pre-built: elastic_constants, phonons, EOS, thermal_expansion |
| `calculate_phase_diagram` | Binary/ternary CALPHAD (PyCalphad) |
| `calculate_equilibrium` | Thermodynamic equilibrium |
| `calculate_gibbs_energy` | Gibbs energy surface |
| `list_calphad_databases` | Available TDB files |
| `import_calphad_database` | Add user TDB |

**Compute & Infrastructure**
| Tool | What It Does |
|------|-------------|
| `compute_gpus` | Available GPU types + pricing |
| `compute_providers` | Registered providers (RunPod, Lambda, PRISM nodes) |
| `compute_estimate` | Cost estimate before submission |
| `compute_submit` | Dispatch container job |
| `compute_status` / `compute_cancel` | Monitor / stop |
| `spark_submit_job` | PySpark ETL (transform, SQL, describe) |
| `spark_batch_transform` | Multi-op pipeline (dedup, filter, sort) |

**Visualization**
| Tool | What It Does |
|------|-------------|
| `plot_materials_comparison` | Scatter plot of two properties |
| `plot_property_distribution` | Histogram |
| `plot_correlation_matrix` | Correlation heatmap |

**Validation**
| Tool | What It Does |
|------|-------------|
| `detect_outliers` | Z-score outlier detection |
| `check_physical_constraints` | Materials science bounds (band_gap ≥ 0, density > 0, etc.) |
| `score_completeness` | Per-column completeness scoring |

**Premium Labs (MARC27)**
| Tool | What It Does |
|------|-------------|
| `list_lab_services` | A-Labs, DfM, Cloud DFT, Quantum, Synchrotron, HT Screening |
| `get_lab_service_info` | Detailed capabilities + pricing |
| `check_lab_subscriptions` | Active subscriptions + usage |
| `submit_lab_job` | Submit to premium lab |

### 2.3 Skills (10 multi-step orchestrations)

| Skill | Steps |
|-------|-------|
| `acquisition` | Collect data from multiple sources, normalize, store |
| `discovery` | Search → screen → rank → present candidates |
| `phase_analysis` | CALPHAD calculation → phase identification → stability check |
| `prediction` | Feature engineering → model selection → train → predict → validate |
| `reporting` | Gather results → statistics → correlations → generate markdown/HTML |
| `review` | Load dataset → outlier check → constraint check → completeness → report |
| `selection` | Multi-criteria screening → Pareto ranking → recommendation |
| `simulation_plan` | Analyze composition → pick method → plan calculations → estimate cost |
| `validation` | Schema check → physical constraints → cross-reference → quality score |
| `visualization` | Auto-detect data type → pick chart → render → save |

### 2.4 Built-in Workflows (3 YAML)

| Workflow | Steps | Purpose |
|----------|-------|---------|
| `materials_discovery` | search → identify_gaps → fill_gaps → present → ingest → dataset → analysis → report | End-to-end discovery pipeline |
| `forge` | paper → extract → train → validate → publish | Research paper → trained ML model |
| `ingest` | browse → read → extract entities → store in graph | Web content → knowledge graph |

### 2.5 Server HTTP API (16 endpoints)

| Endpoint | Method | Permission | Purpose |
|----------|--------|-----------|---------|
| `/api/health` | GET | Public | Liveness |
| `/api/sessions` | POST | Public (10/sec) | Login |
| `/api/mesh/nodes` | GET | Public | List peers |
| `/api/mesh/subscriptions` | GET | Public | List pub/sub |
| `/api/v1/node` | GET | ViewDashboard | Node info |
| `/api/data/sources` | GET | ViewDashboard | Graph stats |
| `/api/tools` | GET | ViewDashboard | Tool list |
| `/api/query` | POST | QueryData | 5 query modes |
| `/api/mesh/publish` | POST | IngestData | Publish dataset |
| `/api/mesh/subscribe` | POST/DELETE | IngestData | Sub/unsub |
| `/api/data/ingest` | POST | IngestData | Queue ingestion |
| `/api/tools/{name}/run` | POST | ExecuteTools | Run tool |
| `/api/users` | GET/POST | ManageUsers | User mgmt |
| `/api/audit` | GET | ViewAudit | Audit log |
| `/api/sessions` | DELETE | Auth | Logout |
| `/ws` | GET (upgrade) | Auth | Real-time events |

### 2.6 Security

| Feature | Implementation |
|---------|---------------|
| E2E Encryption | X25519 key agreement + ChaCha20-Poly1305 AEAD |
| Signing | Ed25519 |
| RBAC | 4 local roles × 8 permissions (SQLite) |
| Platform Roles | Owner → Admin → Member → Viewer (synced from MARC27) |
| Policy Engine | OPA/Rego (pure Rust regorus, no external deps) |
| Audit Trail | Append-only SQLite, 10 action types |
| Session | 24h TTL, SQLite-backed |
| Rate Limiting | 10/sec sessions, 100/sec API |

### 2.7 Mesh Networking

| Feature | Detail |
|---------|--------|
| Discovery | mDNS (`_prism._tcp.local`) + MARC27 platform-mediated |
| Pub/Sub | Kafka with 9 message types (Announce, Goodbye, DataPublish, Subscribe, QueryForward, etc.) |
| Federation | HTTP query fan-out to peers, 10s timeout, result merge |
| Peer Tracking | node_id, name, address, capabilities, last_seen |
| Dataset Sharing | Publish name + schema → subscribers get updates |
| BYOC | Bring Your Own Compute via SSH, Kubernetes, or SLURM |

---

## 3. Market Context

### 3.1 The Problem

Scientists use **5-15 different tools daily** that don't talk to each other. No single environment connects simulation setup, execution, analysis, data management, and collaboration.

| Category | Current Tools | Pain Points |
|----------|--------------|-------------|
| DFT simulation | VASP (€4K+), QE (free, hard) | Cryptic input files, weeks to learn, no GUI |
| Molecular dynamics | LAMMPS, GROMACS | Complex MPI setup |
| Thermodynamics | Thermo-Calc ($$), FactSage ($$) | Expensive, closed, not scriptable |
| ML potentials | MACE, CHGNet, M3GNet | Python-only, no GUI, hard to compare |
| Databases | Materials Project (400K users), AFLOW (4M+ entries), NOMAD (100M+ calcs) | API limits, 7-15% data disagreements |
| Visualization | OVITO, VESTA, Origin ($495/yr) | Separate tools, no workflow integration |
| Lab notebooks | Jupyter | No provenance, reproducibility crisis |
| Collaboration | Email, Google Drive, institutional wikis | No structured data sharing |

### 3.2 Competitor Pricing

| Platform | Price | Revenue/Funding |
|----------|-------|-----------------|
| Citrine Informatics | ~$100K+/yr enterprise | $81M raised, $140M valuation |
| Schrodinger (SDGR) | $50-100K/yr | Public company |
| BIOVIA Materials Studio | $5-50K/yr | Dassault subsidiary |
| Ansys Granta | Quote-based | Part of $5B+ Ansys |
| Mat3ra | Pay-per-use | 30K+ scientists |
| Rowan | $0.04/credit | $2.1M pre-seed, 800+ chemists |

**Market size:** $250M (2024) → $1B+ by 2034, 19% CAGR.

### 3.3 Key Insight for Aerospace/Nuclear Clients

ESA/ArianeGroup workflow: candidate screening → DFT simulation → coupon fabrication → standardized testing (ECSS-Q-ST-70C) → qualification report → materials review board → flight approval. Each stage uses different tools, different teams, different formats. **PRISM can be the single data backbone connecting all stages.**

Standards compliance required: ECSS-Q-ST-70C (ESA materials), NASA-STD-6016B, DO-178C (flight software), NQA-1 (nuclear). ArianeGroup directly shapes ECSS standards.

---

## 4. Distribution & Marketplace

### 4.1 Three Channels

| Channel | What | Who Pays | Examples |
|---------|------|----------|---------|
| **Bundled with IDE** | Core experience | Free (adoption driver) | Agent chat, welcome, materials explorer, mesh dashboard, auth, theme |
| **MARC27 Marketplace — Free** | Community tools, ecosystem growth | Free | Data collectors GUI, knowledge graph explorer, workflow runner, session manager |
| **MARC27 Marketplace — Paid** | Premium extensions, verticals | Subscription | CALPHAD explorer, sim builder, ML studio, alloy workbench, aerospace modules |

### 4.2 Marketplace Economics

Based on JetBrains (15%), Atlassian (15-25%), Unity (30%):

| Our Model | Detail |
|-----------|--------|
| Revenue split | **80/20** (developer gets 80%, MARC27 gets 20%) |
| Listing fee | $0 (no barrier to publish) |
| First-year bonus | 95/5 for new developers (incentivize ecosystem) |
| Academic pricing | Free for .edu domains |
| Enterprise | Per-org seat licensing |
| On-premise | Air-gapped marketplace support (Docker container, manual sideload) |

### 4.3 On-Premise Deployment (ESA, ArianeGroup, National Labs)

Required for ITAR/EAR compliance and classified programs:
- **Offline license validation** (no call-home)
- **Manual extension sideloading** (USB transfer for air-gapped)
- **Curated/approved extension lists** managed by security officers
- **Full audit trail** (PRISM already has this)
- **Self-hosted marketplace** (Docker container, like VS Code Private Marketplace)

### 4.4 How Extension Install Works

```
User clicks "Install" in IDE marketplace panel
  → Extension ID sent to MARC27 API
  → API checks subscription/billing
  → Returns .vsix download URL
  → IDE downloads and installs extension
  → Extension activates, calls PRISM CLI tools via JSON-RPC or HTTP API
```

For CLI users:
```
prism marketplace install <extension-name>
  → Downloads tool/workflow/model
  → Installs to ~/.prism/tools/ or ~/.prism/workflows/
  → Available immediately in next prism session
```

Same marketplace listing serves both IDE extensions AND CLI tools.

---

## 5. Feature Plan — What We Build

### Tier 0: Already Done (ships with IDE today)

| Extension | CLI Tool | Status |
|-----------|----------|--------|
| prism-agent-chat | `prism backend` (JSON-RPC) | ✅ Done — auto-starts, bundled binary |
| prism-welcome | N/A (NASA background, pill chat) | ✅ Done — streaming agent responses |
| prism-materials | Materials search via agent | ✅ Done — periodic table + composition builder |
| prism-mesh | `prism node`, `prism mesh` | ✅ Done — nodes + jobs dashboard |
| prism-marketplace | `prism marketplace` | ✅ Done — queries PRISM server, agent fallback |
| prism-auth | `prism login` (CLI state) | ✅ Done — reads CLI credentials |
| prism-theme | N/A | ✅ Done — PRISM Dark with prismatic palette |

### Tier 1: Free Marketplace Extensions (next 2 weeks)

| Extension | CLI Tools It Wraps | What the GUI Adds |
|-----------|-------------------|------------------|
| **prism-data-hub** | `import_dataset`, `export_results_csv`, DataStore, all 5 collectors | Browse/preview datasets (Parquet viewer), visual import wizard, collection scheduler, dataset metadata editor |
| **prism-knowledge-graph** | `prism query`, `prism ingest`, `knowledge_*` tools | Interactive Neo4j graph visualization, click-to-explore nodes, visual Cypher builder, entity relationship map |
| **prism-workflows** | `prism workflow run/list/show` | Visual YAML workflow editor, step-by-step execution view, drag-and-drop step reordering, built-in + marketplace workflow browser |
| **prism-sessions** | `/sessions`, `/session resume/fork` | Session browser with search, conversation diff view, fork visualization, session export |
| **prism-search** | Search engine (20+ OPTIMADE providers, MP, semantic) | Unified search bar across all data sources, federated results with provider badges, save searches, search history |
| **prism-notebooks** | Python bridge + all tools | Jupyter notebook integration with PRISM kernel, materials-aware autocomplete, inline structure viewers |

### Tier 2: Paid Marketplace Extensions (next month)

| Extension | CLI Tools | What the GUI Adds | Price |
|-----------|-----------|------------------|-------|
| **prism-calphad** | `calculate_phase_diagram`, `calculate_equilibrium`, `calculate_gibbs_energy`, all CALPHAD tools | Interactive phase diagram explorer, click-to-calculate, Scheil solidification viz, database browser. Replaces $10K+ Thermo-Calc for common use. | $29/mo |
| **prism-sim-builder** | `create_structure`, `modify_structure`, `run_simulation`, `submit_hpc_job`, `run_convergence_test`, `run_workflow` | Visual VASP/QE/LAMMPS input builder, 3D structure preview, parameter tooltips, smart defaults, convergence dashboard, HPC submission panel | $19/mo |
| **prism-ml-studio** | `predict_property`, `predict_structure`, ML trainer/predictor/features, `list_models` | Train/evaluate/compare models visually, feature importance plots, hyperparameter tuning GUI, model registry with metrics dashboard | $29/mo |
| **prism-structure-editor** | `create_structure`, `modify_structure`, `get_structure_info`, `list_potentials` | 3D crystal/molecular editor (Three.js), point-and-click defect creation, surface slabs, supercell builder, symmetry analysis, CIF/POSCAR/XYZ export | $19/mo |
| **prism-hpc-manager** | `submit_hpc_job`, `check_hpc_queue`, `compute_*` tools | Visual SLURM/PBS/SGE job submission, queue monitor, GPU availability dashboard, cost tracking, log streaming | $19/mo |
| **prism-validation** | `detect_outliers`, `check_physical_constraints`, `score_completeness`, validation skill | Automated QA dashboard, dataset health scores, outlier highlighting, constraint violation alerts, comparison with literature values | $19/mo |
| **prism-compute-broker** | `compute_gpus`, `compute_providers`, `compute_submit`, `compute_estimate` | GPU marketplace browser, cost comparison across providers, one-click job submission, budget alerts, usage analytics | $19/mo |

### Tier 3: Vertical Premium Extensions (next quarter)

For aerospace, nuclear, and energy clients (ESA, ArianeGroup, ITER, national labs).

| Extension | What It Does | CLI Tools + New Tools | Price |
|-----------|-------------|----------------------|-------|
| **prism-alloy-workbench** | Composition optimization: CALPHAD + DFT + ML. Pareto over strength, density, cost, oxidation resistance. Candidate ranking. | CALPHAD tools + predict_property + search_materials + custom optimization | $99/mo |
| **prism-thermal-protection** | High-temp ceramics screening, ablation modeling, oxidation kinetics. Property handoff DFT → CALPHAD → FEM. ECSS-Q-ST-70C compliance tracking. | Simulation tools + CALPHAD + custom ablation models | $99/mo |
| **prism-radiation-damage** | Displacement cascade sim, ion irradiation, defect evolution. NQA-1 compliant data tracking. | LAMMPS tools + custom radiation models + validation | $99/mo |
| **prism-propulsion-materials** | Turbine blade alloys, combustion chamber ceramics, nozzle optimization. Creep/fatigue life prediction. | CALPHAD + simulation + ML prediction + custom |$99/mo |
| **prism-battery-module** | Electrode screening: DFT voltage → migration barriers → PyBaMM cell simulation. Ragone plot generation. | Simulation + ML + custom PyBaMM bridge | $49/mo |
| **prism-polymer-builder** | Visual polymer chain construction, monomer library, LAMMPS/GROMACS input generation, Tg prediction. | Structure tools + custom polymer builder | $49/mo |
| **prism-experiment-bridge** | Import XRD/SEM/mechanical data, overlay with computed predictions, track theory vs experiment, generate comparison reports. | Validation tools + custom format parsers + visualization | $49/mo |
| **prism-lab-services** | GUI for premium labs (A-Labs, DfM, Cloud DFT, Quantum, Synchrotron, HT Screening). Job submission, status tracking, result visualization. | `lab_*` tools + visual dashboards | $49/mo |

---

## 6. What's Not Yet in the Plan (Needs Building in the IDE)

| Item | What | Priority |
|------|------|----------|
| Native MARC27 account | Activity bar gear icon shows MARC27 login (core workbench, not extension) | High |
| Prismatic visual identity | Animated gradient accents done properly (not the broken CSS attempt) | High |
| Get Started walkthrough | PRISM-native onboarding replacing stock VS Code | High |
| Slash command support in pill | `/tools`, `/workflow`, `/search` routed through `input.command` | Medium |
| Marketplace install flow | End-to-end: browse → auth check → download .vsix → install → activate | Medium |
| Extension auto-update | Check MARC27 marketplace for new versions on startup | Medium |
| Dataset visualization panel | Parquet/CSV viewer, chart builder, inline in editor tabs | Medium |
| 3D structure viewer | CIF/POSCAR/XYZ inline preview (Three.js in webview) | Medium |
| Community extension publishing | Third-party developers can submit extensions for review | Low |
| Offline marketplace | Air-gapped sideloading for enterprise | Low (but critical for ESA) |

---

## 7. Revenue Model

### Pricing Tiers

| Tier | Price | Target |
|------|-------|--------|
| **Free** (IDE + bundled) | $0 | Everyone — drives adoption |
| **Academic** | $0 (all marketplace extensions free for .edu) | Students, researchers — pipeline to enterprise |
| **Individual Pro** | $29/mo or $249/yr | Independent researchers, postdocs |
| **Team** | $49/user/mo | Research groups (5-20 people) |
| **Enterprise** | Custom (per-org, on-premise option) | ESA, ArianeGroup, national labs |

### Conservative Year 1 Projections

| Revenue Source | Users | ARPU | ARR |
|---------------|-------|------|-----|
| Tier 2 individual subscriptions | 1,000 | $22/mo avg | $264K |
| Tier 3 vertical licenses | 100 seats | $75/mo avg | $90K |
| Enterprise contracts | 5 orgs | $50K/yr avg | $250K |
| Compute broker margin (MARC27 cloud) | — | — | $100K |
| **Total** | | | **~$704K ARR** |

### Academic Pipeline
- Free IDE + free marketplace for .edu → build muscle memory
- Students graduate → join ArianeGroup, ESA, BASF → request PRISM
- Conversion target: 1-3% of academic users to paid enterprise (industry standard)
- JetBrains model: 88 of Fortune 100 use their tools, all started with free student licenses

---

## 8. Implementation Phases

### Phase 1 — This Week
- [x] Agent chat connected to PRISM backend (auto-start)
- [x] Welcome screen with glassmorphic pill chat
- [x] Materials explorer with agent search
- [x] Marketplace wired to PRISM server
- [x] Auth unified to CLI state
- [x] PRISM Dark theme
- [x] Bundled prism binary inside .app
- [ ] Native MARC27 account in activity bar
- [ ] Fix prismatic visual identity (subtle gradients, not broken CSS)
- [ ] Get Started walkthrough

### Phase 2 — Next 2 Weeks
- [ ] prism-data-hub (free)
- [ ] prism-knowledge-graph (free)
- [ ] prism-workflows (free)
- [ ] Slash command support in pill chat
- [ ] Marketplace end-to-end install flow

### Phase 3 — Next Month
- [ ] prism-calphad (paid)
- [ ] prism-sim-builder (paid)
- [ ] prism-ml-studio (paid)
- [ ] 3D structure viewer
- [ ] Dataset visualization

### Phase 4 — Next Quarter
- [ ] Aerospace vertical extensions
- [ ] On-premise/air-gapped deployment
- [ ] Community extension publishing
- [ ] prism-experiment-bridge

---

## 9. Open Questions

1. **MARC27 marketplace API**: Does it already support extension listing, versioning, and download? Or do we need to build those endpoints?
2. **Bundled vs marketplace for Tier 1**: Should the free extensions ship bundled with the IDE, or should users install them from the marketplace (better for update cadence)?
3. **Extension signing**: Do we need code signing for marketplace extensions? (Yes for enterprise/air-gapped)
4. **Pricing experiments**: Should we start with annual-only to reduce churn, or monthly to lower barrier?
5. **Third-party developers**: When do we open the marketplace to external contributors? What's the review process?
6. **ITAR/EAR**: Which extensions touch export-controlled data? Those need special handling for US customers.
