---
allowed-tools: Bash(python:*)
description: Extract git commits for portfolio
argument-hint: "<repo_path> [--author name]"
---

# Git Commit Collector

Extract commit history from a git repository for portfolio use.

## Arguments

$ARGUMENTS

## Instructions

Run the git commit collector script with the provided arguments.

**Default behavior:**
- Output: `~/.claude/private/<repo_name>_commits.json`
- Max files: 10 (omit file list if more than 10 files changed)

**Script location:** `~/.claude/skills/git-commit-collector/extract_commits.py`

## Execution

Parse the arguments:
- First argument: repository path (required)
- `--author` or `-a`: filter by author name
- `--since`: date filter (e.g., "1 week ago", "2024-01-01")
- `-n` or `--limit`: max number of commits
- `--max-files`: threshold for omitting file list (default: 10)

Construct and run the command:
```bash
python ~/.claude/skills/git-commit-collector/extract_commits.py <repo_path> -o ~/.claude/private/<repo_name>_commits.json [options]
```

After extraction, report:
1. Number of commits extracted
2. Summary statistics (lines added/deleted, commit types)
3. Output file location
