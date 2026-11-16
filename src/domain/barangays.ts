// Current Ormoc City barangay masterlist checks, based on the supplied 85-barangay
// PSGC / boundary v1.3 reference (9 Nov 2026). Legacy historical source reports
// may still carry former numbered Poblacion names; those are aliases, not a reason
// to reject a correctly crosswalked current PSGC record.
export const ORMOC_BARANGAY_COUNT=85;
export const POBLACION_2022=['South','East','West','North'] as const;
export const ORMOC_REFERENCE_CROSSWALK: Readonly<Record<string,{psgc:string;name:string;legacyNames?:readonly string[]}>>={
 '0803738001':{psgc:'0803738001',name:'Alegria'},
 '0803738003':{psgc:'0803738003',name:'Labrador',legacyNames:['Labrador (Balion)','Balion']},
 '0803738018':{psgc:'0803738018',name:'Curva'},
 '0803738057':{psgc:'0803738057',name:'Lao'},
 '0803738059':{psgc:'0803738059',name:'Liloan'},
 '0803738060':{psgc:'0803738060',name:'Linao'},
 '0803738092':{psgc:'0803738092',name:'Airport'},
 '0803738099':{psgc:'0803738099',name:'Leondoni'},
};
export function checkBarangayList(rows:{psgc:string;name:string}[]):string[]{
 const warn:string[]=[];
 if(rows.length!==ORMOC_BARANGAY_COUNT)warn.push(`Ormoc has ${ORMOC_BARANGAY_COUNT} barangays in the supplied current PSGC reference. This list has ${rows.length}.`);
 const seen=new Set<string>(),dup=new Set<string>();
 for(const row of rows){if(seen.has(row.psgc))dup.add(row.psgc);seen.add(row.psgc);}
 if(dup.size)warn.push(`Repeated PSGC code: ${[...dup].slice(0,5).join(', ')}.`);
 const empty=rows.filter(r=>!r.psgc.trim()||!r.name.trim());
 if(empty.length)warn.push(`${empty.length} row(s) have a blank PSGC code or barangay name.`);
 const invalid=rows.filter(r=>r.psgc&&!/^0803738\d{3}$/.test(r.psgc));
 if(invalid.length)warn.push(`${invalid.length} row(s) have a PSGC code outside the Ormoc City 0803738xxx pattern.`);
 return warn;
}
export function resolveOrmocBarangay(psgc:string){return ORMOC_REFERENCE_CROSSWALK[psgc]??null;}
