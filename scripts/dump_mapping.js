import XLSX from 'xlsx';
import path from 'path';

const filePath = 'c:/Users/RavalMrudul/OneDrive - 1Rivet US, Inc/Lovable/New/AdventureWorks_ScriptReady_Mapping.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets['DimCustomer'];
const data = XLSX.utils.sheet_to_json(worksheet);
console.log('Total rows:', data.length);
data.slice(0, 10).forEach((row, i) => {
  console.log(`Row ${i}:`, row);
});
