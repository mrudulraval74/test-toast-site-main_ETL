import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const dir = 'c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New';
const files = [
  'AdventureWorks_DetailedMapping.xlsx',
  'AdventureWorks_ScriptReady_Mapping.xlsx',
  'BD_Lead_Source_Scorecard_FULL_Test_Cases.xlsx',
  '2027_single_sheet_random_with_actuals.xlsx'
];

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  console.log(`\n=========================================`);
  console.log(`Inspecting file: ${file}`);
  try {
    const workbook = XLSX.readFile(filePath);
    workbook.SheetNames.forEach(sheetName => {
      console.log(`  Sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (data.length > 0) {
        console.log(`    Total rows: ${data.length}`);
        console.log(`    Headers/Row 0:`, data[0]);
        if (data.length > 1) {
          console.log(`    Row 1:`, data[1]);
        }
        if (data.length > 2) {
          console.log(`    Row 2:`, data[2]);
        }
      }
    });
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
});
