#!/usr/bin/env python3
"""
Invoice PDF Generator CLI
Generates tuition invoices as PDF and saves to private/tutoring/invoices/
"""

import argparse
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict

def load_presets():
    """Load student presets from private folder"""
    preset_path = Path.home() / ".claude" / "private" / "tutoring" / "presets.json"

    if not preset_path.exists():
        raise FileNotFoundError(
            f"Presets file not found: {preset_path}\n"
            "Please copy presets.json.example to ~/.claude/private/tutoring/presets.json"
        )

    with open(preset_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def generate_html(student_name: str, month: str, lessons: List[Dict],
                  hourly_rate: int, teacher_info: Dict) -> str:
    """Generate HTML invoice"""

    # Calculate totals
    total_hours = sum(lesson['hours'] for lesson in lessons)
    total_amount = int(total_hours * hourly_rate)

    # Generate invoice number
    invoice_number = f"{month.replace('-', '')}-{datetime.now().strftime('%H%M%S')}"

    # Build lesson table rows
    lesson_rows = ""
    for lesson in lessons:
        lesson_rows += f"""
        <tr>
            <td>{lesson['date']}</td>
            <td>{lesson['hours']}시간</td>
            <td>{lesson.get('note', '')}</td>
        </tr>
        """

    html = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <title>수업료 청구서 - {student_name}</title>
        <style>
            @page {{ size: A4; margin: 2cm; }}
            body {{
                font-family: 'Malgun Gothic', sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }}
            h1 {{ margin: 0; font-size: 28px; }}
            .invoice-number {{
                text-align: right;
                color: #666;
                font-size: 14px;
                margin-bottom: 10px;
            }}
            .student-name {{
                font-size: 18px;
                margin: 20px 0;
            }}
            .highlight-section {{
                background: #f5f5f5;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
            }}
            .total-amount {{
                font-size: 24px;
                color: #2c3e50;
                font-weight: bold;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }}
            th, td {{
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
            }}
            th {{
                background: #f5f5f5;
                font-weight: bold;
            }}
            .calculation {{
                background: #fff9e6;
                padding: 15px;
                border-left: 4px solid #ffc107;
                margin: 10px 0;
            }}
            .footer {{
                text-align: center;
                margin-top: 40px;
                color: #666;
                font-size: 14px;
            }}
            section {{
                margin: 30px 0;
            }}
            section h3 {{
                border-bottom: 1px solid #ddd;
                padding-bottom: 10px;
            }}
        </style>
    </head>
    <body>
        <div class="invoice-number">청구서 번호: {invoice_number}</div>

        <div class="header">
            <h1>{month[:4]}년 {int(month[5:7])}월 수업료 청구서</h1>
        </div>

        <p class="student-name">학생 이름: <strong>{student_name}</strong></p>

        <section class="highlight-section">
            <h3>최종 청구액</h3>
            <p class="total-amount">총 청구 금액: {total_amount:,}원</p>
        </section>

        <section>
            <h3>입금 정보</h3>
            <p>은행: {teacher_info.get('bank', '')}</p>
            <p>계좌번호: {teacher_info.get('account', '')}</p>
            <p>예금주: {teacher_info.get('account_holder', '')}</p>
        </section>

        <hr>

        <section>
            <h3>수업 기간 및 시간</h3>
            <p>시간당 수업료: {hourly_rate:,}원</p>
            <table>
                <thead>
                    <tr>
                        <th>날짜</th>
                        <th>수업 시간</th>
                        <th>비고</th>
                    </tr>
                </thead>
                <tbody>
                    {lesson_rows}
                </tbody>
            </table>
        </section>

        <section>
            <h3>수업료 계산 내역</h3>
            <p>총 수업 시간: {total_hours}시간</p>
            <p>시간당 수업료: {hourly_rate:,}원</p>
            <div class="calculation">
                <p><strong>[계산식]</strong></p>
                <p>{total_hours}시간 × {hourly_rate:,}원 = {total_amount:,}원</p>
            </div>
        </section>

        <hr>
        <p class="footer">문의사항 있으시면 언제든지 연락 부탁드립니다. 감사합니다.</p>
    </body>
    </html>
    """

    return html


def save_pdf(html: str, student_name: str, month: str) -> Path:
    """Save HTML as PDF using weasyprint"""
    try:
        from weasyprint import HTML
    except ImportError:
        raise ImportError(
            "weasyprint is required for PDF generation.\n"
            "Install with: pip install weasyprint"
        )

    # Output path
    output_dir = Path.home() / ".claude" / "private" / "tutoring" / "invoices"
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{month}_{student_name}.pdf"
    output_path = output_dir / filename

    # Generate PDF
    HTML(string=html).write_pdf(output_path)

    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Generate tuition invoice PDF - Student name only",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example:
  %(prog)s 학생1

Automatically uses:
- Current month (YYYY-MM)
- default_lessons_per_month from presets.json
- hourly_rate from presets.json
        """
    )

    parser.add_argument("student", help="Student name (required)")
    parser.add_argument("month", nargs='?', help="Month (YYYY-MM, optional, defaults to current month)")
    parser.add_argument("--rate", type=int,
                       help="Override hourly rate (defaults to preset)")

    args = parser.parse_args()

    # Validate student name
    if not args.student:
        print("❌ 에러: 학생 이름이 반드시 필요합니다.")
        print("사용법: /generate-invoice <학생이름>")
        return 1

    # Load presets
    presets = load_presets()

    # Get student info
    student_name = args.student
    students = presets.get("students", {})
    student_preset = students.get(student_name, {})

    if not student_preset:
        print(f"⚠️  경고: '{student_name}' 학생이 presets.json에 없습니다.")
        print(f"기본값을 사용합니다.")

    # Get month (current month if not provided)
    month = args.month or datetime.now().strftime("%Y-%m")

    # Get lesson hours from preset
    lesson_hours = student_preset.get("default_lessons_per_month", 2)
    hourly_rate = args.rate or student_preset.get("hourly_rate", 150000)
    teacher_info = presets.get("default_teacher", {})

    # Create single lesson entry
    lessons = [{
        "date": f"{month} (총합)",
        "hours": lesson_hours,
        "note": ""
    }]

    # Generate HTML
    html = generate_html(student_name, month, lessons, hourly_rate, teacher_info)

    # Save PDF
    output_path = save_pdf(html, student_name, month)

    # Summary
    total_hours = sum(l['hours'] for l in lessons)
    total_amount = int(total_hours * hourly_rate)

    print(f"✅ Invoice generated successfully!")
    print(f"   Student: {student_name}")
    print(f"   Month: {month}")
    print(f"   Total hours: {total_hours}")
    print(f"   Amount: {total_amount:,}원")
    print(f"   Saved to: {output_path}")

    return 0


if __name__ == "__main__":
    exit(main())
