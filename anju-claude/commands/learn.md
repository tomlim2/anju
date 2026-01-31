---
allowed-tools: Read, Edit, Write, Bash(mkdir:*), Bash(ls:*), Bash(date:*)
description: Update project learnings with new insight
argument-hint: "<project> <category: convention|worked|failed|gotcha>"
---

# Update Learnings

Add a new learning to the project wisdom vault.

## Arguments

$ARGUMENTS

Parse as: `<project_name> <category>`

Categories:
- `convention` - Pattern discovered in codebase
- `worked` - Successful approach worth repeating
- `failed` - Approach that didn't work (and why)
- `gotcha` - Non-obvious issue that causes problems

## Execution

1. **Parse arguments** - Extract project name and category
2. **Check/create directory**: `~/.claude/private/learnings/projects/`
3. **Read or create** project file: `~/.claude/private/learnings/projects/<project>.md`
   - If new, copy from `~/.claude/private/learnings/_template.md`
4. **Ask user** to describe the learning
5. **Append** to appropriate section with today's date
6. **Confirm** the addition

## Current Learnings

Projects with learnings:
!`ls ~/.claude/private/learnings/projects/ 2>/dev/null || echo "No learnings yet - this will be the first!"`

## Template Location

!`cat ~/.claude/private/learnings/_template.md 2>/dev/null || echo "Template not found - will create project file from scratch"`

## Today's Date

!`date +%Y-%m-%d`
