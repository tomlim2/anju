# invoice-generator

Web-based monthly tuition invoice generator with automatic calculation and PDF export.

## Overview

A complete invoice generation system for monthly lesson billing. Features include:
- Dynamic lesson entry (date, hours, minutes)
- Automatic total calculation
- Bank account information
- PDF export via html2canvas + jsPDF
- Invoice numbering system (YYYYMM-XXXX)

## Files

- `index.html` - Main web interface with form and invoice preview
- `script.js` - Invoice generation logic and PDF export
- `style.css` - Styling
- `generate_invoice_pdf.py` - Python CLI for automated PDF generation
- `requirements.txt` - Python dependencies (weasyprint)
- `presets.json.example` - Template for student presets
- `../../private/tutoring/presets.json` - Actual student data (gitignored)

## Usage

### Method 1: Python CLI (Automated) ⭐ Recommended for recurring invoices

Command: `/generate-invoice`

```bash
# Super simple - just student name
/generate-invoice 학생1
```

**What it does:**
- Automatically uses current month (2026-01)
- Reads `default_lessons_per_month` from presets.json (e.g., 2 hours)
- Calculates: 2 hours × 150,000원 = 300,000원
- Saves to `private/tutoring/invoices/2026-01_학생1.pdf`

**Advantages:**
- **Fastest method** - 1 command, no manual input
- Automatic save to `private/tutoring/invoices/`
- Perfect for monthly recurring invoices
- Command-line friendly

**Requirements:**
```bash
pip install weasyprint
```

### Method 2: Web Interface (Visual editing)

Command: `/open-invoice <student_name>`

Open in browser for complex invoices:
```bash
/open-invoice 학생1
```

**Workflow:**
1. Validates student exists in presets.json
2. Opens web app with auto-filled:
   - Student name
   - Hourly rate from presets
   - Bank information
3. Add lesson dates and hours
4. Click "PDF로 저장"
5. **✨ Auto-copies to clipboard**: `/move-invoice 학생1`
6. Alert: "명령이 클립보드에 복사되었습니다"
7. Paste (`Cmd+V`) in Claude Code
8. PDF automatically moved to `private/tutoring/invoices/`

**Advantages:**
- Visual editing and preview
- Multiple lesson dates tracking
- Auto-clipboard for easy archival

### Default Values
- Student: 석민이
- Hourly rate: 150,000원
- Bank: XX은행
- Account: 123456789012
- Account holder: 홍길동

## Configuration

### Setup
1. Copy `presets.json.example` to `~/.claude/private/tutoring/presets.json`
2. Edit with your actual student and bank information
3. Use `/open-invoice <student_name>` to generate invoices

### File Locations
- **Student data**: `~/.claude/private/tutoring/presets.json` (gitignored)
- **Generated PDFs**: Downloads folder (move to `private/tutoring/invoices/` for archival)

## Choosing the Right Method

| Use Case | Method |
|----------|--------|
| **Monthly recurring invoice** (same hours every month) | **Python CLI** (`/generate-invoice 학생1`) |
| Need to see/edit lesson dates | Web Interface (`/open-invoice`) |
| Variable hours each month | Web Interface |
| Preview before saving | Web Interface |
| Batch processing multiple students | Python CLI (scriptable) |

## Future Enhancements

- ✅ Python CLI for automation (DONE)
- Automatic monthly invoice generation (cron job)
- Email integration (SMTP)
- Invoice history viewer/manager
