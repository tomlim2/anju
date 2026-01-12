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

## Summary
[2-3 sentences summarizing what was done and the overall impact]

## Problem
[Describe the issue that necessitated these changes - what was wrong or missing]

## Solution
[Detailed explanation of how the changes solve the problem]

Key changes:
- [Bullet point 1]
- [Bullet point 2]
- [Bullet point 3]
- [etc.]
```

### Rules:

1. **Title Line**
   - Format: `type(scope): brief description`
   - Types: `feature`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `delete`
   - Scope: component/module being changed (e.g., materials, textures, scripts)
   - Use present tense verbs
   - Be specific and concise

2. **Summary Section**
   - 2-3 sentences capturing the essence of all changes
   - Mention key components affected
   - State the overall outcome/benefit

3. **Problem Section**
   - Explain what was broken, missing, or inefficient
   - Describe the impact on the project
   - Provide context for why changes were needed

4. **Solution Section**
   - Explain the approach taken to solve the problem
   - Describe major implementation details
   - Include quantifiable improvements if applicable (file size, performance, etc.)
   - End with "Key changes:" followed by bulleted list of specific modifications

5. **Key Changes Bullets**
   - Start with action verbs (Added, Updated, Migrated, Fixed, Removed, etc.)
   - Be specific about what was changed
   - Group related changes together
   - Order from most to least important

### Example:

```
fix(materials): migrate megascans base material from 5.3 project

## Summary
Migrates Megascans base material system from the UE 5.3 project,
creating a centralized M_MS_Base material with standardized functions
and updating affected material instances across environment maps.

## Problem
Material instances for Megascans 3D assets and various environment maps
were referencing outdated base materials from the UE 5.3 project,
causing compatibility issues and bloated asset sizes. This affected
Public, Street, and Nature environments as well as Japanese-themed
stone architecture assets from Fab Megascans.

## Solution
Created a new M_MS_Base material with standardized material functions
(QMF_AOAdjustments, QMF_BaseColorAdjustments, QMF_NormalAdjustments,
QMF_RoughnessAdjustments) and default texture templates. Updated 18
material instances across School, CoastalVillage, UrbanOverpass,
SuburbanPark environments and Japanese stone asset collections to
reference the new base material, achieving 40-50% file size reduction
while maintaining visual quality.

Key changes:
- Added M_MS_Base centralized base material
- Added 4 quality material functions for parameter adjustments
- Added 4 default texture templates (Color, Normal, Masks, Displacement)
- Updated materials in School, Coastal, Street, and Nature environments
- Migrated Japanese stone wall and embankment Megascans materials
```

## Output

**Automatically determine the appropriate commit type** by analyzing the staged changes:
- New files/features → `feature`
- Bug fixes/corrections → `fix`
- Code restructuring without changing behavior → `refactor`
- Removing files/code → `delete`
- Documentation changes → `docs`
- Maintenance/config → `chore`
- Test files → `test`
- Formatting only → `style`

Provide the commit message in a markdown code block ready to copy-paste. If there are no staged changes, let me know what files are modified but not staged.

Note: If user provides an argument ($ARGUMENTS), use that type instead of auto-detecting.
