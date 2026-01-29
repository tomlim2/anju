---
allowed-tools: Glob, Grep, Read, Edit, Bash(git log:*), Bash(git diff:*)
description: Update CLAUDE.md project overview and language conventions
---

# Clean Up CLAUDE.md

Scan the codebase and update the `CLAUDE.md` project overview and conventions to reflect the current state.

## Rules

- **NEVER touch content above the `---` divider** (the philosophy/ultrathink section is sacred)
- Only modify `## Project` and `## Conventions` sections below the divider
- Keep everything minimal — no module-by-module breakdowns, no verbose descriptions
- Show the proposed changes before writing

## Step 1: Scan the Codebase

Gather facts by running these in parallel:

- File types: Glob for `**/*.py`, `**/*.js`, `**/*.ts`, `**/*.bat`, `**/*.ps1`, `**/*.sh`, `**/*.hlsl`, `**/*.glsl`, `**/*.jsx`, `**/*.tsx`
- Dependencies: Read `package.json`, `requirements.txt`, or similar if they exist
- Python modules: List subdirectories under `python/` to detect domain modules
- Recent activity: !`git log --oneline -20`

## Step 2: Analyze Conventions Per Language

For each detected language, identify:

- **Python**: naming style, import patterns, standalone vs modular, type hints usage
- **Shell/Batch/PowerShell**: script structure, error handling patterns
- **Shaders (HLSL/GLSL)**: naming, organization
- **JavaScript/TypeScript**: framework usage, module style
- Any other languages found

Read 2-3 representative files per language to confirm patterns. Don't guess — verify.

## Step 3: Draft Updated Sections

Write two concise sections:

### `## Project`
- 1-2 lines max
- What the project is, what it contains, key characteristic (e.g., self-contained scripts)

### `## Conventions`
- One bullet per language detected
- Format: `- Language: key conventions in a single line`
- Only include languages that have meaningful presence (3+ files)

## Step 4: Apply Changes

1. Read the current `CLAUDE.md`
2. Show the user a before/after comparison of the sections being changed
3. Use the Edit tool to replace only the content below the `---` divider
4. Confirm the update is complete
