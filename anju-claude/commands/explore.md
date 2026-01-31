---
allowed-tools: Glob, Grep, Read, Bash(git log:*), Bash(find:*), Bash(wc:*), Bash(ls:*), Bash(head:*), Task
description: Fast codebase exploration - multiple angles, pattern discovery
argument-hint: "<topic or pattern>"
---

# Explore Mode

Fast, parallel exploration of the codebase from multiple angles.

## Target

$ARGUMENTS

## Exploration Strategy

Execute these searches **in parallel** where possible:

### 1. File Discovery
- Glob for files matching the topic
- Check common locations (src/, lib/, tests/, docs/)
- Look for config files that might be relevant

### 2. Content Search
- Grep for exact term matches
- Grep for related terms (synonyms, abbreviations)
- Search for imports/references

### 3. Structure Analysis
- List directories that might be relevant
- Check for test files (indicates important code)
- Look for documentation (README, docstrings)

### 4. History (if git repo)
- Recent changes touching this topic
- Who has worked on related files

## Output Format

### Files Found
[List of relevant files with one-line description of each]

### Key Patterns
[Code patterns discovered - how this topic is implemented]

### Entry Points
[Best files to start reading - in order of importance]

### Related Areas
[Connected parts of the codebase worth knowing about]

### Suggested Deep Dives
[Specific files or functions worth reading in full]

## Context

Project root: !`pwd`
File types present: !`find . -type f -name "*.*" 2>/dev/null | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -5`
