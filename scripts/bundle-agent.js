
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'etl-agent');
const OUT_DIR = path.join(ROOT_DIR, 'public');
const OUT_FILE = path.join(OUT_DIR, 'etl-agent.zip');

const zip = new JSZip();

// Files to include
const FILES = ['agent.js', 'package.json', 'README.md', '.env.example'];

console.log('Building etl-agent.zip...');

// Add root files
FILES.forEach(file => {
    const filePath = path.join(SOURCE_DIR, file);
    if (fs.existsSync(filePath)) {
        zip.file(file, fs.readFileSync(filePath));
        console.log(`Added: ${file}`);
    } else {
        console.warn(`Warning: ${file} not found`);
    }
});

// Add utils directory
const utilsDir = path.join(SOURCE_DIR, 'utils');
if (fs.existsSync(utilsDir)) {
    const files = fs.readdirSync(utilsDir);
    const utilsFolder = zip.folder('utils');
    files.forEach(file => {
        const filePath = path.join(utilsDir, file);
        if (fs.statSync(filePath).isFile()) {
            utilsFolder.file(file, fs.readFileSync(filePath));
            console.log(`Added: utils/${file}`);
        }
    });
}

// Generate zip
zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
    .pipe(fs.createWriteStream(OUT_FILE))
    .on('finish', () => {
        console.log(`\nSuccess! Zip created at: ${OUT_FILE}`);
    })
    .on('error', (err) => {
        console.error('Error creating zip:', err);
        process.exit(1);
    });
