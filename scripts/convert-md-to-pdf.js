const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function convertMarkdownToPDF() {
    console.log('\n========================================');
    console.log(' Markdown to PDF Converter');
    console.log('========================================\n');

    const outputDir = 'docs-pdf';

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
        const baseName = path.basename(file, '.md');
        const outputFile = path.join(outputDir, `${baseName}.pdf`);

        // Skip if PDF already exists
        if (fs.existsSync(outputFile)) {
            console.log(`Skipping: ${file.padEnd(50)} (PDF exists)`);
            continue;
        }

        process.stdout.write(`Converting: ${file.padEnd(50)} `);

        try {
            // Use markdown-pdf to convert
            await execAsync(`markdown-pdf "${file}" -o "${outputFile}"`, {
                timeout: 30000
            });

            console.log('✓ PDF');
            converted++;

        } catch (error) {
            console.log(`✗ FAILED`);
            failed++;
        }
    }

    console.log('\n========================================');
    console.log(' Conversion Complete!');
    console.log('========================================\n');
    console.log(`Total files: ${files.length}`);
    console.log(`Converted: ${converted}`);
    console.log(`Failed: ${failed}\n`);
    console.log(`Output directory: ${outputDir}\\\n`);
}

// Run the converter
convertMarkdownToPDF().catch(console.error);
