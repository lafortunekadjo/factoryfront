import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PrintService {

  /**
   * Ouvre une fenêtre d'impression avec le HTML fourni.
   * Les styles CSS de base sont inclus + @media print optimisé A4.
   */
  print(title: string, html: string, landscape = false) {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    win.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; }

    /* Layout */
    .page { padding: 20mm 15mm; }
    .print-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1565C0; padding-bottom: 10px; margin-bottom: 16px; }
    .print-title { font-size: 18px; font-weight: 800; color: #1565C0; }
    .print-subtitle { font-size: 13px; color: #555; margin-top: 3px; }
    .print-meta { text-align: right; font-size: 11px; color: #777; }
    .print-footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #999; }

    /* Tableaux */
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
    th { background: #1565C0; color: #fff; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 6px 8px; border-bottom: 1px solid #e8e8f0; }
    tr:nth-child(even) td { background: #f8f9ff; }
    tr:last-child td { border-bottom: none; }

    /* Badges */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .badge-present { background: #e6fff5; color: #00875A; border: 1px solid #00E5A044; }
    .badge-absent  { background: #fff0f0; color: #CC0000; border: 1px solid #FF4D6D44; }
    .badge-repos   { background: #f0f0f0; color: #666; border: 1px solid #ccc; }

    /* Cards section */
    .section { margin-bottom: 16px; }
    .section-title { font-size: 13px; font-weight: 700; color: #1565C0; border-left: 3px solid #1565C0; padding-left: 8px; margin-bottom: 8px; }
    .kpi-row { display: flex; gap: 12px; margin-bottom: 12px; }
    .kpi-box { flex: 1; border: 1px solid #dde; border-radius: 6px; padding: 10px; text-align: center; }
    .kpi-val { font-size: 22px; font-weight: 900; color: #1565C0; }
    .kpi-lbl { font-size: 10px; color: #777; margin-top: 2px; }
    .note5s { display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 700; }

    /* Signatures */
    .signatures { display: flex; gap: 30px; margin-top: 30px; }
    .sig-box { flex: 1; border-top: 1px solid #333; padding-top: 6px; font-size: 10px; color: #555; }

    @media print {
      @page {
        size: ${landscape ? 'A4 landscape' : 'A4 portrait'};
        margin: 15mm;
      }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${html}
  </div>
  <script>
    window.onload = () => { window.print(); }
  </script>
</body>
</html>`);
    win.document.close();
  }
}
