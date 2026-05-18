/**
 * Simple CSV Export utility
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportToCSV(data: any[], columns: { id: string; label: string }[], filename: string) {
  if (!data || data.length === 0) return;

  const headers = columns.map(col => col.label).join(',');
  const rows = data.map(row => {
    return columns.map(col => {
      let val = row[col.id] || '';
      // Escape commas and quotes
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        val = `"${val}"`;
      }
      return val;
    }).join(',');
  });

  const csvContent = "\ufeff" + [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
