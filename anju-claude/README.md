# anju-claude

Global Claude Code configuration system for command/skill workflow automation and data management.

## System Overview

### Commands
**Slash commands** that appear in Claude Code's command palette. Commands automate common workflows by combining tool calls, dynamic context injection, and task-specific logic. They enforce the "right way" to do things.

### Skills
**Reusable utilities** (Python scripts, shell scripts) that commands invoke. Skills contain the actual implementation logic that can be called directly or wrapped by commands for user-facing workflows.

### Standards
**Technical standards and coding conventions** organized by domain. When working on a task, consult relevant standards to ensure consistency and quality. Multiple standards can apply to a single task.

### Private
**Personal data storage** for Claude-collected information (commit histories, notes, cached data). Gitignored by default to protect sensitive information.

---

## Standards by Task Type

### Unreal C++ Development
When working with Unreal Engine C++ code, consult **both** standards:

- **`unreal-engine.md`** - Naming conventions (PascalCase, U/A/F/E/I prefixes), brace style, loop variables
- **`code-review-cpp.md`** - Code quality checklist (memory management, UObject system, threading, performance, Blueprint integration, networking)

**Example workflow**: Writing a new UActorComponent
1. Check `unreal-engine.md` for naming (prefix with `U`, use PascalCase)
2. Check `code-review-cpp.md` for UObject best practices (UPROPERTY, GENERATED_BODY, etc.)

### Python Scripting
- *(Future: python-standards.md)*

### Git Workflow
- Automated via `/commit-m` and `/collect-commits` commands
- *(Future: git-standards.md for branch naming, PR conventions)*

### General C++ (Non-Unreal)
- **`code-review-cpp.md`** - Memory management, best practices, performance (ignore Unreal-specific sections)

---

## Quick Reference

### Available Commands
- **`/commit-m`** - Generate conventional commit messages from staged changes
- **`/clean-up`** - Update CLAUDE.md project overview based on codebase analysis
- **`/collect-commits`** - Extract git commit history for portfolio use
- **`/open-invoice`** - Open invoice generator web app (select student from dropdown)
- **`/move-invoice <student_name>`** - Move latest PDF from Downloads to private/tutoring/invoices

### Available Skills
- **`git-commit-collector`** - Git commit history extraction and analysis tool
- **`invoice-generator`** - Web-based invoice generator for tuition billing

---

## Directory Structure

```
anju-claude/
├── commands/            # Slash commands for workflow automation
│   ├── commit-m.md
│   ├── clean-up.md
│   ├── collect-commits.md
│   ├── open-invoice.md
│   └── move-invoice.md
├── skills/              # Reusable utilities (scripts, tools)
│   └── git-commit-collector/
├── standards/           # Technical standards and conventions
│   ├── unreal-engine.md
│   └── code-review-cpp.md
├── private/             # Personal data (gitignored)
│   ├── commits/
│   ├── notes/
│   ├── cache/
│   └── tutoring/
│       ├── presets.json      # Student & bank info
│       └── invoices/         # Generated invoices archive
├── CLAUDE.md            # System documentation (read this for details)
└── README.md            # This file
```

---

For detailed information on creating commands, writing skills, and extending this system, see **[CLAUDE.md](CLAUDE.md)**.
