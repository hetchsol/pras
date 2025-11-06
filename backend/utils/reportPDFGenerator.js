/**
 * PDF Report Generator for Finance Manager and MD
 *
 * Generates comprehensive PDF reports for management and finance
 */

const PDFDocument = require('pdfkit');

/**
 * Generate Requisition Summary PDF Report
 * @param {Array} requisitions - Array of requisition objects
 * @param {Object} filters - Filter parameters
 * @returns {PDFDocument} PDF stream
 */
function generateRequisitionSummaryPDF(requisitions, filters = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Header
    doc.fontSize(18)
        .fillColor('#0066CC')
        .text('PURCHASE REQUISITION SUMMARY REPORT', { align: 'center' })
        .moveDown();

    doc.fontSize(10)
        .fillColor('#333333')
        .text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'center' })
        .moveDown();

    // Filters info
    if (filters.dateFrom || filters.dateTo || filters.status || filters.department) {
        doc.fontSize(10)
            .fillColor('#666666')
            .text('Filters Applied:', { underline: true });

        if (filters.dateFrom) {
            doc.text(`  Date From: ${filters.dateFrom}`);
        }
        if (filters.dateTo) {
            doc.text(`  Date To: ${filters.dateTo}`);
        }
        if (filters.status) {
            doc.text(`  Status: ${filters.status}`);
        }
        if (filters.department) {
            doc.text(`  Department: ${filters.department}`);
        }
        doc.moveDown();
    }

    // Summary statistics
    const totalReqs = requisitions.length;
    const totalAmount = requisitions.reduce((sum, req) => {
        return sum + req.items.reduce((itemSum, item) => {
            return itemSum + (item.amount_in_zmw || item.total_price || 0);
        }, 0);
    }, 0);

    const statusCounts = requisitions.reduce((acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1;
        return acc;
    }, {});

    // Summary box
    doc.fontSize(12)
        .fillColor('#0066CC')
        .text('Summary', { underline: true })
        .fontSize(10)
        .fillColor('#333333');

    doc.text(`Total Requisitions: ${totalReqs}`);
    doc.text(`Total Amount: K${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    doc.moveDown();

    doc.fontSize(10)
        .text('Status Breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
        doc.text(`  ${status}: ${count}`);
    });
    doc.moveDown(2);

    // Requisitions table header
    const tableTop = doc.y;
    const colWidths = {
        reqNum: 100,
        title: 150,
        dept: 80,
        status: 80,
        amount: 80
    };

    doc.fontSize(9)
        .fillColor('#FFFFFF')
        .rect(50, tableTop, 495, 20)
        .fill('#0066CC');

    doc.fillColor('#FFFFFF')
        .text('Req Number', 55, tableTop + 5, { width: colWidths.reqNum })
        .text('Title', 155, tableTop + 5, { width: colWidths.title })
        .text('Dept', 305, tableTop + 5, { width: colWidths.dept })
        .text('Status', 385, tableTop + 5, { width: colWidths.status })
        .text('Amount (ZMW)', 465, tableTop + 5, { width: colWidths.amount, align: 'right' });

    // Requisitions data
    let yPosition = tableTop + 25;
    requisitions.forEach((req, index) => {
        // Check if we need a new page
        if (yPosition > 720) {
            doc.addPage();
            yPosition = 50;
        }

        const reqTotal = req.items.reduce((sum, item) => {
            return sum + (item.amount_in_zmw || item.total_price || 0);
        }, 0);

        // Alternating row colors
        if (index % 2 === 0) {
            doc.rect(50, yPosition - 3, 495, 15).fillAndStroke('#F0F8FF', '#CCCCCC');
        }

        doc.fillColor('#333333')
            .fontSize(8)
            .text(req.req_number || '', 55, yPosition, { width: colWidths.reqNum })
            .text(req.title || '', 155, yPosition, { width: colWidths.title, ellipsis: true })
            .text(req.department || '', 305, yPosition, { width: colWidths.dept })
            .text(req.status || '', 385, yPosition, { width: colWidths.status })
            .text(`K${reqTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                465, yPosition, { width: colWidths.amount, align: 'right' });

        yPosition += 20;
    });

    // Total row
    yPosition += 5;
    doc.rect(50, yPosition - 3, 495, 20).fillAndStroke('#FFEB3B', '#CCCCCC');
    doc.fillColor('#000000')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('TOTAL', 55, yPosition + 2)
        .text(`K${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            465, yPosition + 2, { width: colWidths.amount, align: 'right' });

    // Footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
            .fillColor('#999999')
            .text(`Page ${i + 1} of ${pageCount}`,
                50,
                doc.page.height - 50,
                { align: 'center' });
    }

    return doc;
}

/**
 * Generate Budget Report PDF
 * @param {Array} budgets - Array of budget objects
 * @param {String} fiscalYear - Fiscal year
 * @returns {PDFDocument} PDF stream
 */
function generateBudgetReportPDF(budgets, fiscalYear) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Header
    doc.fontSize(18)
        .fillColor('#FF6600')
        .text(`BUDGET REPORT - FISCAL YEAR ${fiscalYear}`, { align: 'center' })
        .moveDown();

    doc.fontSize(10)
        .fillColor('#333333')
        .text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'center' })
        .moveDown(2);

    // Calculate totals
    const totals = budgets.reduce((acc, budget) => {
        acc.allocated += budget.allocated_amount || 0;
        acc.committed += budget.committed_amount || 0;
        acc.spent += budget.spent_amount || 0;
        return acc;
    }, { allocated: 0, committed: 0, spent: 0 });

    totals.available = totals.allocated - totals.committed - totals.spent;
    totals.utilization = totals.allocated > 0 ? ((totals.committed + totals.spent) / totals.allocated * 100) : 0;

    // Overall summary box
    doc.fontSize(12)
        .fillColor('#FF6600')
        .text('Overall Budget Summary', { underline: true })
        .fontSize(10)
        .fillColor('#333333');

    doc.text(`Total Allocated: K${totals.allocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    doc.text(`Total Committed: K${totals.committed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    doc.text(`Total Spent: K${totals.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    doc.text(`Total Available: K${totals.available.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    doc.text(`Overall Utilization: ${totals.utilization.toFixed(2)}%`);
    doc.moveDown(2);

    // Budget table header
    const tableTop = doc.y;

    doc.fontSize(9)
        .fillColor('#FFFFFF')
        .rect(50, tableTop, 495, 20)
        .fill('#FF6600');

    doc.fillColor('#FFFFFF')
        .text('Department', 55, tableTop + 5, { width: 100 })
        .text('Allocated', 155, tableTop + 5, { width: 70, align: 'right' })
        .text('Committed', 225, tableTop + 5, { width: 70, align: 'right' })
        .text('Spent', 295, tableTop + 5, { width: 70, align: 'right' })
        .text('Available', 365, tableTop + 5, { width: 70, align: 'right' })
        .text('Util %', 435, tableTop + 5, { width: 50, align: 'right' })
        .text('Status', 485, tableTop + 5, { width: 60 });

    // Budget data
    let yPosition = tableTop + 25;
    budgets.forEach((budget, index) => {
        const allocated = budget.allocated_amount || 0;
        const committed = budget.committed_amount || 0;
        const spent = budget.spent_amount || 0;
        const available = allocated - committed - spent;
        const utilization = allocated > 0 ? ((committed + spent) / allocated * 100) : 0;

        let status = 'Normal';
        let statusColor = '#00AA00';

        if (utilization >= 90) {
            status = 'Critical';
            statusColor = '#FF0000';
        } else if (utilization >= 75) {
            status = 'Warning';
            statusColor = '#FFA500';
        }

        // Alternating row colors
        if (index % 2 === 0) {
            doc.rect(50, yPosition - 3, 495, 15).fillAndStroke('#FFF5E6', '#CCCCCC');
        }

        doc.fillColor('#333333')
            .fontSize(8)
            .text(budget.department, 55, yPosition, { width: 100 })
            .text(`K${allocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                155, yPosition, { width: 70, align: 'right' })
            .text(`K${committed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                225, yPosition, { width: 70, align: 'right' })
            .text(`K${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                295, yPosition, { width: 70, align: 'right' })
            .text(`K${available.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                365, yPosition, { width: 70, align: 'right' })
            .text(`${utilization.toFixed(1)}%`, 435, yPosition, { width: 50, align: 'right' })
            .fillColor(statusColor)
            .text(status, 485, yPosition, { width: 60 });

        yPosition += 20;
    });

    // Totals row
    yPosition += 5;
    doc.rect(50, yPosition - 3, 495, 20).fillAndStroke('#FFEB3B', '#CCCCCC');
    doc.fillColor('#000000')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('TOTAL', 55, yPosition + 2)
        .text(`K${totals.allocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            155, yPosition + 2, { width: 70, align: 'right' })
        .text(`K${totals.committed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            225, yPosition + 2, { width: 70, align: 'right' })
        .text(`K${totals.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            295, yPosition + 2, { width: 70, align: 'right' })
        .text(`K${totals.available.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            365, yPosition + 2, { width: 70, align: 'right' })
        .text(`${totals.utilization.toFixed(1)}%`, 435, yPosition + 2, { width: 50, align: 'right' });

    // Footer
    doc.fontSize(8)
        .fillColor('#999999')
        .text('Page 1 of 1', 50, doc.page.height - 50, { align: 'center' });

    return doc;
}

/**
 * Generate Departmental Spending Report PDF
 * @param {String} department - Department name
 * @param {Array} requisitions - Requisitions for the department
 * @param {Object} budgetInfo - Budget information
 * @returns {PDFDocument} PDF stream
 */
function generateDepartmentalSpendingPDF(department, requisitions, budgetInfo) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Header
    doc.fontSize(18)
        .fillColor('#0066CC')
        .text(`DEPARTMENTAL SPENDING REPORT`, { align: 'center' })
        .fontSize(14)
        .text(department, { align: 'center' })
        .moveDown();

    doc.fontSize(10)
        .fillColor('#333333')
        .text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'center' })
        .moveDown(2);

    // Budget summary
    if (budgetInfo) {
        doc.fontSize(12)
            .fillColor('#0066CC')
            .text('Budget Overview', { underline: true })
            .fontSize(10)
            .fillColor('#333333');

        const allocated = budgetInfo.allocated_amount || 0;
        const committed = budgetInfo.committed_amount || 0;
        const spent = budgetInfo.spent_amount || 0;
        const available = allocated - committed - spent;
        const utilization = allocated > 0 ? ((committed + spent) / allocated * 100) : 0;

        doc.text(`Allocated Budget: K${allocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        doc.text(`Committed: K${committed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        doc.text(`Spent: K${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        doc.text(`Available: K${available.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        doc.text(`Utilization: ${utilization.toFixed(2)}%`);
        doc.moveDown(2);
    }

    // Requisitions list
    doc.fontSize(12)
        .fillColor('#0066CC')
        .text('Requisitions', { underline: true })
        .moveDown();

    if (requisitions.length === 0) {
        doc.fontSize(10)
            .fillColor('#666666')
            .text('No requisitions found for this department.');
    } else {
        requisitions.forEach((req, index) => {
            const reqTotal = req.items.reduce((sum, item) => {
                return sum + (item.amount_in_zmw || item.total_price || 0);
            }, 0);

            doc.fontSize(10)
                .fillColor('#333333')
                .text(`${index + 1}. ${req.req_number} - ${req.title}`);

            doc.fontSize(9)
                .fillColor('#666666')
                .text(`   Status: ${req.status}  |  Amount: K${reqTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}  |  Date: ${new Date(req.created_at).toLocaleDateString()}`);

            doc.moveDown(0.5);
        });
    }

    // Footer
    doc.fontSize(8)
        .fillColor('#999999')
        .text('Page 1 of 1', 50, doc.page.height - 50, { align: 'center' });

    return doc;
}

module.exports = {
    generateRequisitionSummaryPDF,
    generateBudgetReportPDF,
    generateDepartmentalSpendingPDF
};
