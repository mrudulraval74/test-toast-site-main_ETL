import html2canvas from 'html2canvas';
import { ExportOptions } from './types';

export const exportToPng = async (
  elementRef: React.RefObject<HTMLDivElement>,
  filename: string = 'wispr-architecture'
): Promise<void> => {
  if (!elementRef.current) return;

  const canvas = await html2canvas(elementRef.current, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

export const exportToPdf = (elementId: string): void => {
  const printContent = document.getElementById(elementId);
  if (!printContent) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>WISPR Architecture</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
            .no-print { display: none !important; }
            @page { margin: 1cm; }
          }
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            padding: 40px;
            max-width: 1200px;
            margin: 0 auto;
          }
          h1 { color: #1a1a2e; margin-bottom: 8px; }
          h2 { color: #16213e; margin-top: 32px; margin-bottom: 16px; }
          .subtitle { color: #666; margin-bottom: 32px; }
          .diagram-container { 
            border: 1px solid #e5e7eb; 
            border-radius: 8px; 
            padding: 24px; 
            margin-bottom: 24px;
            background: #fafafa;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 16px;
          }
          th, td { 
            border: 1px solid #e5e7eb; 
            padding: 12px; 
            text-align: left; 
          }
          th { background: #f3f4f6; font-weight: 600; }
          .feature-badge {
            display: inline-block;
            background: #e0e7ff;
            color: #3730a3;
            padding: 4px 8px;
            border-radius: 4px;
            margin: 2px;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};

export const ExportOptionsDefaults: ExportOptions = {
  format: 'png',
  scope: 'current',
  includeExecutive: true,
  includeTechnical: true,
  includeFeatureList: true,
};
