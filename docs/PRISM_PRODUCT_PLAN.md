# PRISM Desktop — Product Plan

## Distribution Architecture

```
MARC27 Platform (auth, billing, marketplace)
        │
        ├── PRISM CLI (Rust binary)
        │   ├── Tools (Python, installable via `prism marketplace install`)
        │   ├── Skills (multi-step tool chains)
        │   ├── Workflows (YAML, git-versioned)
        │   └── Models (ML models, hosted or local)
        │
        └── PRISM Desktop (this IDE)
            ├── Bundled extensions (ship free with the app)
            ├── Marketplace extensions (install from MARC27, some free, some paid)
            └── VS Code extensions (Open VSX, full compatibility)
```

**Three distribution channels:**

| Channel | What | Who pays | Example |
|---------|------|----------|---------|
| **Bundled with IDE** | Core experience, ships free | Nobody (drives adoption) | Agent chat, welcome, materials explorer, mesh dashboard, auth, theme |
| **MARC27 Marketplace — Free** | Community tools, basic workflows | Nobody (ecosystem growth) | Data collectors, basic templates, community workflows |
| **MARC27 Marketplace — Paid** | Premium extensions, vertical solutions | End user or org subscription | CALPHAD explorer, alloy design workbench, simulation builder, HPC manager |

**Key principle:** Every paid extension wraps a CLI tool/workflow. The CLI tool can be used headless (HPC, CI/CD, scripts). The extension adds the GUI. Scientists who only want CLI get CLI. Scientists who want GUI get the IDE. Both go through the same marketplace and same MARC27 account.

---

## What PRISM CLI Already Has

### Rust Crates (16)
`agent`, `cli`, `client`, `compute`, `core`, `ingest`, `ipc`, `mesh`, `node`, `orch`, `policy`, `proto`, `python-bridge`, `runtime`, `server`, `workflows`

### Python Tools (30+)
- **Data collectors**: Materials Project, OPTIMADE, OMAT24, literature, patents
- **ML pipeline**: trainer, predictor, features, pretrained models, algorithm registry, visualization
- **Simulation**: CALPHAD bridge (pycalphad), simulation planning tools
- **Search engine**: multi-provider (MP, OPTIMADE) with circuit breaker, caching, fusion ranking
- **Validation**: rules-based outlier/constraint/completeness checks
- **Compute**: job submission (local Docker, MARC27 cloud, BYOC)
- **Knowledge graph**: Neo4j + Qdrant ingest, query, and embedding

### Skills (10)
`acquisition`, `discovery`, `phase_analysis`, `prediction`, `reporting`, `review`, `selection`, `simulation_plan`, `validation`, `visualization`

### Built-in Workflows (3)
- `forge` — research paper → trained ML model
- `ingest` — web content → entity extraction → knowledge graph
- `materials_discovery` — end-to-end: search → fill gaps → ingest → analyze

### Slash Commands (50+)
Code execution, agent control, sessions, planning, models, deployments, discourse, memory/files/tasks

---

## Market Research Summary

### What Scientists Use Daily
| Category | Tools | Pain Points |
|----------|-------|-------------|
| **DFT simulation** | VASP ($5.5K+), Quantum ESPRESSO (free, hard), ABINIT | Cryptic input files, weeks to learn, no GUI |
| **Molecular dynamics** | LAMMPS, GROMACS, AMBER | Complex compilation, MPI setup |
| **Thermodynamics** | Thermo-Calc ($$), FactSage ($$), PyCalphad (free) | Expensive licenses, not scriptable |
| **ML potentials** | MACE, CHGNet, M3GNet | Python-only, no GUI, hard to compare |
| **Materials databases** | Materials Project (40K users), AFLOW, OQMD, JARVIS | API rate limits, data disagreements (7-15%) |
| **Visualization** | OVITO (18K+ papers), VESTA, Origin ($495/yr) | Separate tools, no integration |
| **Notebooks** | Jupyter | No provenance, reproducibility issues |
| **Lab data** | XRD (Bruker, PANalytical), SEM/TEM (ImageJ) | Vendor lock-in, proprietary formats |

