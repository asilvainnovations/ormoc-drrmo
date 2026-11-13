import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { xlsxBytes } from './xlsx';

describe('xlsxBytes', () => {
  it('builds a readable single-sheet workbook', () => {
    const bytes = xlsxBytes({
      name: 'SitRep No. 3',
      widths: [30, 60],
      rows: [
        ['CDRRMO Ormoc — SitRep No. 3', null],
        ['Period', '14 Nov 2026 6:00 AM to 6:00 PM'],
        ['Affected families', 125],
        ['Ampersand <test> & "quotes"', null],
      ],
    });
    const files = unzipSync(bytes);
    const names = Object.keys(files).sort();
    expect(names).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('<row r="3">');
    expect(sheet).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">Affected families</t></is></c>');
    expect(sheet).toContain('<c r="B3"><v>125</v></c>');
    expect(sheet).toContain('Ampersand &lt;test&gt; &amp; &quot;quotes&quot;');
    expect(strFromU8(files['xl/workbook.xml']!)).toContain('name="SitRep No. 3"');
    // Numbers stay numbers; blanks leave no cell.
    expect(sheet).not.toContain('NaN');
  });

  it('rejects layouts wider than 26 columns', () => {
    expect(() => xlsxBytes({ name: 'x', rows: [Array.from({ length: 27 }, () => 'y')] })).toThrow();
  });
});
