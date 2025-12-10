const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF for Expense Claim Form (FM-FI-014)
 */
const generateExpenseClaimPDF = (claim, items, approvals, callback) => {
    try {
        console.log('🔍 PDF Generation - Expense Claim Form');
        console.log('🔍 Claim ID:', claim.id);

        const doc = new PDFDocument({
            margin: 30,
            size: 'A4'
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            callback(null, pdfBuffer);
        });
        doc.on('error', (err) => {
            callback(err, null);
        });

        let currentY = 30;

        // ===== HEADER SECTION =====
        // Top row with Date and Form Title
        doc.fontSize(9).font('Helvetica').text('DATE:', 40, currentY);
        doc.fontSize(9).font('Helvetica').text(new Date(claim.created_at).toLocaleDateString('en-GB'), 100, currentY);

        doc.fontSize(14).font('Helvetica-Bold').text('EXPENSE CLAIM DOCUMENT', 200, currentY, { width: 200, align: 'center' });

        // Add logo
        try {
            const logoPath = path.join(__dirname, '../assets/logo.png');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 480, currentY - 5, { width: 80, height: 40 });
            }
        } catch (err) {
            doc.fontSize(10).font('Helvetica-Bold').text('KSB', 500, currentY);
        }

        currentY += 25;
        doc.fontSize(10).font('Helvetica').text('FM-FI-014', 260, currentY, { align: 'center' });

        currentY += 20;

        // Request info row
        doc.fontSize(8).font('Helvetica').text('REQUESTED BY:', 40, currentY);
        doc.fontSize(8).font('Helvetica').text(claim.initiator_name, 130, currentY);

        currentY += 12;
        doc.fontSize(8).font('Helvetica').text('AUTHORISED BY:', 40, currentY);

        currentY += 12;
        doc.fontSize(8).font('Helvetica').text('DEPARTMENT:', 40, currentY);
        doc.fontSize(8).font('Helvetica').text(claim.department, 130, currentY);

        currentY += 20;

        // Employee details box
        doc.rect(40, currentY, 520, 60).stroke();

        currentY += 10;
        doc.fontSize(9).font('Helvetica-Bold').text('EMPLOYEE:', 50, currentY);
        doc.fontSize(9).font('Helvetica').text(claim.employee_name, 160, currentY);
        doc.fontSize(9).font('Helvetica-Bold').text('EMPLOYEE NUMBER:', 350, currentY);
        doc.fontSize(9).font('Helvetica').text(claim.employee_number, 460, currentY);

        currentY += 15;
        doc.fontSize(9).font('Helvetica-Bold').text('DEPARTMENT:', 50, currentY);
        doc.fontSize(9).font('Helvetica').text(claim.department, 160, currentY);

        currentY += 15;
        doc.fontSize(9).font('Helvetica-Bold').text('REASON FOR TRIP:', 50, currentY);
        doc.fontSize(9).font('Helvetica').text(claim.reason_for_trip, 160, currentY, { width: 380 });

        currentY += 25;

        // ===== EXPENSE ITEMS TABLE =====
        const tableTop = currentY;
        const colWidths = {
            no: 30,
            date: 60,
            details: 120,
            km: 30,
            breakfast: 15,
            lunch: 15,
            dinner: 15,
            meals: 40,
            accom: 50,
            sundries: 50,
            total: 55
        };

        // Table header
        doc.fontSize(7).font('Helvetica-Bold');
        let xPos = 40;

        doc.rect(40, currentY, 520, 30).stroke();
        currentY += 5;

        doc.text('REPORT', xPos + 2, currentY, { width: colWidths.no });
        xPos += colWidths.no;
        doc.text('DATE', xPos, currentY, { width: colWidths.date });
        xPos += colWidths.date;
        doc.text('DETAILS', xPos, currentY, { width: colWidths.details });
        xPos += colWidths.details;
        doc.text('KM', xPos, currentY, { width: colWidths.km });
        xPos += colWidths.km;

        currentY += 8;
        xPos = 40 + colWidths.no + colWidths.date + colWidths.details + colWidths.km;
        doc.text('DAILY RATE:', xPos, currentY);
        xPos += 60;
        doc.text('MEALS', xPos + 5, currentY);
        xPos += colWidths.meals;
        doc.text('ACCOM.', xPos, currentY);
        xPos += colWidths.accom;
        doc.text('SUNDRIES/', xPos, currentY);

        currentY += 8;
        xPos = 40 + colWidths.no + colWidths.date + colWidths.details + colWidths.km;
        doc.text('B', xPos + 2, currentY, { width: colWidths.breakfast });
        xPos += colWidths.breakfast;
        doc.text('L', xPos + 2, currentY, { width: colWidths.lunch });
        xPos += colWidths.lunch;
        doc.text('D', xPos + 2, currentY, { width: colWidths.dinner });
        xPos += colWidths.dinner + 40;
        xPos += colWidths.accom;
        doc.text('PHONE', xPos, currentY - 8);
        xPos = 40 + colWidths.no + colWidths.date + colWidths.details + colWidths.km + 15 + 15 + 15 + colWidths.meals + colWidths.accom + colWidths.sundries;
        doc.text('TOTAL ZMW', xPos, currentY - 8);

        currentY += 12;

        // Table rows
        doc.fontSize(8).font('Helvetica');
        items.forEach((item, index) => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }

            const rowHeight = 20;
            doc.rect(40, currentY, 520, rowHeight).stroke();

            xPos = 40;
            doc.text(item.report_no || (index + 1), xPos + 5, currentY + 5, { width: colWidths.no - 5 });
            xPos += colWidths.no;
            doc.text(new Date(item.date).toLocaleDateString('en-GB'), xPos + 2, currentY + 5, { width: colWidths.date - 2 });
            xPos += colWidths.date;
            doc.text(item.details || '', xPos + 2, currentY + 5, { width: colWidths.details - 2 });
            xPos += colWidths.details;
            doc.text((item.km || 0).toString(), xPos + 2, currentY + 5, { width: colWidths.km - 2, align: 'right' });
            xPos += colWidths.km;
            doc.text(item.breakfast ? '✓' : '', xPos + 5, currentY + 5, { width: colWidths.breakfast - 2, align: 'center' });
            xPos += colWidths.breakfast;
            doc.text(item.lunch ? '✓' : '', xPos + 5, currentY + 5, { width: colWidths.lunch - 2, align: 'center' });
            xPos += colWidths.lunch;
            doc.text(item.dinner ? '✓' : '', xPos + 5, currentY + 5, { width: colWidths.dinner - 2, align: 'center' });
            xPos += colWidths.dinner;
            doc.text((item.meals || 0).toFixed(2), xPos + 2, currentY + 5, { width: colWidths.meals - 2, align: 'right' });
            xPos += colWidths.meals;
            doc.text((item.accommodation || 0).toFixed(2), xPos + 2, currentY + 5, { width: colWidths.accom - 2, align: 'right' });
            xPos += colWidths.accom;
            doc.text((item.sundries_phone || 0).toFixed(2), xPos + 2, currentY + 5, { width: colWidths.sundries - 2, align: 'right' });
            xPos += colWidths.sundries;
            doc.text((item.total_zmw || 0).toFixed(2), xPos + 2, currentY + 5, { width: colWidths.total - 2, align: 'right' });

            currentY += rowHeight;
        });

        // Add empty rows if needed
        const totalRows = 12;
        const filledRows = items.length;
        for (let i = filledRows; i < totalRows; i++) {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }
            doc.rect(40, currentY, 520, 20).stroke();
            currentY += 20;
        }

        currentY += 10;

        // ===== TOTALS SECTION =====
        doc.fontSize(9).font('Helvetica-Bold');

        // Kilometers section
        doc.text('Total km:', 40, currentY);
        doc.text((claim.total_kilometers || 0).toFixed(2), 120, currentY);
        doc.text('@ RATE', 200, currentY);
        doc.rect(250, currentY - 2, 80, 15).stroke();
        doc.text((claim.km_rate || 0).toFixed(2), 255, currentY);

        xPos = 360;
        doc.rect(xPos, currentY - 2, 100, 15).stroke();
        doc.text('SUB TOTAL', xPos + 5, currentY);
        doc.rect(xPos + 100, currentY - 2, 100, 15).stroke();
        doc.text((claim.sub_total || 0).toFixed(2), xPos + 105, currentY, { width: 90, align: 'right' });

        currentY += 20;
        xPos = 360;
        doc.rect(xPos, currentY - 2, 100, 15).stroke();
        doc.text('TOTAL TRAVEL', xPos + 5, currentY);
        doc.rect(xPos + 100, currentY - 2, 100, 15).stroke();
        doc.text((claim.total_travel || 0).toFixed(2), xPos + 105, currentY, { width: 90, align: 'right' });

        currentY += 20;
        xPos = 360;
        doc.rect(xPos, currentY - 2, 100, 15).stroke();
        doc.text('TOTAL CLAIM', xPos + 5, currentY);
        doc.rect(xPos + 100, currentY - 2, 100, 15).stroke();
        doc.text((claim.total_claim || 0).toFixed(2), xPos + 105, currentY, { width: 90, align: 'right' });

        currentY += 20;
        xPos = 360;
        doc.rect(xPos, currentY - 2, 100, 15).stroke();
        doc.text('LESS AMOUNT ADVANCED', xPos + 5, currentY - 5, { width: 95 });
        doc.rect(xPos + 100, currentY - 2, 100, 15).stroke();
        doc.text((claim.amount_advanced || 0).toFixed(2), xPos + 105, currentY, { width: 90, align: 'right' });

        currentY += 20;
        xPos = 360;
        doc.rect(xPos, currentY - 2, 100, 15).stroke();
        doc.text('AMOUNT DUE ZMW', xPos + 5, currentY);
        doc.rect(xPos + 100, currentY - 2, 100, 15).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text((claim.amount_due || 0).toFixed(2), xPos + 105, currentY, { width: 90, align: 'right' });

        currentY += 30;

        // ===== APPROVALS SECTION =====
        doc.fontSize(9).font('Helvetica-Bold');

        // Find approvals
        const financeApproval = approvals.find(a => a.approver_role === 'finance' && a.action === 'approve');
        const regionalApproval = approvals.find(a => a.approver_role === 'regional_finance' && a.action === 'approve');
        const mdApproval = approvals.find(a => a.approver_role === 'md' && a.action === 'approve');

        // Kilometers row
        doc.text('KILOMETERS:', 40, currentY);
        doc.rect(140, currentY - 2, 100, 15).stroke();
        doc.text((claim.total_kilometers || 0).toFixed(0), 145, currentY);

        currentY += 20;

        // Dept Manager
        doc.text('DEPT. MANAGER:', 40, currentY);
        doc.rect(140, currentY - 2, 180, 25).stroke();

        // Authorisation Managing Director
        doc.text('AUTHORISATION MANAGING DIRECTOR:', 340, currentY);
        doc.rect(340, currentY + 15, 220, 40).stroke();
        if (mdApproval) {
            doc.fontSize(7).font('Helvetica').fillColor('#0066cc');
            doc.text('Electronically Approved by:', 345, currentY + 20);
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
            doc.text(`${mdApproval.approver_name}/MD`, 345, currentY + 30, { width: 210 });
            doc.fontSize(6).font('Helvetica').fillColor('#666666');
            const mdDate = new Date(mdApproval.created_at);
            doc.text(`${mdDate.toLocaleDateString('en-GB')} ${mdDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, 345, currentY + 42);
            doc.fillColor('#000000');
        }

        currentY += 30;

        // Accountant
        doc.text('ACCOUNTANT:', 40, currentY);
        doc.rect(140, currentY - 2, 180, 25).stroke();

        currentY += 30;

        // Finance Manager / Regional Approver
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('FINANCE MANAGER:', 40, currentY);
        doc.rect(140, currentY - 2, 180, 25).stroke();

        // Show regional approval if present, otherwise finance approval
        const approvalToShow = regionalApproval || financeApproval;
        if (approvalToShow) {
            doc.fontSize(7).font('Helvetica').fillColor('#0066cc');
            doc.text('Electronically Approved by:', 145, currentY + 1);
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
            const approverTitle = regionalApproval ? 'Regional Finance' : 'Finance Manager';
            doc.text(`${approvalToShow.approver_name}/${approverTitle}`, 145, currentY + 9, { width: 170 });
            doc.fontSize(6).font('Helvetica').fillColor('#666666');
            const approvalDate = new Date(approvalToShow.created_at);
            doc.text(`${approvalDate.toLocaleDateString('en-GB')} ${approvalDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, 145, currentY + 18);
            doc.fillColor('#000000');
        }

        currentY += 35;

        // Footer
        doc.fontSize(7).font('Helvetica').fillColor('#666666');
        doc.text('REFERENCE NO: FR-HR-014', 40, currentY);
        doc.text('REVISION NUMBER', 400, currentY);
        doc.text('1 | Page', 280, currentY, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Error generating Expense Claim PDF:', error);
        callback(error, null);
    }
};

