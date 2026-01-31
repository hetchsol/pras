const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Simple markdown to HTML converter
function markdownToHTML(markdown) {
    let html = markdown;

    // Headers
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\_\_(.*?)\_\_/gim, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    html = html.replace(/\_(.*?)\_/gim, '<em>$1</em>');

    // Code
    html = html.replace(/```(.*?)```/gims, '<pre><code>$1</code></pre>');
    html = html.replace(/`(.*?)`/gim, '<code>$1</code>');

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>');

    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

    // Wrap consecutive list items in ul
    html = html.replace(/(<li>.*<\/li>\n?)+/gim, '<ul>$&</ul>');

    // Line breaks
    html = html.replace(/\n\n/gim, '</p><p>');
    html = html.replace(/\n/gim, '<br>');

    // Wrap in paragraphs
    if (!html.startsWith('<')) {
        html = '<p>' + html + '</p>';
    }

    return html;
}

function createHTMLDocument(title, content) {
    const styles = `
        body {
            font-family: 'Calibri', 'Arial', sans-serif;
            line-height: 1.6;
            max-width: 8.5in;
            margin: 1in auto;
            padding: 0 0.5in;
            color: #333;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            font-size: 2em;
            margin-top: 1em;
        }
        h2 {
            color: #34495e;
            border-bottom: 2px solid #95a5a6;
            padding-bottom: 8px;
            margin-top: 1.5em;
            font-size: 1.5em;
        }
        h3 {
            color: #34495e;
            margin-top: 1.2em;
            font-size: 1.3em;
        }
        h4 {
            color: #555;
            margin-top: 1em;
            font-size: 1.1em;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        pre {
            background-color: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            border-left: 4px solid #3498db;
        }
        pre code {
            background: none;
            padding: 0;
        }
        strong {
            color: #2c3e50;
            font-weight: bold;
        }
        em {
            font-style: italic;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #3498db;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        ul, ol {
            margin: 10px 0;
            padding-left: 30px;
        }
        li {
            margin: 5px 0;
        }
        blockquote {
            border-left: 4px solid #3498db;
            padding-left: 20px;
            margin: 20px 0;
            color: #555;
            font-style: italic;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        p {
            margin: 1em 0;
        }
        .page-break {
            page-break-after: always;
        }
        @media print {
            body {
                margin: 0;
                padding: 0.5in;
            }
        }
    `;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>${styles}</style>
</head>
<body>
${content}
</body>
</html>`;
}

async function convertMarkdownFiles() {
    console.log('\n========================================');
    console.log(' Markdown to DOCX/HTML Converter');
    console.log('========================================\n');

    const outputDir = 'docs-docx';

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`✓ Created output directory: ${outputDir}\n`);
    }

    // Get all .md files in current directory
    const files = fs.readdirSync('.')
        .filter(file => file.endsWith('.md'));

    if (files.length === 0) {
        console.log('No markdown files found!');
        return;
    }

    console.log(`Found ${files.length} markdown files\n`);

    let converted = 0;
    let failed = 0;

    for (const file of files) {
        try {
            process.stdout.write(`Converting: ${file.padEnd(50)} `);

            // Read markdown content
            const markdown = fs.readFileSync(file, 'utf8');
            const baseName = path.basename(file, '.md');

            // Convert to HTML
            const htmlContent = markdownToHTML(markdown);
            const htmlDocument = createHTMLDocument(baseName, htmlContent);

            // Save HTML file
            const htmlPath = path.join(outputDir, `${baseName}.html`);
            fs.writeFileSync(htmlPath, htmlDocument, 'utf8');

            console.log('✓ HTML');
            converted++;

        } catch (error) {
            console.log(`✗ FAILED: ${error.message}`);
            failed++;
        }
    }

    console.log('\n========================================');
    console.log(' Conversion Complete!');
    console.log('========================================\n');
    console.log(`Total files: ${files.length}`);
    console.log(`Converted: ${converted}`);
    console.log(`Failed: ${failed}\n`);
    console.log(`Output directory: ${outputDir}\\n`);

    console.log('Note: HTML files created. To convert to DOCX:');
    console.log('1. Open HTML file in Microsoft Word');
    console.log('2. File > Save As > Word Document (.docx)');
    console.log('');
    console.log('Or install Pandoc for automatic conversion:');
    console.log('   winget install --id=JohnMacFarlane.Pandoc -e');
    console.log('   Then run: pandoc input.md -o output.docx\n');
}

// Run the converter
convertMarkdownFiles().catch(console.error);
