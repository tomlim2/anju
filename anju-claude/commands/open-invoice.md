---
allowed-tools: Bash
description: Open invoice generator web app in browser
argument-hint: "<student_name>"
---

# Open Invoice Generator

Open the monthly tuition invoice generator web application with student-specific preset values.

## Arguments

User provides: $ARGUMENTS (student name)

## What it does

Opens the invoice generator with the specified student's information:
- Automatically fills student name
- Loads hourly rate from `presets.json`
- Pre-fills bank information
- Ready to add lesson dates and generate invoice

## Execution

**Step 1: Validate student exists in presets**

```bash
STUDENT_NAME="$ARGUMENTS"

# If no student name, open without preset
if [ -z "$STUDENT_NAME" ]; then
  open ~/.claude/skills/invoice-generator/index.html
  exit 0
fi

# Check if student exists in presets.json
PRESETS_FILE=~/.claude/private/tutoring/presets.json

if [ ! -f "$PRESETS_FILE" ]; then
  echo "⚠️  경고: presets.json을 찾을 수 없습니다."
  echo "위치: $PRESETS_FILE"
  exit 1
fi

# Check if student exists (using grep/python)
if ! grep -q "\"$STUDENT_NAME\"" "$PRESETS_FILE"; then
  echo "❌ 에러: '$STUDENT_NAME' 학생을 presets.json에서 찾을 수 없습니다."
  echo ""
  echo "등록된 학생:"
  grep -o '"[^"]*":' "$PRESETS_FILE" | grep -v "default_teacher\|hourly_rate\|default_lessons" | tr -d ':"'
  exit 1
fi

# Student exists, open with preset
open "file://$HOME/.claude/skills/invoice-generator/index.html?student=$STUDENT_NAME"
```

## Examples

```
/open-invoice 학생1
→ Opens with student "학생1", hourly rate 150,000원

/open-invoice 김철수
→ Opens with student "김철수", uses default rate if not in presets
```

## Adding New Students

Edit `~/.claude/private/tutoring/presets.json`:
```json
{
  "default_teacher": {
    "bank": "XX은행",
    "account": "123456789012",
    "account_holder": "홍길동"
  },
  "students": {
    "학생1": {
      "hourly_rate": 150000,
      "default_lessons_per_month": 2
    },
    "김철수": {
      "hourly_rate": 200000,
      "default_lessons_per_month": 4
    }
  }
}
```

**Note**: This file is in `private/` folder and gitignored. See `presets.json.example` for template.

## Output

PDF files are saved to your Downloads folder with auto-generated invoice numbers (YYYYMM-XXXX format).
