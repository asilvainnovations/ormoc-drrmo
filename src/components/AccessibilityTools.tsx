import { useEffect, useState } from 'react';
import { Accessibility, Contrast, Minus, Plus, RotateCcw, X } from 'lucide-react';
type Preferences={textScale:number;highContrast:boolean;dyslexiaFont:boolean;reducedMotion:boolean};
const defaults:Preferences={textScale:100,highContrast:false,dyslexiaFont:false,reducedMotion:false};
const KEY='mode-accessibility-preferences';
function read():Preferences{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)??'{}')}}catch{return defaults}}
export function AccessibilityTools(){
 const [open,setOpen]=useState(false);const [prefs,setPrefs]=useState<Preferences>(read);
 useEffect(()=>{const r=document.documentElement;r.style.setProperty('--a11y-scale',String(prefs.textScale/100));r.dataset.highContrast=String(prefs.highContrast);r.dataset.dyslexiaFont=String(prefs.dyslexiaFont);r.dataset.reduceMotion=String(prefs.reducedMotion);try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}},[prefs]);
 const update=(v:Partial<Preferences>)=>setPrefs(p=>({...p,...v}));
 return <><button type="button" aria-label="Open accessibility tools" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="fixed bottom-20 right-3 z-[55] inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold text-ink shadow-raised lg:bottom-5"><Accessibility aria-hidden className="h-5 w-5"/> Accessibility</button>
 {open&&<section role="dialog" aria-modal="false" aria-labelledby="a11y-title" className="fixed inset-x-3 bottom-36 z-[56] max-w-sm rounded-sheet border border-line bg-surface p-4 shadow-raised sm:left-auto sm:right-4 lg:bottom-20">
 <div className="mb-3 flex items-center justify-between"><h2 id="a11y-title" className="text-lg font-bold">Accessibility tools</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Close accessibility tools" className="min-h-10 min-w-10"><X aria-hidden/></button></div>
 <div className="space-y-4 text-sm"><div><p className="mb-2 font-semibold">Text size: {prefs.textScale}%</p><div className="flex gap-2"><button className="a11y-control" aria-label="Decrease text size" disabled={prefs.textScale<=90} onClick={()=>update({textScale:Math.max(90,prefs.textScale-5)})}><Minus/></button><button className="a11y-control" aria-label="Increase text size" disabled={prefs.textScale>=130} onClick={()=>update({textScale:Math.min(130,prefs.textScale+5)})}><Plus/></button></div></div>
 <label className="flex items-center gap-3"><input type="checkbox" checked={prefs.highContrast} onChange={e=>update({highContrast:e.target.checked})}/><Contrast/> Higher contrast</label>
 <label className="flex items-center gap-3"><input type="checkbox" checked={prefs.dyslexiaFont} onChange={e=>update({dyslexiaFont:e.target.checked})}/> Alternative readable font</label>
 <label className="flex items-center gap-3"><input type="checkbox" checked={prefs.reducedMotion} onChange={e=>update({reducedMotion:e.target.checked})}/> Reduce animation</label>
 <button className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-3 font-semibold" onClick={()=>setPrefs(defaults)}><RotateCcw/> Reset preferences</button>
 <p className="text-xs text-muted">These settings adjust visual presentation. They do not replace assistive technology or a formal accessibility audit.</p></div></section>}</>;
}
