// Minimal .xlsx writer (1.21.0, ADR-038): one worksheet of inline strings and numbers, no shared
// string table, built with fflate (already a platform dependency). Used for the DILG VIII SitRep
// export. The layout the caller passes is the whole point — keep the writer generic and small.
import { zipSync, strToU8 } from 'fflate';

export type XlsxCell = string | number | null;
export interface XlsxSheet {
  name: string;
  /** Column widths in characters, by position. */
  widths?: number[];
  rows: XlsxCell[][];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colRef = (i: number) => String.fromCharCode(65 + i); // A..Z — the SitRep layout stays well inside it

function sheetXml(sheet: XlsxSheet): string {
  if (sheet.rows.some((r) => r.length > 26)) throw new Error('The xlsx writer supports up to 26 columns.');
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rows = sheet.rows.map((r, ri) => {
    const cells = r.map((c, ci) => {
      if (c === null) return '';
      const ref = `${colRef(ci)}${ri + 1}`;
      return typeof c === 'number'
        ? `<c r="${ref}"><v>${c}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(c)}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

/** Build a single-sheet .xlsx workbook as bytes. */
export function xlsxBytes(sheet: XlsxSheet): Uint8Array {
  const name = esc(sheet.name.slice(0, 31)); // Excel sheet-name limit
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml(sheet)),
  };
  return zipSync(files);
}

/** Offer a workbook as a download in the browser. */
export function downloadXlsx(filename: string, sheet: XlsxSheet): void {
  const bytes = xlsxBytes(sheet);
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
