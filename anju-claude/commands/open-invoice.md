---
allowed-tools: Bash
description: Open invoice generator web app in browser
---

# Open Invoice Generator

Open the monthly tuition invoice generator web application.

## What it does

Opens the invoice generator web app where you can:
- Select student name from preset list
- Hourly rate and bank info auto-filled from `presets.json`
- Add lesson dates and generate invoice

## Execution

```bash
open ~/.claude/skills/invoice-generator/index.html
```

## Example

```
/open-invoice
→ Opens web app, user selects student name
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
