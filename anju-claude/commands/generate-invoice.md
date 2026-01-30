---
allowed-tools: Bash(python:*)
description: Generate invoice PDF automatically (saves to private/tutoring/invoices)
argument-hint: "<student_name>"
---

# Generate Invoice PDF

Automatically generate a tuition invoice PDF and save to `~/.claude/private/tutoring/invoices/`.

**Super simple**: Just provide the student name. Everything else is automatic.

## Arguments

User provides: $ARGUMENTS (student name only)

If no student name provided, show error: "학생 이름이 반드시 필요합니다."

## What it does

1. Automatically detects current month (YYYY-MM)
2. Reads student info from `~/.claude/private/tutoring/presets.json`:
   - `hourly_rate` - 시간당 수업료
   - `default_lessons_per_month` - 월 수업 시간
3. Generates HTML invoice
4. Converts to PDF using weasyprint
5. Saves to `~/.claude/private/tutoring/invoices/YYYY-MM_StudentName.pdf`

## Prerequisites

Install weasyprint (first time only):
```bash
pip install weasyprint
```

## Execution

First, validate that a student name is provided:

```bash
if [ -z "$ARGUMENTS" ]; then
  echo "❌ 에러: 학생 이름이 반드시 필요합니다."
  echo "사용법: /generate-invoice <학생이름>"
  exit 1
fi

python ~/.claude/skills/invoice-generator/generate_invoice_pdf.py $ARGUMENTS
```

## Examples

**Basic usage:**
```
/generate-invoice 학생1
→ Automatically uses current month (2026-01)
→ Reads default_lessons_per_month from presets (e.g., 2 hours)
→ Generates: private/tutoring/invoices/2026-01_학생1.pdf
→ Amount: 2 hours × 150,000원 = 300,000원
```

**No student name:**
```
/generate-invoice
→ ❌ Error: "학생 이름이 반드시 필요합니다."
```

**Student not in presets:**
```
/generate-invoice 김철수
→ ⚠️ Warning: '김철수' not in presets, using defaults
→ Generates PDF with default hourly rate
```

## Output

The script reports:
- Student name
- Month
- Total hours
- Total amount
- File location

PDF is automatically saved to `~/.claude/private/tutoring/invoices/` (gitignored).

## When to use

- ✅ **Monthly recurring invoices** (학생별 월 고정 수업료)
- ✅ Fast generation (1 command)
- ✅ Automatic current month
- ✅ Batch processing multiple students

Use `/open-invoice` instead for:
- ❌ Need to see/edit lesson dates
- ❌ Variable hours each month
- ❌ Want to preview before saving
