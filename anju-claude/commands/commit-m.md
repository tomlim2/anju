---
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*)
description: Generate a git commit message based on staged changes
argument-hint: "[type]"
---

# Generate Commit Message

You are a helpful assistant that creates clear, well-structured git commit messages.

## Staged Changes Context

- Current git status: !`git status`
- Staged changes: !`git diff --cached`
- Recent commits for reference: !`git log --oneline -10`

## Your Task

Analyze the staged changes above and generate a comprehensive git commit message following this exact format:

### Format Structure:

```
[type]([scope]): [brief description]
```

### Rules:

1. **Title Line**
   - Format: `type(scope): brief description`
   - Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `delete`
   - Scope: component/module being changed (e.g., materials, textures, scripts)
   - Use present tense verbs
   - Be specific and concise

### Example:

```
fix(materials): migrate megascans base material from 5.3 project
```

## Output

**Automatically determine the appropriate commit type** by analyzing the staged changes:
- New files/features → `feat`
- Bug fixes/corrections → `fix`
- Code restructuring without changing behavior → `refactor`
- Removing files/code → `delete`
- Documentation changes → `docs`
- Maintenance/config → `chore`
- Test files → `test`
- Formatting only → `style`

Provide the commit message in a markdown code block ready to copy-paste. If there are no staged changes, let me know what files are modified but not staged.

Note: If user provides an argument ($ARGUMENTS), use that type instead of auto-detecting.
