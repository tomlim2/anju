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

## Usage

Command: `/open-invoice`

```bash
/open-invoice
```

**Workflow:**
1. Opens web app with empty form
2. Enter student name, hourly rate, and bank information
3. Add lesson dates and hours
4. Click "PDF로 저장"
5. **✨ Auto-copies to clipboard**: `/move-invoice <student_name>`
6. Alert: "명령이 클립보드에 복사되었습니다"
7. Paste (`Cmd+V`) in Claude Code
8. PDF automatically moved to `private/tutoring/invoices/`

**Features:**
- Manual form entry for full control
- Visual editing and preview
- Multiple lesson dates tracking
- Clipboard automation for easy archival
- Invoice numbering system (YYYYMM-XXXX)

## File Locations
- **Generated PDFs**: Downloads folder (move to `private/tutoring/invoices/` for archival)

## Future Enhancements

- Automatic monthly invoice generation (cron job)
- Email integration (SMTP)
- Invoice history viewer/manager
