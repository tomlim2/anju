// Load student list from presets.json
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('presets.json');
        const presets = await response.json();

        // Populate student dropdown
        const studentSelect = document.getElementById('studentName');
        if (presets.students) {
            Object.keys(presets.students).forEach(studentName => {
                const option = document.createElement('option');
                option.value = studentName;
                option.textContent = studentName;
                studentSelect.appendChild(option);
            });
        }

        // Load default teacher info
        if (presets.default_teacher) {
            const teacher = presets.default_teacher;
            if (teacher.bank) document.getElementById('bankName').value = teacher.bank;
            if (teacher.account) document.getElementById('accountNumber').value = teacher.account;
            if (teacher.account_holder) document.getElementById('accountHolder').value = teacher.account_holder;
        }

        // Store presets for later use
        window.presets = presets;
    } catch (error) {
        console.error('Failed to load presets:', error);
        alert('presets.json을 불러오는데 실패했습니다.');
    }
});

// Auto-fill hourly rate when student is selected
document.addEventListener('DOMContentLoaded', () => {
    const studentSelect = document.getElementById('studentName');
    studentSelect.addEventListener('change', (e) => {
        const studentName = e.target.value;
        if (studentName && window.presets && window.presets.students[studentName]) {
            const studentPreset = window.presets.students[studentName];
            if (studentPreset.hourly_rate) {
                document.getElementById('hourlyRate').value = studentPreset.hourly_rate;
            }
        }
    });
});

// Add new class entry
document.getElementById('addEntry').addEventListener('click', () => {
    const container = document.getElementById('classEntries');
    const newEntry = document.createElement('div');
    newEntry.className = 'class-entry';
    newEntry.innerHTML = `
        <input type="date" class="class-date" required>
        <input type="number" class="class-hours" placeholder="시간" step="0.5" required>
        <input type="number" class="class-minutes" placeholder="분" step="15" value="0">
        <input type="text" class="class-note" placeholder="비고">
        <button type="button" class="remove-btn" onclick="removeEntry(this)">삭제</button>
    `;
    container.appendChild(newEntry);
});

// Remove class entry
function removeEntry(button) {
    const entries = document.querySelectorAll('.class-entry');
    if (entries.length > 1) {
        button.parentElement.remove();
    } else {
        alert('최소 1개의 수업 내역이 필요합니다.');
    }
}

// Format date to Korean format
function formatDate(dateString) {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
}

// Format time display
function formatTime(hours, minutes) {
    let result = '';
    if (hours > 0) {
        result += `${hours}시간`;
        if (minutes > 0) {
            result += ` ${minutes}분`;
        }
    } else {
        result = `${minutes}분`;
    }

    const totalHours = hours + minutes / 60;
    if (totalHours !== hours) {
        result += ` (${totalHours}시간)`;
    }

    return result;
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Generate invoice number (format: YYYYMM-XXXX)
function generateInvoiceNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `${year}${month}-${random}`;
}

