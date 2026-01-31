---
allowed-tools: Read, Glob, Grep, Edit
description: 디자인 시스템 버전 확인 및 작업물 동기화
argument-hint: "[version or file path]"
---

# Design System Sync

GUI/UI 작업물과 디자인 시스템 버전을 동기화합니다.

## Current Design System

!`head -5 ~/.claude/standards/design-system.md 2>/dev/null || head -5 ~/Desktop/www/anju/anju-claude/standards/design-system.md`

## Task

### 0. First GUI Work - Auto Version Stamp

**첫 GUI/UI 작업 시 필수:**

1. **Read** 디자인 시스템 전체 내용
2. **Add** 파일 상단에 버전 주석 추가:

```tsx
// Design System: v1.0.0
```

```css
/* Design System: v1.0.0 */
```

```python
# Design System: v1.0.0
```

```cpp
// Design System: v1.0.0
```

**위치**: 파일 최상단 (import/include 위 또는 바로 아래)

### 1. Version Check

디자인 시스템 버전 확인:
- 파일: `standards/design-system.md`
- 현재 버전과 Changelog 확인
- 작업 파일의 버전 주석과 비교

### 2. Compare with Work

$ARGUMENTS가 제공된 경우:
- **버전 번호** (예: `1.0.0`): 해당 버전과 현재 버전 비교
- **파일 경로** (예: `src/components/Button.tsx`): 해당 파일의 스타일이 디자인 시스템과 일치하는지 검사

### 3. Sync Actions

버전이 다르거나 불일치 발견 시:

1. **Read** 최신 디자인 시스템 전체 내용
2. **Grep** 작업 파일에서 스타일 관련 코드 검색:
   - 색상값 (`#000`, `#fff`, `rgb(`, `rgba(`)
   - 간격값 (`padding`, `margin`, `gap`)
   - 보더 (`border`, `border-radius`)
   - 폰트 (`font-size`, `font-weight`, `font-family`)
3. **비교** 디자인 시스템 토큰과 실제 사용값
4. **Update** 버전 주석을 최신 버전으로 업데이트
5. **Report** 불일치 항목 리스트

### 4. Output Format

```
## Design System Sync Report

**Design System Version**: X.X.X
**Last Updated**: YYYY-MM-DD
**File Version**: X.X.X → X.X.X (updated)

### Checked Files
- file1.tsx (v1.0.0 → v1.1.0)
- file2.css (NEW - v1.1.0 added)

### Mismatches Found
| File | Line | Issue | Expected | Actual |
|------|------|-------|----------|--------|
| ... | ... | ... | ... | ... |

### Recommendations
- [ ] Fix item 1
- [ ] Fix item 2
```

## Rules

- **Read-first**: 수정 전 항상 디자인 시스템 최신 버전 읽기
- **Version stamp**: 첫 GUI 작업 시 반드시 버전 주석 추가
- **Auto-update**: 버전 불일치 시 주석 자동 업데이트
- **Report changes**: 변경된 토큰/규칙 리포트

## Version Detection

파일에서 버전 주석 검색:
```
Design System: v
```

버전 없으면 → 첫 작업으로 간주, 버전 추가
버전 있으면 → 현재 디자인 시스템 버전과 비교
