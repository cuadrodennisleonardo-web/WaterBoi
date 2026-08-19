/**
 * WaterBoi Export Helpers (CSV & Printing)
 */

export function downloadCSV(filename, rows) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows.map(row => {
      return keys
        .map(k => {
          let cell = row[k] === null || row[k] === undefined ? '' : row[k];
          cell = cell.toString().replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) {
            cell = `"${cell}"`;
          }
          return cell;
        })
        .join(separator);
    }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function printElement(elementId) {
  const elem = document.getElementById(elementId);
  if (!elem) return;

  const printWindow = window.open('', '', 'height=600,width=800');
  printWindow.document.write('<html><head><title>WaterBoi Receipt</title>');
  printWindow.document.write('<style>');
  printWindow.document.write(`
    body { font-family: sans-serif; padding: 20px; color: #000; }
    .receipt-box { border: 1px solid #ccc; padding: 20px; max-width: 400px; margin: auto; border-radius: 8px; }
    .receipt-header { text-align: center; margin-bottom: 20px; }
    .receipt-row { display: flex; justify-content: space-between; margin: 8px 0; border-bottom: 1px dashed #eee; padding-bottom: 4px; }
    .receipt-total { font-weight: bold; font-size: 1.2em; border-top: 2px solid #000; padding-top: 8px; margin-top: 12px; }
  `);
  printWindow.document.write('</style></head><body>');
  printWindow.document.write(elem.innerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}
