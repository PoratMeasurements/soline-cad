# Soline Block Library — Architecture & Standards (Stage 1)

> **Status: STAGE 1 — DOCUMENTS ONLY. No code, no DXF, no blocks, no previews have been generated.**
> This folder defines the architecture and standards for an **original, parametric** block library
> for Soline Measurement Solutions (room measurement · interior kitchens · outdoor kitchens).
> The library is generated **schema-first**: every object is a JSON instance validated against a
> JSON Schema, and only then rendered to DXF blocks + previews + QA.
>
> Nothing here builds anything yet. This is the specification the owner reviews and approves before
> any generator code is written or any block is produced.

Date: 2026-08-22 · Units: mm · Language of deliverables: Hebrew (docs in English for engineering clarity).

---

## Reading order (deliverables A–J)

| # | File | Deliverable |
|---|------|-------------|
| — | `00_INDEX.md` (this file) | Map + hard-gate statement |
| — | `LICENSES.md` | **Binding** source-license register (principles 1–3) — read first |
| A | `A_ARCHITECTURE.md` | Library architecture & pipeline; how it plugs into the converter and coexists with the MEP symbol set + SOL-* layers |
| B | `B_TAXONOMY.md` | Full families/subfamilies taxonomy (extensible) |
| C | `C_OBJECT_SCHEMA.json` + `C_OBJECT_SCHEMA.md` | The authoritative parametric JSON Schema + a worked example |
| D | `D_NAMING.md` | Naming standard (files, block names, keys) |
| E | `E_LAYERS.md` | Layers standard, anchored to the existing SOL-* taxonomy |
| F | `F_INSERTION_POINTS.md` | Insertion-point standard per family/view |
| G | `G_ATTRIBUTES.md` | Block ATTRIB + metadata standard |
| H | `H_VIEW_MATRIX.md` | Plan / Front / Side / Section matrix per family |
| I | `I_QA_STANDARD.md` | Automated QA checks, per-cycle QA report format, the ≤10-blocks + contact-sheet gate |
| J | `J_FIRST20.md` | Prioritized first 20 blocks |
| — | `examples/base_cabinet_600.object.json` | Concrete schema instance (referenced by C) |

---

## The 9 binding principles (governing all of the above)

1. Never copy files, blocks, geometry, or names from commercial libraries.
2. May use CC0 sources and **factual** dimensions from manufacturer specs.
3. Manufacturer files are for dimension-checking/fit **only** — unless their license explicitly permits inclusion in a software product.
4. Every generic block is created **from scratch** (parametric geometry, original).
5. Every object is defined **first as a JSON Schema instance**, and only then generated to DXF.
6. Each object gets **Plan / Front / Side** as relevant (Section where a family needs it).
7. Never generate more than **TEN blocks per work cycle**.
8. After each cycle: a **Contact Sheet** of all previews + a **QA report**.
9. Never proceed to the next family without the **owner's explicit approval**.

These are encoded operationally in `I_QA_STANDARD.md` (gate) and `LICENSES.md` (provenance).

---

## Environment reality (verified 2026-08-22)

- **Python / ezdxf: NOT available** on this machine (`python` → not found; confirms the prior agent's finding).
- **Node.js v24.18.1: present.**
- The Soline converter **already contains a hand-rolled AC1015 DXF writer in Node**
  (`converter/src/dxf_soline.js`) with working `BLOCK` / `BLOCK_RECORD` / `INSERT` support,
  handle-seed management, embedded ISO-128 lineweights, and the SOL-* layer table.
- **Decision:** the block generator is **Node-based**, reusing the proven writer. ezdxf is *not*
  a dependency. The system is nonetheless **language-agnostic at the schema layer** (Deliverable A):
  the JSON Schema + instances are the contract; the Node emitter is one backend, and an ezdxf
  backend can be added later without changing a single object definition, should Python appear.