### Competitor Pricing
| Platform | Price | What they do |
|----------|-------|-------------|
| Citrine Informatics | ~$100K+/yr enterprise | Materials data + AI, no simulation |
| Schrodinger | $50-100K/yr | Molecular simulation suite |
| BIOVIA Materials Studio | $5-50K/yr | Full simulation environment |
| Ansys Granta | Quote-based | Materials database |
| Mat3ra | Pay-per-use | Cloud simulation |
| Rowan | $0.04/credit | Web quantum chemistry |

### Key Insight
The market is **$250M today → $1B+ by 2034**. Nobody offers an integrated IDE that connects simulation, data, AI, and collaboration. The closest is pyiron (Max Planck) — Jupyter-only, no GUI, limited adoption.

---

## Feature Plan — What We Build

### Tier 0: Already Bundled (ships with IDE today)

| Extension | CLI Tool | Status |
|-----------|----------|--------|
| prism-agent-chat | `prism backend` (JSON-RPC) | Done |
| prism-welcome | N/A | Done |
| prism-materials | Materials search via agent | Done |
| prism-mesh | `prism node`, `prism mesh` | Done |
| prism-marketplace | `prism marketplace` | Done |
| prism-auth | `prism login` | Done |
| prism-theme | N/A | Done |

### Tier 1: Free Marketplace Extensions (drives adoption)

These wrap existing CLI tools with a GUI. Free because they make the platform sticky.

| Extension | CLI Tool It Wraps | What It Does | Priority |
|-----------|-------------------|-------------|----------|
| **prism-data-collectors** | `data_collectors/*.py` | GUI for Materials Project, OPTIMADE, OMAT24, literature, patent search. Browse results, filter, ingest into knowledge graph. | High |
| **prism-knowledge-graph** | `prism query`, `prism ingest` | Visual Neo4j graph explorer. Click nodes, see relationships, run Cypher queries visually. | High |
| **prism-workflows** | `prism workflow run/list` | Visual workflow runner. Load YAML, see step-by-step progress, inspect outputs. Browse built-in + marketplace workflows. | High |
| **prism-notebooks** | `prism` Python bridge | Jupyter notebook integration with PRISM tools pre-loaded. Materials-aware kernel. | Medium |
| **prism-sessions** | `prism session`, `/sessions` | Session manager. Browse past conversations, fork, resume, compare. | Medium |
| **prism-search** | Search engine tools | Unified search across all data sources. Federated results from MP, OPTIMADE, OMAT24, local graph. | Medium |

### Tier 2: Paid Marketplace Extensions (revenue)

Premium GUI extensions for specific workflows. Each wraps CLI tools + adds visualization.

| Extension | CLI Tools It Wraps | What It Does | Target Users | Price Model |
|-----------|-------------------|-------------|--------------|-------------|
| **prism-calphad** | `calphad_bridge.py`, PyCalphad | Interactive phase diagram explorer. Click to calculate boundaries, liquidus, solidus. Scheil solidification. Replaces $10K+ Thermo-Calc for basic use. | Metallurgists, alloy designers | $29/mo or $249/yr |
| **prism-sim-builder** | `sim_tools.py`, skill `simulation_plan` | Visual input file builder for VASP, QE, LAMMPS, CP2K. Smart defaults, parameter validation, tooltips. No more cryptic text files. | Computational scientists | $19/mo or $149/yr |
| **prism-ml-studio** | `ml/*.py`, skill `prediction` | Train, evaluate, compare ML models on materials data. Feature engineering, hyperparameter tuning, model registry. | ML researchers | $29/mo or $249/yr |
| **prism-structure-editor** | Requires new tool (ASE/pymatgen bridge) | 3D crystal/molecular structure editor. Point-and-click defect creation, surface slabs, supercells. | All computational materials scientists | $19/mo or $149/yr |
| **prism-hpc-manager** | `prism run`, `prism job-status`, compute crate | Visual HPC job submission. Auto-generate SLURM/PBS scripts, monitor jobs, retrieve results. | Anyone running on clusters | $19/mo or $149/yr |
| **prism-validation** | `validation/rules.py`, skill `validation` + `review` | Automated validation dashboard. Check DFT convergence, compare with literature, flag outliers. Audit trail. | Lab managers, QA | $19/mo or $149/yr |

### Tier 3: Vertical Premium (high-value, niche)

Domain-specific solutions for aerospace, nuclear, and energy clients. These are bundles of tools + workflows + models.

