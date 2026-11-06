import { useEffect,useState } from 'react';
import { Download,X } from 'lucide-react';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed';platform:string}>};
export function InstallPrompt(){
 const [event,setEvent]=useState<InstallEvent|null>(null);const [installed,setInstalled]=useState(false);const [help,setHelp]=useState(false);
 useEffect(()=>{const onPrompt=(e:Event)=>{e.preventDefault();setEvent(e as InstallEvent)};const onInstalled=()=>{setInstalled(true);setEvent(null);setHelp(false)};
 window.addEventListener('beforeinstallprompt',onPrompt);window.addEventListener('appinstalled',onInstalled);
 setInstalled(window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
 return()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)}},[]);
 if(installed)return null;
 return <aside className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-sheet border border-line bg-surface p-3 shadow-raised lg:bottom-4 lg:right-4 lg:left-auto"><div className="flex items-start gap-3"><Download className="mt-1 h-5 w-5 shrink-0 text-action" aria-hidden/><div className="min-w-0 flex-1"><p className="font-semibold">Install MODE on this device</p><p className="text-sm text-muted">Open the Ormoc DRRM workspace from your home screen for an app-like experience.</p>
 {event?<button className="mt-2 min-h-11 rounded-control bg-action px-4 font-semibold text-white" onClick={async()=>{await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted')setEvent(null)}}>Install app</button>:<button className="mt-2 min-h-10 underline underline-offset-2" onClick={()=>setHelp(s=>!s)} aria-expanded={help}>Show installation instructions</button>}
 {help&&<div className="mt-2 space-y-1 text-sm"><p><strong>Android / Chromium:</strong> browser menu → Install app or Add to Home screen.</p><p><strong>iPhone / iPad:</strong> Safari → Share → Add to Home Screen.</p><p><strong>Desktop:</strong> use the install icon in the browser address bar when available.</p><p className="text-xs text-muted">Availability depends on browser, device and PWA requirements. Installation is optional.</p></div>}</div><button type="button" aria-label="Dismiss installation reminder" className="min-h-10 min-w-10" onClick={()=>setInstalled(true)}><X aria-hidden/></button></div></aside>;
}
