# Delegation Template

Standard 7-section structure for delegating tasks to Claude or sub-agents.

---

## Why This Structure?

Clear delegation prevents:
- Misunderstood requirements
- Scope creep
- Unauthorized changes
- Incomplete work

Vague prompts produce vague results. Be exhaustive.

---

## The 7-Section Template

```markdown
# [Task Title]

## TASK
[One clear sentence describing what needs to be done]

## EXPECTED OUTCOME
[Specific, measurable result]
- What files will be created/modified?
- What should the output look like?
- How will we know it's done?

## REQUIRED SKILLS
[What knowledge/capabilities are needed]
- Languages: Python, TypeScript, etc.
- Domains: Unreal Engine, Web, etc.
- Patterns: TDD, specific architectures

## REQUIRED TOOLS
[Explicit tool permissions]
- Allowed: Read, Glob, Grep, Bash(git:*)
- Restricted: Edit (specific files only)
- Forbidden: Any destructive operations

## MUST DO
[Non-negotiable requirements - checklist format]
- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## MUST NOT DO
[Explicit prohibitions - what to avoid]
- [ ] Do not modify X
- [ ] Do not commit without review
- [ ] Do not change public APIs

## CONTEXT
[Background information needed]
- Related files: [paths]
- Previous decisions: [references]
- Constraints: [time, scope, dependencies]
- Learnings: [link to relevant project learnings]
```

---

## Examples

### Example: Bug Fix

```markdown
# Fix Asset Loading Race Condition

## TASK
Fix the race condition in texture_loader.py where assets load before dependencies.

## EXPECTED OUTCOME
- texture_loader.py handles dependency ordering
- Existing tests pass
- New test covers the race condition scenario
- No changes to public API

## REQUIRED SKILLS
- Python async/await
- Unreal Engine asset system
- Unit testing with pytest

## REQUIRED TOOLS
- Allowed: Read, Edit(python/texture/**), Bash(pytest:*)
- Forbidden: Edit files outside python/texture/

## MUST DO
- [ ] Write failing test first (TDD)
- [ ] Fix the bug with minimal changes
- [ ] Verify all tests pass
- [ ] Update docstring explaining the fix

## MUST NOT DO
- [ ] Do not change function signatures
- [ ] Do not add new dependencies
- [ ] Do not refactor unrelated code

## CONTEXT
- Bug: User sees "dependency not loaded" error intermittently
- Suspect: Lines 45-67 in texture_loader.py
- Related: asset_registry.py handles dependency resolution
```

### Example: Feature Addition

```markdown
# Add Dark Mode Toggle

## TASK
Add a dark mode toggle to the settings page.

## EXPECTED OUTCOME
- Toggle component in Settings page
- Theme state persists across sessions (localStorage)
- All existing components support both themes
- Tests for toggle behavior and persistence

## REQUIRED SKILLS
- React, TypeScript
- CSS-in-JS or Tailwind
- localStorage API

## REQUIRED TOOLS
- Allowed: Read, Edit(src/components/**, src/styles/**), Bash(npm test:*)
- Forbidden: Edit(src/api/**)

## MUST DO
- [ ] Follow existing component patterns
- [ ] Use design system colors (not hardcoded)
- [ ] Test in both light and dark themes
- [ ] Add Storybook story for toggle

## MUST NOT DO
- [ ] Do not add new npm dependencies
- [ ] Do not modify API layer
- [ ] Do not change existing component prop interfaces

## CONTEXT
- Design reference: [Figma URL]
- Existing theme file: src/styles/theme.ts
- Similar component: src/components/LanguageToggle (follow this pattern)
```

---

## Usage in Commands

When creating a command that delegates work:

```yaml
---
allowed-tools: [as specified in REQUIRED TOOLS]
---

[Paste the delegation template with all 7 sections filled]

Proceed only if all MUST DO items are achievable.
Stop and ask if any MUST NOT DO items would be violated.
```

---

## Verification Checklist

After delegation, verify:
- [ ] Agent completed all MUST DO items
- [ ] Agent avoided all MUST NOT DO items
- [ ] EXPECTED OUTCOME was achieved
- [ ] No unexpected side effects

**Trust but verify** - always check the actual results.

---

## 한국어 섹션명 (Korean)

| English | Korean |
|---------|--------|
| TASK | 작업 |
| EXPECTED OUTCOME | 기대 결과 |
| REQUIRED SKILLS | 필요 역량 |
| REQUIRED TOOLS | 필요 도구 |
| MUST DO | 필수 사항 |
| MUST NOT DO | 금지 사항 |
| CONTEXT | 배경 |
