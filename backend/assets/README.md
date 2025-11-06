# Assets Directory

## Company Logo

Place your company logo in this directory to display it on Purchase Order PDFs.

### Requirements:
- **File name:** `logo.png`
- **Format:** PNG (recommended) or JPG
- **Recommended size:** 400x100 pixels (or similar 4:1 aspect ratio)
- **File size:** Keep under 500KB for optimal PDF generation

### Location:
```
backend/assets/logo.png
```

### How it works:
- If `logo.png` exists, it will be displayed in the top-left corner of the PO PDF (120px width)
- Company name and contact info will appear on the right side
- If logo doesn't exist, company name will be centered at the top

### Example:
```bash
# Copy your logo to this directory
cp /path/to/your/company-logo.png backend/assets/logo.png
```

### Supported formats:
- PNG (transparent background recommended)
- JPG/JPEG

### Tips:
- Use a transparent background PNG for best results
- Ensure the logo is clear and professional
- Test the PDF output after adding the logo
- Keep the aspect ratio around 4:1 (width:height) for best fit

---

**Note:** The application will work normally even if no logo file is present. The logo feature is optional.
