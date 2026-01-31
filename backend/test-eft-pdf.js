const { getEFTRequisitionById, getFormApprovals } = require('./database');
const { generateEFTRequisitionPDF } = require('./utils/formsPDFGenerator');
const fs = require('fs');

const eftId = 'KSB-EFT-20251201193919';

console.log('Testing EFT PDF Generation');
console.log('==========================\n');

const requisition = getEFTRequisitionById(eftId);
console.log('Requisition:', JSON.stringify(requisition, null, 2));

const approvals = getFormApprovals('eft_requisition', eftId);
console.log('\nApprovals found:', approvals.length);
approvals.forEach(a => {
    console.log('\nApproval:');
    console.log('  approver_role:', a.approver_role);
    console.log('  approver_name:', a.approver_name);
    console.log('  action:', a.action);
    console.log('  created_at:', a.created_at);
});

// Test the find logic
const financeApproval = approvals.find(a => a.approver_role === 'finance' && a.action === 'approve');
const mdApproval = approvals.find(a => a.approver_role === 'md' && a.action === 'approve');

console.log('\n=== FIND RESULTS ===');
console.log('Finance Approval:', financeApproval ? 'FOUND' : 'NOT FOUND');
if (financeApproval) {
    console.log('  Name:', financeApproval.approver_name);
    console.log('  Date:', financeApproval.created_at);
}

console.log('\nMD Approval:', mdApproval ? 'FOUND' : 'NOT FOUND');
if (mdApproval) {
    console.log('  Name:', mdApproval.approver_name);
    console.log('  Date:', mdApproval.created_at);
}

// Generate PDF
console.log('\n=== GENERATING PDF ===');
generateEFTRequisitionPDF(requisition, approvals, (error, pdfBuffer) => {
    if (error) {
        console.error('Error generating PDF:', error);
        process.exit(1);
    }

    const filename = `TEST_${eftId}.pdf`;
    fs.writeFileSync(filename, pdfBuffer);
    console.log(`✅ PDF generated successfully: ${filename}`);
    process.exit(0);
});