// Generate invoice
document.getElementById('invoiceForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const studentName = document.getElementById('studentName').value;
    const hourlyRate = parseInt(document.getElementById('hourlyRate').value);
    const bankName = document.getElementById('bankName').value;
    const accountNumber = document.getElementById('accountNumber').value;
    const accountHolder = document.getElementById('accountHolder').value;

    const classEntries = document.querySelectorAll('.class-entry');
    const classes = [];
    let totalHours = 0;

    classEntries.forEach(entry => {
        const date = entry.querySelector('.class-date').value;
        const hours = parseFloat(entry.querySelector('.class-hours').value) || 0;
        const minutes = parseFloat(entry.querySelector('.class-minutes').value) || 0;
        const note = entry.querySelector('.class-note').value;

        if (date) {
            classes.push({ date, hours, minutes, note });
            totalHours += hours + (minutes / 60);
        }
    });

    // Sort classes by date
    classes.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Determine month from first class date
    const month = classes.length > 0 ? new Date(classes[0].date).getMonth() + 1 : new Date().getMonth() + 1;

    // Update invoice title
    document.getElementById('invoiceTitle').textContent = `${month}월 수업료 청구`;
    document.getElementById('studentNameDisplay').textContent = studentName;

    // Generate and display invoice number
    const invoiceNumber = generateInvoiceNumber();
    document.getElementById('invoiceNumber').textContent = invoiceNumber;

    // Update hourly rate
    document.getElementById('displayRate').textContent = formatNumber(hourlyRate);
    document.getElementById('calcRate').textContent = formatNumber(hourlyRate);

    // Update class table
    const tableBody = document.getElementById('classTable');
    tableBody.innerHTML = '';

    classes.forEach(cls => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(cls.date)}</td>
            <td>${formatTime(cls.hours, cls.minutes)}</td>
            <td>${cls.note || ''}</td>
        `;
        tableBody.appendChild(row);
    });

    // Add total row
    const totalRow = document.createElement('tr');
    const totalMinutes = Math.round((totalHours % 1) * 60);
    const totalWholeHours = Math.floor(totalHours);
    totalRow.innerHTML = `
        <td><strong>총계</strong></td>
        <td><strong>${formatTime(totalWholeHours, totalMinutes)}</strong></td>
        <td></td>
    `;
    tableBody.appendChild(totalRow);

    // Update calculation
    document.getElementById('totalHours').textContent = totalHours.toFixed(1);

    const totalAmount = Math.round(totalHours * hourlyRate);
    document.getElementById('formula').textContent = `${totalHours.toFixed(1)}시간 × ${formatNumber(hourlyRate)}원 = ${formatNumber(totalAmount)}원`;
    document.getElementById('totalAmount').textContent = formatNumber(totalAmount);

    // Update bank info
    document.getElementById('displayBank').textContent = bankName;
    document.getElementById('displayAccount').textContent = accountNumber;
    document.getElementById('displayHolder').textContent = accountHolder;

    // Show invoice preview
    document.querySelector('.form-section').style.display = 'none';
    document.getElementById('invoicePreview').style.display = 'block';

    // Store data for PDF filename
    window.invoiceData = {
        studentName,
        month
    };
});

// Edit invoice
document.getElementById('editInvoice').addEventListener('click', () => {
    document.querySelector('.form-section').style.display = 'block';
    document.getElementById('invoicePreview').style.display = 'none';
});

// Download PDF
document.getElementById('downloadPDF').addEventListener('click', async () => {
    const element = document.getElementById('invoice');
    const data = window.invoiceData || { studentName: '수강생', month: new Date().getMonth() + 1 };
    const filename = `${data.studentName}_${data.month}월_수업료청구서.pdf`;

    // Hide buttons temporarily
    const downloadBtn = document.getElementById('downloadPDF');
    const editBtn = document.getElementById('editInvoice');
    downloadBtn.style.display = 'none';
    editBtn.style.display = 'none';

    try {
        // Generate canvas from HTML
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        // A4 dimensions in mm
        const a4Width = 210;
        const a4Height = 297;

        // Calculate dimensions
        const imgWidth = a4Width;
        const imgHeight = (canvas.height * a4Width) / canvas.width;

        // Create PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);

        // If content fits in one page
        if (imgHeight <= a4Height) {
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        } else {
            // Split into multiple pages
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= a4Height;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= a4Height;
            }
        }

        // Save PDF
        pdf.save(filename);

        // Copy move command to clipboard
        const studentName = data.studentName;
        const moveCommand = `/move-invoice ${studentName}`;

        try {
            await navigator.clipboard.writeText(moveCommand);
            alert(`✅ PDF 저장 완료!\n\n명령이 클립보드에 복사되었습니다:\n${moveCommand}\n\nClaude Code에 붙여넣기하세요.`);
        } catch (clipboardError) {
            // Fallback if clipboard fails
            console.error('클립보드 복사 실패:', clipboardError);
            alert(`✅ PDF 저장 완료!\n\n다음 명령을 실행하세요:\n${moveCommand}`);
        }
    } catch (error) {
        console.error('PDF 생성 중 오류:', error);
        alert('PDF 생성에 실패했습니다.');
    } finally {
        // Show buttons again
        downloadBtn.style.display = 'block';
        editBtn.style.display = 'block';
    }
});