/**
 * Generate PDF for EFT/Cheque Requisition Form
 */
const generateEFTRequisitionPDF = (requisition, approvals, callback) => {
    try {
        console.log('🔍 PDF Generation - EFT Requisition Form');
        console.log('🔍 Requisition ID:', requisition.id);

        const doc = new PDFDocument({
            margin: 50,
            size: 'A4'
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            callback(null, pdfBuffer);
        });
        doc.on('error', (err) => {
            callback(err, null);
        });

        let currentY = 50;

        // ===== HEADER =====
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#0066cc');
        doc.text('KSB ZAMBIA LIMITED', 50, currentY, { align: 'center', width: 500 });

        currentY += 35;
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
        doc.text('ELECTRONIC FUNDS TRANSFER(EFT)/CHEQUE REQUISITION', 50, currentY, { align: 'center', width: 500 });

        currentY += 30;

        // ===== MAIN FORM =====
        const boxWidth = 500;

        // Date and EFT/CHQ Number row
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('DATE', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(new Date(requisition.created_at).toLocaleDateString('en-GB'), 150, currentY + 8);

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Enter EFT/CHQ No', 300, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.eft_chq_number || '____________', 420, currentY + 8);

        currentY += 25;

        // Issue type
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('PLEASE ISSUE : EFT', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.initiator_name, 200, currentY + 8);

        currentY += 25;

        // Amount
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('FOR THE SUM OF:', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(`K ${requisition.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, currentY + 8);

        currentY += 25;

        // Amount in words
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('AMOUNT IN WORDS :', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.amount_in_words, 200, currentY + 8, { width: 330 });

        currentY += 25;

        // In favour of
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('IN FAVOUR OF:', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.in_favour_of, 200, currentY + 8, { width: 330 });

        currentY += 25;

        // Bank Account Number
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('BANK ACCOUNT NUMBER:', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.bank_account_number || '', 200, currentY + 8, { width: 330 });

        currentY += 25;

        // Bank Name
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('BANK NAME:', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.bank_name || '', 200, currentY + 8, { width: 330 });

        currentY += 25;

        // Branch
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('BRANCH:', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.branch || '', 200, currentY + 8, { width: 330 });

        currentY += 25;

        // Purpose
        doc.rect(50, currentY, boxWidth, 60).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('FOR THE FOLLOWING PURPOSE (GIVE DETAILS IN FULL):', 60, currentY + 8, { width: 480 });
        doc.fontSize(9).font('Helvetica');
        doc.text(requisition.purpose, 60, currentY + 25, { width: 480 });

        currentY += 60;

        // Account details table
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('ACCOUNT CODE', 60, currentY + 8, { width: 150 });
        doc.text('AMOUNT', 220, currentY + 8, { width: 100 });
        doc.text('DESCRIPTION', 330, currentY + 8, { width: 200 });

        currentY += 25;

        doc.rect(50, currentY, boxWidth, 30).stroke();
        doc.fontSize(9).font('Helvetica');
        doc.text(requisition.account_code || '', 60, currentY + 10, { width: 150 });
        doc.text(`K ${requisition.amount.toFixed(2)}`, 220, currentY + 10, { width: 100 });
        doc.text(requisition.description || '', 330, currentY + 10, { width: 200 });

        currentY += 45;

        // ===== APPROVALS SECTION =====
        const financeApproval = approvals.find(a => a.approver_role === 'finance' && a.action === 'approve');
        const mdApproval = approvals.find(a => a.approver_role === 'md' && a.action === 'approve');

        // Two column layout for signatures
        const leftColX = 50;
        const rightColX = 300;
        const colWidth = 250;

        // Requisition originated by
        doc.rect(leftColX, currentY, colWidth, 70).stroke();
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('REQUISITION ORIGINATED BY:', leftColX + 10, currentY + 8);
        doc.fontSize(9).font('Helvetica');
        doc.text(`NAME: ${requisition.initiator_name}`, leftColX + 10, currentY + 25);
        doc.text('SIGNATURE:', leftColX + 10, currentY + 40);
        doc.text(new Date(requisition.created_at).toLocaleDateString('en-GB'), leftColX + 10, currentY + 55);

        // Supplier/Vendor check
        doc.rect(rightColX, currentY, colWidth, 70).stroke();
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('SUPPLIER/VENDOR QUOTATION AND KSB PO', rightColX + 10, currentY + 8, { width: 230 });
        doc.text('CHECKED BY:', rightColX + 10, currentY + 25);
        doc.fontSize(9).font('Helvetica');
        doc.text('SIGNATURE:', rightColX + 10, currentY + 40);

        currentY += 75;

        // Requisition authorised by (Finance Manager)
        doc.rect(leftColX, currentY, colWidth, 70).stroke();
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('REQUISITION AUTHORISED BY:', leftColX + 10, currentY + 8);
        if (financeApproval) {
            doc.fontSize(8).font('Helvetica').fillColor('#0066cc');
            doc.text('Electronically Approved by:', leftColX + 10, currentY + 23);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
            doc.text(`${financeApproval.approver_name}/Finance Manager`, leftColX + 10, currentY + 35, { width: 230 });
            doc.fontSize(7).font('Helvetica').fillColor('#666666');
            const financeDate = new Date(financeApproval.created_at);
            doc.text(`${financeDate.toLocaleDateString('en-GB')} ${financeDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, leftColX + 10, currentY + 50);
            doc.fillColor('#000000');
        }

        // Received the above
        doc.rect(rightColX, currentY, colWidth, 70).stroke();
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('RECEIVED THE ABOVE CHEQUE/TRANSFER', rightColX + 10, currentY + 8, { width: 230 });
        doc.fontSize(9).font('Helvetica');
        doc.text('SIGNED', rightColX + 10, currentY + 40);

        currentY += 75;

        // Approved for payment (Managing Director)
        doc.rect(leftColX, currentY, colWidth, 60).stroke();
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('APPROVED FOR PAYMENT:', leftColX + 10, currentY + 8);
        if (mdApproval) {
            doc.fontSize(8).font('Helvetica').fillColor('#0066cc');
            doc.text('Electronically Approved by:', leftColX + 10, currentY + 20);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
            doc.text(`${mdApproval.approver_name}/MD`, leftColX + 10, currentY + 32, { width: 230 });
            doc.fontSize(7).font('Helvetica').fillColor('#666666');
            const mdDate = new Date(mdApproval.created_at);
            doc.text(`${mdDate.toLocaleDateString('en-GB')} ${mdDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, leftColX + 10, currentY + 45);
            doc.fillColor('#000000');
        }

        // Signatories
        doc.rect(rightColX, currentY, 125, 60).stroke();
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('EFT/CHEQUE', rightColX + 10, currentY + 8);
        doc.text('SIGNATORY 1', rightColX + 10, currentY + 20);

        doc.rect(rightColX + 125, currentY, 125, 60).stroke();
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('EFT/CHEQUE', rightColX + 135, currentY + 8);
        doc.text('SIGNATORY 2', rightColX + 135, currentY + 20);

        currentY += 70;

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#666666');
        doc.text('REVISED - EFT and Cheque Requisition Form 6/19/2023', 50, currentY, { align: 'center', width: 500 });

        doc.end();
    } catch (error) {
        console.error('Error generating EFT Requisition PDF:', error);
        callback(error, null);
    }
};

/**
 * Generate PDF for Petty Cash Requisition Form
 */
const generatePettyCashRequisitionPDF = (requisition, items, approvals, callback) => {
    try {
        console.log('🔍 PDF Generation - Petty Cash Requisition Form');
        console.log('🔍 Requisition ID:', requisition.id);

        const doc = new PDFDocument({
            margin: 50,
            size: 'A4'
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            callback(null, pdfBuffer);
        });
        doc.on('error', (err) => {
            callback(err, null);
        });

        let currentY = 50;

        // ===== HEADER =====
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#0066cc');
        doc.text('KSB ZAMBIA LIMITED', 50, currentY, { align: 'center', width: 500 });

        currentY += 35;
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
        doc.text('PETTY CASH REQUISITION FORM', 50, currentY, { align: 'center', width: 500 });

        currentY += 30;

        // ===== MAIN FORM =====
        const boxWidth = 500;

        // Date and Requisition Number
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('DATE', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(new Date(requisition.created_at).toLocaleDateString('en-GB'), 150, currentY + 8);

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('REQUISITION NO.', 300, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.id, 420, currentY + 8);

        currentY += 25;

        // Amount
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('AMOUNT (ZMW)', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(`K ${requisition.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, currentY + 8);

        currentY += 25;

        // Amount in Words
        doc.rect(50, currentY, boxWidth, 30).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('AMOUNT IN WORDS', 60, currentY + 10);
        doc.fontSize(9).font('Helvetica');
        doc.text(requisition.amount_in_words, 200, currentY + 10, { width: 330 });

        currentY += 30;

        // Payee Name
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('PAYEE NAME', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.payee_name, 200, currentY + 8);

        currentY += 25;

        // Department
        doc.rect(50, currentY, boxWidth, 25).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('DEPARTMENT', 60, currentY + 8);
        doc.fontSize(10).font('Helvetica');
        doc.text(requisition.department, 200, currentY + 8);

        currentY += 25;

        // Purpose
        doc.rect(50, currentY, boxWidth, 50).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('PURPOSE', 60, currentY + 10);
        doc.fontSize(9).font('Helvetica');
        const purposeLines = doc.heightOfString(requisition.purpose, { width: 420 });
        doc.text(requisition.purpose, 60, currentY + 25, { width: 480, align: 'left' });

        currentY += 50;

        // Description (if provided)
        if (requisition.description) {
            doc.rect(50, currentY, boxWidth, 30).stroke();
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('DESCRIPTION', 60, currentY + 10);
            doc.fontSize(9).font('Helvetica');
            doc.text(requisition.description, 200, currentY + 10, { width: 330 });

            currentY += 30;
        }

        currentY += 10;

        // ===== LINE ITEMS TABLE =====
        if (items && items.length > 0) {
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('EXPENSE BREAKDOWN', 50, currentY);

            currentY += 20;

            // Table header
            doc.rect(50, currentY, boxWidth, 25).fillAndStroke('#f0f0f0', '#000000');
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
            doc.text('#', 60, currentY + 8, { width: 30 });
            doc.text('ITEM DESCRIPTION', 100, currentY + 8, { width: 300 });
            doc.text('AMOUNT (ZMW)', 420, currentY + 8, { width: 120, align: 'right' });

            currentY += 25;

            // Table rows
            items.forEach((item, index) => {
                doc.rect(50, currentY, boxWidth, 20).stroke();
                doc.fontSize(9).font('Helvetica').fillColor('#000000');
                doc.text(item.item_no, 60, currentY + 5, { width: 30 });
                doc.text(item.description, 100, currentY + 5, { width: 300 });
                doc.text(`K ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 420, currentY + 5, { width: 120, align: 'right' });

                currentY += 20;
            });

            // Total row
            doc.rect(50, currentY, boxWidth, 25).fillAndStroke('#e6f2ff', '#000000');
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
            doc.text('TOTAL', 100, currentY + 8, { width: 300 });
            doc.text(`K ${requisition.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 420, currentY + 8, { width: 120, align: 'right' });

            currentY += 35;
        }

        // ===== APPROVAL SECTION =====
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
        doc.text('APPROVAL SIGNATURES', 50, currentY);

        currentY += 20;

        // Initiator
        doc.rect(50, currentY, 250, 60).stroke();
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('REQUESTED BY:', 60, currentY + 10);
        doc.fontSize(9).font('Helvetica');
        doc.text(requisition.initiator_name, 60, currentY + 25);
        doc.fontSize(8).font('Helvetica').fillColor('#666666');
        doc.text(new Date(requisition.created_at).toLocaleString('en-GB'), 60, currentY + 45);

        // HOD Approval
        const hodApproval = approvals.find(a => a.role === 'hod');
        doc.rect(300, currentY, 250, 60).stroke();
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text('HOD APPROVAL:', 310, currentY + 10);
        if (hodApproval) {
            doc.fontSize(8).font('Helvetica').fillColor('#0066cc');
            doc.text('Electronically Approved by:', 310, currentY + 20);
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
            doc.text(`${hodApproval.user_name}\HOD`, 310, currentY + 30, { width: 230 });
            doc.fontSize(8).font('Helvetica').fillColor('#666666');
            const hodDate = new Date(hodApproval.timestamp);
            doc.text(`${hodDate.toLocaleDateString('en-GB')} ${hodDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, 310, currentY + 45);
        } else {
            doc.fontSize(8).font('Helvetica').fillColor('#999999');
            doc.text('Pending', 310, currentY + 25);
        }

        currentY += 70;

        // Finance Approval
        const financeApproval = approvals.find(a => a.role === 'finance');
        doc.rect(50, currentY, 250, 60).stroke();
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text('FINANCE APPROVAL:', 60, currentY + 10);
        if (financeApproval) {
            doc.fontSize(8).font('Helvetica').fillColor('#0066cc');
            doc.text('Electronically Approved by:', 60, currentY + 20);
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
            doc.text(`${financeApproval.user_name}\Finance Manager`, 60, currentY + 30, { width: 230 });
            doc.fontSize(8).font('Helvetica').fillColor('#666666');
            const financeDate = new Date(financeApproval.timestamp);
            doc.text(`${financeDate.toLocaleDateString('en-GB')} ${financeDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, 60, currentY + 45);
        } else {
            doc.fontSize(8).font('Helvetica').fillColor('#999999');
            doc.text('Pending', 60, currentY + 25);
        }

        // MD Approval
        const mdApproval = approvals.find(a => a.role === 'md');
        doc.rect(300, currentY, 250, 60).stroke();
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text('MD APPROVAL:', 310, currentY + 10);
        if (mdApproval) {
            doc.fontSize(8).font('Helvetica').fillColor('#0066cc');
            doc.text('Electronically Approved by:', 310, currentY + 20);
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
            doc.text(`${mdApproval.user_name}\MD`, 310, currentY + 30, { width: 230 });
            doc.fontSize(8).font('Helvetica').fillColor('#666666');
            const mdDate = new Date(mdApproval.timestamp);
            doc.text(`${mdDate.toLocaleDateString('en-GB')} ${mdDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, 310, currentY + 45);
        } else {
            doc.fontSize(8).font('Helvetica').fillColor('#999999');
            doc.text('Pending', 310, currentY + 25);
        }

        currentY += 70;

        // Status
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text('STATUS: ', 50, currentY);
        doc.fontSize(9).font('Helvetica');

        let statusColor = '#666666';
        let statusText = requisition.status.toUpperCase().replace(/_/g, ' ');

        if (requisition.status === 'approved') {
            statusColor = '#22c55e';
        } else if (requisition.status === 'rejected') {
            statusColor = '#ef4444';
        } else {
            statusColor = '#f59e0b';
        }

        doc.fillColor(statusColor);
        doc.text(statusText, 100, currentY);

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#999999');
        doc.text('Generated by PRAS - Purchase Requisition System', 50, 750, { align: 'center', width: 500 });

        doc.end();

        console.log('✅ Petty Cash Requisition PDF generated successfully');
    } catch (error) {
        console.error('Error generating Petty Cash Requisition PDF:', error);
        callback(error, null);
    }
};

module.exports = {
    generateExpenseClaimPDF,
    generateEFTRequisitionPDF,
    generatePettyCashRequisitionPDF
};
