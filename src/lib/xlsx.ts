// Minimal .xlsx writer (1.21.0, ADR-038): one worksheet of inline strings and numbers, no shared
// string table, built with fflate (already a platform dependency). Used for the DILG VIII SitRep
// export. The layout the caller passes is the whole point — keep the writer generic and small.
import { zipSync, strToU8 } from 'fflate';

/** A formula cell (1.33.0): `f` is the formula without "=", for example `AVERAGE(B5,D5)`. Excel computes it on open. */
export interface XlsxFormula { f: string }
export type XlsxCell = string | number | null | XlsxFormula;
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
      if (typeof c === 'object') return `<c r="${ref}"><f>${esc(c.f)}</f></c>`;
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
  return xlsxWorkbookBytes([sheet]);
}

/** Build a workbook of several sheets (1.33.0, contingency plan templates). Sheet names must be unique (31 characters). */
export function xlsxWorkbookBytes(sheets: XlsxSheet[]): Uint8Array {
  if (!sheets.length) throw new Error('A workbook needs at least one sheet.');
  const names = sheets.map((s) => s.name.slice(0, 31));
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) throw new Error('Sheet names must be unique.');
  const ws = sheets.map((_, i) => i + 1);
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${ws.map((i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${ws.map((i) => `<sheet name="${esc(names[i - 1]!)}" sheetId="${i}" r:id="rId${i}"/>`).join('')}</sheets><calcPr fullCalcOnLoad="1"/></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ws.map((i) => `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')}</Relationships>`),
  };
  sheets.forEach((sh, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sh)); });
  return zipSync(files);
}

/** Offer a multi-sheet workbook as a download in the browser. */
export function downloadWorkbook(filename: string, sheets: XlsxSheet[]): void {
  const bytes = xlsxWorkbookBytes(sheets);
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Offer a workbook as a download in the browser. */
export function downloadXlsx(filename: string, sheet: XlsxSheet): void {
  const bytes = xlsxBytes(sheet);
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
