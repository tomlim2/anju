# Plan: Restructure Design System for Quick Reference

Transform the CSS-heavy design system into a language-agnostic quick reference that's instantly scannable in any context (Notion, C++, Python, web).

---

## Goal

Make design tokens and rules **immediately visible** without scrolling through CSS code blocks.

## Approach

Restructure into sections:

### 1. Quick Reference Card (Top)
Visual summary box with core rules:
- Philosophy: B&W brutalist, zero ornamentation, all radius = 0
- Primary colors: `#000000` (black), `#FFFFFF` (white)
- Base unit: 4px
- Font: Monospace primary, Sans secondary

### 2. Token Tables (Language-Agnostic)

**Colors** - Simple table:
| Name | Hex | Use |
|------|-----|-----|
| Black | #000000 | Primary, inverse bg |
| White | #FFFFFF | Primary bg |
| Gray-900 | #0A0A0A | Near black |
| ... | ... | ... |

**Spacing** - 4px base:
| Token | Value | Multiplier |
|-------|-------|------------|
| space-1 | 4px | 1x |
| space-2 | 8px | 2x |
| ... | ... | ... |

**Typography**:
| Style | Size | Weight | Use |
|-------|------|--------|-----|
| Display | 48px | Bold | Hero |
| H1 | 32px | Bold | Page title |
| ... | ... | ... | ... |

**Borders**:
| Name | Width | Use |
|------|-------|-----|
| thin | 1px | Subtle |
| medium | 2px | Default |
| thick | 4px | Emphasis |
| heavy | 8px | Maximum |

### 3. Component Guidelines (Prose, not CSS)
Short rules for each component type:
- **Buttons**: 2px black border, uppercase text, no radius
- **Inputs**: Monospace font, 2px gray border → black on focus
- **Cards**: 2px black border, 24px padding
- etc.

### 4. Principles (Keep)
- No animations (except spinners)
- Instant state changes
- Geometric icons only
- WCAG AAA contrast

### 5. Code Reference (Collapsed/End)
Move detailed CSS to end or separate file for those who need it.

---

## File to Modify

`~/.claude/standards/design-system.md`

## Verification

- Can find any color hex in < 5 seconds
- Can find any spacing value in < 5 seconds
- Readable without understanding CSS syntax
- Works as reference for UE Slate, ImGui, web, or any UI framework

---

## Files to Create

### Commands (4 files)

| File | Purpose |
|------|---------|
| `commands/ultrawork.md` | Maximum intensity mode - aggressive exploration, mandatory todo tracking, continue until done |
| `commands/consult.md` | Read-only oracle consultation for architecture, debugging, code review |
| `commands/explore.md` | Fast parallel codebase exploration |
| `commands/learn.md` | Add new insights to project wisdom vault |

### Private Structure (2 files)

| File | Purpose |
|------|---------|
| `private/learnings/README.md` | How to use the learnings vault |
| `private/learnings/_template.md` | Template for new project learnings |

### Standards (1 file)

| File | Purpose |
|------|---------|
| `standards/delegation.md` | 7-section delegation template (TASK, EXPECTED OUTCOME, etc.) |

---

## Command Details

### `/ultrawork` (or `/ulw`)

Activates maximum intensity mode:
- **Mandatory TodoWrite** before any action
- **Parallel exploration** (Glob + Grep + Read simultaneously)
- **Continue until truly complete** (tests pass, code works, verified)
- **No assumptions** - always verify

Key sections:
- Non-negotiable rules
- Execution flow (Understand → Plan → Execute → Verify → Report)
- Dynamic context injection

### `/consult`

Read-only oracle mode:
- **No Edit, No Write** - analysis only
- For architecture decisions, debugging, code review
- Structured output: Understanding → Analysis → Recommendation → Trade-offs → Next Steps

### `/explore`

Fast parallel exploration:
- **File discovery** via Glob
- **Content search** via Grep
- **Structure analysis** via directory listing
- **History** via git log
- Output: Files Found, Key Patterns, Entry Points, Related Areas

### `/learn`

Update project wisdom:
- Categories: convention, worked, failed, gotcha
- Reads/creates project learning file
- Appends with timestamp
- Stored in `private/learnings/projects/<project>.md`

---

## Wisdom Vault Structure

```
private/learnings/
├── README.md           # Usage guide
├── _template.md        # Template for new projects
└── projects/
    ├── anju.md         # Per-project learnings
    └── ...
```

Each project file captures:
- **Conventions** - Patterns discovered
- **What Worked** - Successful approaches
- **What Failed** - Approaches to avoid
- **Gotchas** - Non-obvious issues

---

## Delegation Standard

7-section structure for clear task handoff:

1. **TASK** - One clear sentence
2. **EXPECTED OUTCOME** - Specific, measurable result
3. **REQUIRED SKILLS** - Knowledge needed
4. **REQUIRED TOOLS** - Explicit permissions
5. **MUST DO** - Non-negotiable requirements
6. **MUST NOT DO** - Explicit prohibitions
7. **CONTEXT** - Background info

Includes examples for bug fix and feature delegation.

---

## Verification

After creation, verify each command works:
1. `/ultrawork "test task"` - Should create todos, explore, complete
2. `/consult "architecture question"` - Should analyze without modifying
3. `/explore "pattern name"` - Should run parallel searches
4. `/learn anju convention` - Should prompt for learning and save

Check files exist:
```bash
ls ~/.claude/commands/{ultrawork,consult,explore,learn}.md
ls ~/.claude/private/learnings/{README,_template}.md
ls ~/.claude/standards/delegation.md
```
