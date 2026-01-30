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
- `presets.json.example` - Template for student presets
- `../../private/tutoring/presets.json` - Actual student data (gitignored)

## Usage

### Web Interface

Command: `/open-invoice`

```bash
/open-invoice
```

**Workflow:**
1. Opens web app with empty form
2. **Select student** from dropdown (loaded from presets.json)
3. Hourly rate and bank info **auto-filled** when student is selected
4. Add lesson dates and hours
5. Click "PDF로 저장"
6. **✨ Auto-copies to clipboard**: `/move-invoice 학생1`
7. Alert: "명령이 클립보드에 복사되었습니다"
8. Paste (`Cmd+V`) in Claude Code
9. PDF automatically moved to `private/tutoring/invoices/`

**Features:**
- Student selection dropdown
- Auto-fill hourly rate on selection
- Visual editing and preview
- Multiple lesson dates tracking
- Clipboard automation for easy archival

## Configuration

### Setup
1. Copy `presets.json.example` to `~/.claude/private/tutoring/presets.json`
2. Edit with your actual student and bank information
3. Use `/open-invoice <student_name>` to generate invoices

### File Locations
- **Student data**: `~/.claude/private/tutoring/presets.json` (gitignored)
- **Generated PDFs**: Downloads folder (move to `private/tutoring/invoices/` for archival)

## Future Enhancements

- Automatic monthly invoice generation (cron job)
- Email integration (SMTP)
- Invoice history viewer/manager
