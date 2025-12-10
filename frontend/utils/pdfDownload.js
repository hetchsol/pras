/**
 * PDF Download Utility
 * Handles downloading Approved Purchase Requisition PDFs
 */

/**
 * Download Approved Purchase Requisition PDF
 * @param {number} requisitionId - The requisition ID
 * @param {string} token - JWT authentication token
 * @param {string} baseUrl - API base URL (default: current origin)
 * @returns {Promise<void>}
 */
export async function downloadApprovedPR(requisitionId, token, baseUrl = window.location.origin) {
    try {
        const response = await fetch(`${baseUrl}/api/requisitions/${requisitionId}/pdf`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to generate PDF' }));
            throw new Error(error.message || 'Failed to generate PDF');
        }

        // Get the blob from response
        const blob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Approved_PR_${requisitionId}.pdf`;

        // Trigger download
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        return { success: true };
    } catch (error) {
        console.error('Error downloading PDF:', error);
        throw error;
    }
}

/**
 * Check if requisition is approved and ready for PDF generation
 * @param {object} requisition - The requisition object
 * @returns {boolean}
 */
export function canGeneratePDF(requisition) {
    return requisition &&
           (requisition.status === 'approved' ||
            requisition.status === 'completed');
}

/**
 * React Hook Example for PDF Download
 * Usage in React components:
 *
 * import { downloadApprovedPR, canGeneratePDF } from './utils/pdfDownload';
 *
 * function RequisitionDetail({ requisition }) {
 *     const [downloading, setDownloading] = useState(false);
 *     const token = localStorage.getItem('token'); // or from context
 *
 *     const handleDownloadPDF = async () => {
 *         setDownloading(true);
 *         try {
 *             await downloadApprovedPR(requisition.id, token);
 *             alert('PDF downloaded successfully!');
 *         } catch (error) {
 *             alert('Error downloading PDF: ' + error.message);
 *         } finally {
 *             setDownloading(false);
 *         }
 *     };
 *
 *     return (
 *         <div>
 *             {canGeneratePDF(requisition) && (
 *                 <button
 *                     onClick={handleDownloadPDF}
 *                     disabled={downloading}
 *                     className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
 *                 >
 *                     {downloading ? 'Generating PDF...' : 'Download Approved PR'}
 *                 </button>
 *             )}
 *         </div>
 *     );
 * }
 */
