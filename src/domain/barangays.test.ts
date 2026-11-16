import {describe,expect,it} from 'vitest';
import {checkBarangayList,ORMOC_BARANGAY_COUNT,resolveOrmocBarangay} from './barangays';
const current=[...['South','East','West','North'].map((n,i)=>({psgc:`08037380${90+i}`,name:`Barangay ${n}`})),...Array.from({length:ORMOC_BARANGAY_COUNT-4},(_,i)=>({psgc:`0803738${String(200+i).padStart(3,'0')}`,name:`Rural ${i}`}))];
describe('Ormoc barangay list check',()=>{
 it('accepts the supplied current 85-barangay PSGC list',()=>expect(checkBarangayList(current)).toEqual([]));
 it('does not misclassify historical aliases as current masterlist errors',()=>expect(checkBarangayList([{psgc:'0803738003',name:'Labrador (Balion)'}])).toHaveLength(1));
 it('flags repeated codes',()=>expect(checkBarangayList([...current.slice(0,84),current[0]!]).join(' ')).toMatch(/Repeated PSGC code/));
 it('resolves the eight validated first-reference crosswalks',()=>{
  expect(resolveOrmocBarangay('0803738057')?.name).toBe('Lao');
  expect(resolveOrmocBarangay('0803738060')?.name).toBe('Linao');
  expect(resolveOrmocBarangay('0803738003')?.legacyNames).toContain('Balion');
 });
});