| Extension | What It Does | Target Clients | Price Model |
|-----------|-------------|---------------|-------------|
| **prism-alloy-workbench** | Composition optimization with CALPHAD + DFT + ML. Pareto optimization over strength, density, cost, oxidation resistance. | ArianeGroup, ESA, aerospace | $99/mo or $899/yr |
| **prism-thermal-protection** | High-temp ceramics screening, ablation modeling, oxidation kinetics. Connects DFT → CALPHAD → FEM property handoff. | ESA, space agencies | $99/mo or $899/yr |
| **prism-radiation-damage** | Displacement cascade simulation, ion irradiation, defect evolution tracking. | Nuclear labs, ITER | $99/mo or $899/yr |
| **prism-propulsion-materials** | Turbine blade alloy screening, combustion chamber ceramics, nozzle material optimization. | ArianeGroup, engine manufacturers | $99/mo or $899/yr |
| **prism-battery-module** | Electrode material screening: DFT voltage → migration barriers → PyBaMM cell simulation. | Battery companies, energy labs | $49/mo or $449/yr |
| **prism-polymer-builder** | Visual polymer chain builder, monomer library, auto-generate LAMMPS/GROMACS input. Tg, mechanical properties. | Polymer companies, pharma | $49/mo or $449/yr |
| **prism-experiment-bridge** | Import XRD/SEM/mechanical data, overlay with computed predictions, track theory vs experiment accuracy. | Any lab doing both computation and experiment | $49/mo or $449/yr |

---

## Implementation Priority

### Phase 1 — Immediate (this week)
1. Fix IDE visual polish (prismatic theme done right)
2. Fix remaining errors/bugs in bundled extensions
3. Add proper Get Started walkthrough extension

### Phase 2 — Next 2 weeks
4. **prism-data-collectors** (free) — GUI for existing collectors
5. **prism-knowledge-graph** (free) — visual graph explorer
6. **prism-workflows** (free) — visual workflow runner

### Phase 3 — Next month
7. **prism-calphad** (paid) — phase diagram explorer
8. **prism-sim-builder** (paid) — simulation input builder
9. **prism-ml-studio** (paid) — ML model training GUI

### Phase 4 — Next quarter
10. **prism-structure-editor** (paid) — 3D structure editor
11. **prism-hpc-manager** (paid) — HPC job management
12. Vertical extensions for aerospace/nuclear clients

---

## Revenue Projections

**Assumptions:** Materials informatics market ~$250M (2024), 19% CAGR. PRISM targets the computational materials science segment.

| Tier | Extensions | Price Range | Target Users |
|------|-----------|-------------|-------------|
| Free (bundled + marketplace) | 13 | $0 | Drives adoption, 10K+ users Year 1 |
| Paid Tier 2 | 6 | $19-29/mo | 500-2K paying users Year 1 |
| Paid Tier 3 (verticals) | 7 | $49-99/mo | 50-200 enterprise seats Year 1 |

**Conservative Year 1 estimate:**
- 1,000 Tier 2 users × $20/mo avg = $240K ARR
- 100 Tier 3 seats × $75/mo avg = $90K ARR
- **Total: ~$330K ARR** from marketplace extensions alone

This doesn't include MARC27 platform fees (compute, storage, mesh), which are separate revenue.

---

## Pipeline: How an Extension Gets Built

```
1. Identify CLI tool/workflow that needs a GUI
2. Design the extension (brainstorm → spec)
3. Build the extension (TypeScript, VS Code Extension API)
4. Extension calls CLI tools via:
   - prism backend JSON-RPC (for agent-mediated actions)
   - HTTP API at localhost:7327 (for direct server queries)
   - Direct subprocess spawn (for standalone tools)
5. Test in PRISM Desktop
6. Package as .vsix
7. Publish to MARC27 Marketplace
8. Users install via IDE marketplace panel or `prism marketplace install`
```

---

## Open Questions

1. **Pricing model:** Per-seat monthly? Per-org? Freemium with usage limits?
2. **Bundling:** Should Tier 3 verticals be individual extensions or bundled packs (e.g., "Aerospace Bundle")?
3. **Community marketplace:** Allow third-party developers to publish extensions and take a revenue cut?
4. **Academic pricing:** Free for .edu? Discounted? Open-source core + paid GUI?
5. **On-premise:** Enterprise customers (ESA, ArianeGroup) may need fully on-premise deployment. How does marketplace work offline?
