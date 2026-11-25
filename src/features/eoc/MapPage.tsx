/**
 * Geo-COP reference map gallery plus operational map. The operational MapLibre
 * workflow remains intact; the City-provided high-resolution cartographic
 * sheets are exposed as an offline-friendly reference library.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { currentReportWindow, latestPerBarangay } from '@/domain/eoc';
import { firstPoint, parseLayerFile, type ParsedLayer } from '@/domain/kml';
import { fmtDate, fmtDateTime } from '@/lib/time';
import { Badge, Button, Checkbox, ChoiceGroup, EmptyState, Field, Input, List, ListRow, Notice, PageHeader, Section, Select, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { GeoLayer, GeoLayerGroup, GeoPointKind, GeoReferencePoint } from '@/types';
import { ORMOC, basemapReady, baseStyle, ensureProtocol, plainStyle, token } from './map/base';
import { addLayer, addPoint, loadLayer, markOfficial, parseCoord, supersedeLayer, supersedePoint, verifyPoint } from './geo';
import { CONDITION, EOC_TABS, LAYER_GROUP, LAYER_VALIDATION, POINT_KIND, POINT_STATUS } from './labels';
import { CITY_REFERENCE_MAPS } from './map/referenceMaps';
import { HAZARD_MAPS } from './map/hazardMaps';
import { Slider } from '@/components/ui/slider';

const empty = { type: 'FeatureCollection' as const, features: [] as unknown[] };
const CONTEXT_REFERENCE_MAPS = CITY_REFERENCE_MAPS.filter((item) => ['zoning', 'slope', 'topography'].includes(item.id));


export default function MapPage() {
  const { has, userId } = useAuth();
  const toast = useToast();
  const canCapture = has('cdrrmo_head') || has('eoc_manager') || has('eoc_staff');
  const canLayer = canCapture || has('assessor');
  const canVerify = has('cdrrmo_head') || has('eoc_manager');
  const isHead = has('cdrrmo_head');
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [baseProblem, setBaseProblem] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [hz, setHz] = useState<Record<string, boolean>>({});
  const [opac, setOpac] = useState<Record<string, number>>({});
  const [show, setShow] = useState({ barangays: true, points: true });
  const [busy, setBusy] = useState(false);
  const [pointOpen, setPointOpen] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  const data = useLiveQuery(async () => {
    const points = (await db.geo_reference_points.toArray()).filter((p) => p.verification_status !== 'superseded');
    const layers = (await db.geo_layers.toArray()).filter((l) => l.status === 'current').sort((a,b) => a.layer_group.localeCompare(b.layer_group) || a.title.localeCompare(b.title));
    const barangays = await db.barangays.toArray();
    const window = currentReportWindow(await db.eoc_activations.toArray());
    const latest = new Map(latestPerBarangay(await db.barangay_reports.toArray(),window).map((r) => [r.barangay_psgc,r]));
    const offices = (await db.offices.toArray()).sort((a,b) => a.name.localeCompare(b.name));
    return {points,layers,barangays,latest,offices};
  }, []);
  const [hasBase,setHasBase] = useState<boolean|null>(null);
  useEffect(() => { void basemapReady().then((p) => {setBaseProblem(p);setHasBase(p===null);}); }, []);
  useEffect(() => {
    if (!box.current || hasBase===null) return;
    ensureProtocol();
    const m=new maplibregl.Map({container:box.current,style:hasBase?baseStyle():plainStyle(),center:ORMOC,zoom:12,attributionControl:{compact:true},cooperativeGestures:true});
    m.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    m.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
    m.on('error',(e)=>{if(/pmtiles|404|Failed to fetch|NetworkError/i.test(String(e.error?.message??'')))setBaseProblem('Part of the City basemap could not be read.');});
    m.on('load',()=>{
      // Hazard sheets (ADR-028): georeferenced images, hidden until switched on, drawn under the operational dots.
      for(const hm of [...HAZARD_MAPS].reverse()){m.addSource(`hz-${hm.code}`,{type:'image',url:hm.file,coordinates:hm.corners});m.addLayer({id:`hz-${hm.code}`,type:'raster',source:`hz-${hm.code}`,layout:{visibility:'none'},paint:{'raster-opacity':0.75,'raster-fade-duration':0}});}
      m.addSource('barangays',{type:'geojson',data:empty as never});
      m.addLayer({id:'barangays',type:'circle',source:'barangays',paint:{'circle-radius':5,'circle-stroke-width':1,'circle-stroke-color':token('surface'),'circle-color':['match',['get','condition'],'isolated',token('bad'),'affected',token('warn'),'evacuating',token('warn'),'monitoring',token('info'),token('muted')]}});
      m.addSource('points',{type:'geojson',data:empty as never});
      m.addLayer({id:'points',type:'circle',source:'points',paint:{'circle-radius':9,'circle-stroke-width':3,'circle-color':token('action'),'circle-stroke-color':['case',['==',['get','status'],'field_verified'],token('ok'),token('warn')]}});
      if(hasBase)m.addLayer({id:'points-label',type:'symbol',source:'points',layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':13,'text-offset':[0,1.4],'text-anchor':'top'},paint:{'text-color':token('ink'),'text-halo-color':token('surface'),'text-halo-width':1.5}});
      const popup=(id:string,html:(p:Record<string,string>)=>string)=>m.on('click',id,(e)=>{const f=e.features?.[0];if(!f)return;const el=document.createElement('div');el.className='text-sm text-ink';el.textContent=html(f.properties as Record<string,string>);new maplibregl.Popup({closeButton:true}).setLngLat(e.lngLat).setDOMContent(el).addTo(m);});
      popup('points',(p)=>`${p.name}: ${POINT_STATUS[p.status as keyof typeof POINT_STATUS]??''}`);
      popup('barangays',(p)=>`${p.name}${p.condition?`: ${CONDITION[p.condition as keyof typeof CONDITION]}`:''}`);
      setReady(true);
    });
    map.current=m;
    return()=>{m.remove();map.current=null;setReady(false);};
  },[hasBase]);
  const pointsFc=useMemo(()=>({type:'FeatureCollection',features:(data?.points??[]).map((p)=>({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{name:p.name,status:p.verification_status}}))}),[data?.points]);
  const brgyFc=useMemo(()=>({type:'FeatureCollection',features:(data?.barangays??[]).filter((b)=>b.lat!==null&&b.lng!==null).map((b)=>({type:'Feature',geometry:{type:'Point',coordinates:[b.lng,b.lat]},properties:{name:b.name,condition:data?.latest.get(b.psgc)?.condition??''}}))}),[data?.barangays,data?.latest]);
  useEffect(()=>{if(ready)(map.current?.getSource('points') as GeoJSONSource|undefined)?.setData(pointsFc as never);},[ready,pointsFc]);
  useEffect(()=>{if(ready)(map.current?.getSource('barangays') as GeoJSONSource|undefined)?.setData(brgyFc as never);},[ready,brgyFc]);
  useEffect(()=>{const m=map.current;if(!ready||!m)return;for(const hm of HAZARD_MAPS){const id=`hz-${hm.code}`;if(!m.getLayer(id))continue;m.setLayoutProperty(id,'visibility',hz[hm.code]?'visible':'none');m.setPaintProperty(id,'raster-opacity',(opac[hm.code]??75)/100);}},[ready,hz,opac]);
  useEffect(()=>{const m=map.current;if(!ready||!m)return;for(const id of ['barangays'])if(m.getLayer(id))m.setLayoutProperty(id,'visibility',show.barangays?'visible':'none');for(const id of ['points','points-label'])if(m.getLayer(id))m.setLayoutProperty(id,'visibility',show.points?'visible':'none');},[ready,show]);
  const toggleLayer=async(l:GeoLayer)=>{
    const m=map.current;if(!m||!ready)return;const id=`layer-${l.id}`;
    if(shown[l.id]){for(const suffix of ['-fill','-line','-pt'])if(m.getLayer(id+suffix))m.removeLayer(id+suffix);if(m.getSource(id))m.removeSource(id);setShown(s=>({...s,[l.id]:false}));return;}
    setBusy(true);try{const gj=await loadLayer(l);m.addSource(id,{type:'geojson',data:gj as never});const c=l.layer_group==='hazard'?token('bad'):l.layer_group==='evacuation'?token('ok'):token('info');
      m.addLayer({id:`${id}-fill`,type:'fill',source:id,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':c,'fill-opacity':0.25}},'barangays');
      m.addLayer({id:`${id}-line`,type:'line',source:id,filter:['in',['geometry-type'],['literal',['LineString','Polygon']]],paint:{'line-color':c,'line-width':2}},'barangays');
      m.addLayer({id:`${id}-pt`,type:'circle',source:id,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':c,'circle-radius':5,'circle-stroke-width':1,'circle-stroke-color':token('surface')}},'barangays');
      const [w,so,ea,n]=l.bbox??[];if(w!==undefined&&so!==undefined&&ea!==undefined&&n!==undefined)m.fitBounds([[w,so],[ea,n]],{padding:40,maxZoom:15});setShown(s=>({...s,[l.id]:true}));
    }catch(e){toast((e as Error).message,'bad');}finally{setBusy(false);}
  };
  const flyTo=(p:GeoReferencePoint)=>map.current?.flyTo({center:[p.lng,p.lat],zoom:16});
  const authority=async(fn:()=>Promise<unknown>,done:string)=>{setBusy(true);try{await fn();toast(done);}catch(e){toast((e as Error).message,'bad');}finally{setBusy(false);}};
  return <div className="page space-y-5">
    <PageHeader title="Geo-COP Map" subtitle="The common operating picture: City hazard-map references, EOC reference points, barangay status and validated GIS layers." />
    <Tabs items={EOC_TABS}/>
    {baseProblem&&<Notice tone="warn" title="Basemap not available">{baseProblem} Hazard sheets and points still load where possible.</Notice>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <div ref={box} className="h-[68vh] min-h-[24rem] w-full overflow-hidden rounded-control border border-line bg-sunken" role="region" aria-label="Interactive Geo-COP map of Ormoc City"/>
        <p className="mt-2 text-xs text-muted">Hazard sheets are the City's source maps placed on the map; each shows its own legend and source. Ring colour on points: green field-verified, ochre pending. Barangay dots show the latest report in this event. WGS 84 (EPSG:4326).</p>
      </div>
      <aside aria-label="Map layers" className="space-y-4 rounded-sheet border border-line bg-surface p-4 shadow-raised lg:max-h-[68vh] lg:overflow-y-auto">
        <div>
          <h2 className="mb-2 text-lg font-extrabold">Hazard maps</h2>
          <ul className="space-y-3">{HAZARD_MAPS.map((h)=><li key={h.code}>
            <Checkbox checked={!!hz[h.code]} onChange={()=>setHz((o)=>({...o,[h.code]:!o[h.code]}))} tip={h.note??`${h.source}. Fit error about ${h.accuracy_m} m.`}><span className="font-semibold">{h.title}</span></Checkbox>
            {hz[h.code]&&<div className="mt-2 space-y-2 pl-7">
              <div className="flex items-center gap-2"><span className="w-14 text-xs text-muted">Opacity</span><Slider value={[opac[h.code]??75]} min={10} max={100} step={5} thumbLabel={`Opacity of ${h.title}`} thumbTip="Drag to make the sheet more or less see-through" onValueChange={([v])=>setOpac((o)=>({...o,[h.code]:v!}))}/><span className="w-9 text-right text-xs tabular-nums">{opac[h.code]??75}%</span></div>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{h.legend.map((l)=><li key={l.label} className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-line" style={{background:l.color}}/>{l.label}</li>)}</ul>
            </div>}
          </li>)}</ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-extrabold">City reference layers</h2>
          <p className="mb-2 text-xs text-muted">Zoning, slope and topography are supplied here as static reference sheets, not georeferenced overlays. Open the full-resolution sheet to inspect its original legend, scale and date. Confirm zoning with CPDO and terrain interpretation with the responsible technical office before operational or site decisions.</p>
          <ul className="space-y-3">{CONTEXT_REFERENCE_MAPS.map((item)=><li key={item.id} className="rounded-control border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="font-semibold">{item.title}</p><p className="text-xs text-muted">{item.description}</p></div>
              <a href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-tap items-center rounded-control border border-line px-3 text-sm font-semibold hover:bg-sky-soft" aria-label={`Open full resolution ${item.title}`}>Open sheet</a>
            </div>
            <p className="mt-2 text-xs text-muted">{item.caution}</p>
          </li>)}</ul>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-extrabold">Operations</h2>
          <ul className="space-y-2">
            <li><Checkbox checked={show.barangays} onChange={()=>setShow((o)=>({...o,barangays:!o.barangays}))} tip="Dots for each barangay coloured by its latest report">Barangay status</Checkbox></li>
            <li><Checkbox checked={show.points} onChange={()=>setShow((o)=>({...o,points:!o.points}))} tip="EOC, staging areas and other reference points">Reference points</Checkbox></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-extrabold">Uploaded layers</h2>{canLayer&&<Button tip="Add a KML, KMZ or GeoJSON map layer" variant="secondary" onClick={()=>setLayerOpen(true)}>Add</Button>}</div>
          {(data?.layers??[]).length===0?<p className="text-sm text-muted">None yet. Add a KML, KMZ or GeoJSON file.</p>:<ul className="space-y-2">{data!.layers.map((l)=><li key={l.id}><Checkbox tip={shown[l.id]?'Hide this layer':'Show this layer on the map'} checked={!!shown[l.id]} onChange={()=>void toggleLayer(l)}><span className="font-semibold">{l.title}</span></Checkbox><span className="block pl-7 text-xs text-muted">{LAYER_GROUP[l.layer_group]}. {l.source}{l.issued_on?`, ${fmtDate(l.issued_on)}`:''}. {l.feature_count??0} features.</span><span className="flex flex-wrap items-center gap-1 pl-7 pt-1"><Badge tone={l.validation_status==='official'?'ok':l.validation_status==='field_verified'?'info':'warn'}>{LAYER_VALIDATION[l.validation_status]}</Badge>{l.access_class==='restricted'&&<Badge>Restricted</Badge>}{isHead&&l.validation_status!=='official'&&<Button tip="Mark as official City dataset" variant="quiet" disabled={busy} onClick={()=>authority(()=>markOfficial(l),`${l.title} marked official`)}>Mark official</Button>}{canVerify&&<Button tip="Supersede this layer" variant="quiet" disabled={busy} onClick={()=>authority(()=>supersedeLayer(l),`${l.title} superseded`)}>Supersede</Button>}</span></li>)}</ul>}
        </div>
      </aside>
    </div>
    <Section title="Reference Points" action={canCapture&&<Button tip="Add a reference point from a KML file or coordinates" variant="secondary" onClick={()=>setPointOpen(true)}>Add point</Button>}>
      {(data?.points??[]).length===0?<EmptyState title="No reference points yet" body="The EOC point arrives with the EOC structure data (operational file 06)."/>:<List>{data!.points.map((p)=><ListRow key={p.id} tip="Centre the map on this point" onClick={()=>flyTo(p)} title={`${p.name} (${POINT_KIND[p.kind]})`} meta={`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}. ${p.source}.${p.verified_at?` Verified ${fmtDateTime(p.verified_at)}.`:''}`} trailing={<Badge tone={p.verification_status==='field_verified'?'ok':'warn'}>{POINT_STATUS[p.verification_status]}</Badge>}/>)}</List>}
      {canVerify&&(data?.points??[]).some((p)=>p.verification_status==='pending_field_validation')&&<div className="mt-3 space-y-2">{data!.points.filter((p)=>p.verification_status==='pending_field_validation').map((p)=><div key={p.id} className="flex flex-wrap items-center gap-2 text-sm"><span className="min-w-0 flex-1">{p.name}: after checking on site (EOC-GIS-REF),</span><Button tip="Record field verification" disabled={busy} onClick={()=>authority(()=>verifyPoint(p),`${p.name} field-verified`)}>Record field verification</Button><Button tip="Mark this point as replaced" variant="quiet" disabled={busy} onClick={()=>authority(()=>supersedePoint(p),`${p.name} superseded`)}>Supersede</Button></div>)}</div>}
    </Section>
    <details className="rounded-sheet border border-line bg-surface p-4"><summary className="cursor-pointer text-sm font-bold">City source map sheets (full resolution)</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{CITY_REFERENCE_MAPS.map((item)=><a key={item.id} href={item.href} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-control border border-line bg-surface hover:border-sky"><div className="aspect-[4/3] bg-sunken"><img src={item.href} alt={`${item.title}, Ormoc City`} loading="lazy" decoding="async" className="h-full w-full object-contain"/></div><div className="p-3 text-sm font-semibold">{item.title}</div></a>)}</div>
    </details>
    <PointSheet open={pointOpen} onClose={()=>setPointOpen(false)} onSave={async(p)=>{await addPoint(p,userId);setPointOpen(false);toast(`Point added: ${p.name}`);}}/>
    <LayerSheet open={layerOpen} onClose={()=>setLayerOpen(false)} offices={data?.offices??[]} onSave={async(meta,parsed,file)=>{await addLayer(meta,parsed,file,userId);setLayerOpen(false);toast(`Layer added: ${meta.title}`);}}/>
  </div>;
}

const KINDS:GeoPointKind[]=['eoc','alternate_eoc','opcen','icp','staging','evacuation_hub','other'];
function PointSheet({open,onClose,onSave}:{open:boolean;onClose:()=>void;onSave:(p:{code:string;name:string;kind:GeoPointKind;lat:number;lng:number;altitude_m:number|null;source:string;note:string|null})=>Promise<void>}){
  const [f,setF]=useState({code:'',name:'',kind:'other' as GeoPointKind,lat:'',lng:'',alt:'',source:'',note:''});const [problem,setProblem]=useState<string|null>(null);
  const fromFile=async(file:File|undefined)=>{if(!file)return;try{const pt=firstPoint(await parseLayerFile(file));if(!pt){setProblem('The file has no point in it.');return;}setF(x=>({...x,name:x.name||pt.name,lat:String(pt.lat),lng:String(pt.lng),alt:pt.altitude===null?'':String(pt.altitude),source:x.source||`KML file ${file.name}`}));setProblem(null);}catch(e){setProblem((e as Error).message);}};
  const save=async()=>{const lat=parseCoord(f.lat,90),lng=parseCoord(f.lng,180),code=f.code.trim().toUpperCase();if(!/^[A-Z][A-Z0-9-]{1,30}$/.test(code)){setProblem('Use a code such as EOC-ALT-1.');return;}if(!f.name.trim()||!f.source.trim()){setProblem('Give the name and source of the coordinates.');return;}if(lat===null||lng===null){setProblem('Enter latitude and longitude in decimal degrees.');return;}const alt=f.alt.trim()===''?null:Number(f.alt);await onSave({code,name:f.name.trim(),kind:f.kind,lat,lng,altitude_m:alt!==null&&Number.isFinite(alt)?alt:null,source:f.source.trim(),note:f.note.trim()||null});setF({code:'',name:'',kind:'other',lat:'',lng:'',alt:'',source:'',note:''});};
  return <Sheet open={open} onClose={onClose} title="Add a reference point" footer={<><Button tip="Cancel" variant="secondary" onClick={onClose}>Cancel</Button><Button tip="Save as pending field validation" onClick={save}>Add point</Button></>}>
    <Field label="Read from a KML or KMZ file" optional>{(id,d)=><Input id={id} aria-describedby={d} type="file" accept=".kml,.kmz,.geojson,.json" onChange={e=>void fromFile(e.target.files?.[0])}/>}</Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Code">{(id,d)=><Input id={id} aria-describedby={d} value={f.code} onChange={e=>setF({...f,code:e.target.value})}/>}</Field><Field label="Name">{(id,d)=><Input id={id} aria-describedby={d} value={f.name} onChange={e=>setF({...f,name:e.target.value})}/>}</Field></div>
    <Field label="Kind">{(id,d)=><Select id={id} aria-describedby={d} value={f.kind} onChange={e=>setF({...f,kind:e.target.value as GeoPointKind})}>{KINDS.map(k=><option key={k} value={k}>{POINT_KIND[k]}</option>)}</Select>}</Field>
    <div className="grid gap-3 sm:grid-cols-3"><Field label="Latitude">{(id,d)=><Input id={id} aria-describedby={d} inputMode="decimal" value={f.lat} onChange={e=>setF({...f,lat:e.target.value})}/>}</Field><Field label="Longitude">{(id,d)=><Input id={id} aria-describedby={d} inputMode="decimal" value={f.lng} onChange={e=>setF({...f,lng:e.target.value})}/>}</Field><Field label="Altitude (m)" optional>{(id,d)=><Input id={id} aria-describedby={d} value={f.alt} onChange={e=>setF({...f,alt:e.target.value})}/>}</Field></div>
    <Field label="Source">{(id,d)=><Input id={id} aria-describedby={d} value={f.source} onChange={e=>setF({...f,source:e.target.value})}/>}</Field><Field label="Note" optional error={problem}>{(id,d)=><Textarea id={id} aria-describedby={d} rows={2} value={f.note} onChange={e=>setF({...f,note:e.target.value})}/>}</Field>
  </Sheet>;
}
const GROUPS:GeoLayerGroup[]=['hazard','evacuation','admin_boundaries','critical_facilities','lifelines','resources','population_exposure','eoc_facilities','incident'];
function LayerSheet({open,onClose,offices,onSave}:{open:boolean;onClose:()=>void;offices:{id:string;name:string}[];onSave:(meta:Parameters<typeof addLayer>[0],parsed:ParsedLayer,file:File)=>Promise<void>}){
  const blank={title:'',layer_group:'hazard' as GeoLayerGroup,source:'',custodian_office_id:'',issued_on:'',validation_status:'preliminary' as 'reported'|'preliminary'|'field_verified',access_class:'internal' as 'internal'|'restricted',scale:'',update_frequency:'',note:''};
  const [f,setF]=useState(blank),[file,setFile]=useState<File|null>(null),[parsed,setParsed]=useState<ParsedLayer|null>(null),[problem,setProblem]=useState<string|null>(null),[saving,setSaving]=useState(false);
  const pick=async(fl:File|undefined)=>{setParsed(null);setFile(null);setProblem(null);if(!fl)return;try{const p=await parseLayerFile(fl);setParsed(p);setFile(fl);if(!f.title)setF(x=>({...x,title:fl.name.replace(/\.[^.]+$/,'')}));}catch(e){setProblem((e as Error).message);}};
  const save=async()=>{if(!file||!parsed){setProblem('Choose a KML, KMZ or GeoJSON file.');return;}if(parsed.featureCount===0){setProblem('The file has no features to show.');return;}if(f.title.trim().length<3||!f.source.trim()){setProblem('Give the layer a title and source.');return;}setSaving(true);try{await onSave({title:f.title.trim(),layer_group:f.layer_group,source:f.source.trim(),custodian_office_id:f.custodian_office_id||null,issued_on:f.issued_on||null,validation_status:f.validation_status,access_class:f.access_class,scale:f.scale.trim()||null,update_frequency:f.update_frequency.trim()||null,note:f.note.trim()||null},parsed,file);setF(blank);setFile(null);setParsed(null);}catch(e){setProblem((e as Error).message);}finally{setSaving(false);}};
  return <Sheet open={open} onClose={onClose} title="Add a map layer" footer={<><Button tip="Cancel" variant="secondary" onClick={onClose}>Cancel</Button><Button tip="Save map layer" disabled={saving} onClick={save}>Add layer</Button></>}>
    <Field label="File" hint="KML, KMZ or GeoJSON in WGS 84 (EPSG:4326), up to 50 MB.">{(id,d)=><Input id={id} aria-describedby={d} type="file" accept=".kml,.kmz,.geojson,.json" onChange={e=>void pick(e.target.files?.[0])}/>}</Field>
    {parsed&&<Notice tone={parsed.warnings.length?'warn':'ok'} title={`${parsed.featureCount} features read`}>{parsed.warnings.join(' ')||'Ready to add.'}</Notice>}
    <Field label="Title">{(id,d)=><Input id={id} aria-describedby={d} value={f.title} onChange={e=>setF({...f,title:e.target.value})}/>}</Field><Field label="Group">{(id,d)=><Select id={id} aria-describedby={d} value={f.layer_group} onChange={e=>setF({...f,layer_group:e.target.value as GeoLayerGroup})}>{GROUPS.map(g=><option key={g} value={g}>{LAYER_GROUP[g]}</option>)}</Select>}</Field>
    <Field label="Source">{(id,d)=><Input id={id} aria-describedby={d} value={f.source} onChange={e=>setF({...f,source:e.target.value})}/>}</Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Custodian office" optional>{(id,d)=><Select id={id} aria-describedby={d} value={f.custodian_office_id} onChange={e=>setF({...f,custodian_office_id:e.target.value})}><option value="">Not set</option>{offices.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</Select>}</Field><Field label="Issued" optional>{(id,d)=><Input id={id} aria-describedby={d} type="date" value={f.issued_on} onChange={e=>setF({...f,issued_on:e.target.value})}/>}</Field><Field label="Scale" optional>{(id,d)=><Input id={id} aria-describedby={d} value={f.scale} onChange={e=>setF({...f,scale:e.target.value})}/>}</Field><Field label="Update frequency" optional>{(id,d)=><Input id={id} aria-describedby={d} value={f.update_frequency} onChange={e=>setF({...f,update_frequency:e.target.value})}/>}</Field></div>
    <ChoiceGroup legend="How far it has been checked" value={f.validation_status} columns={3} onChange={v=>setF({...f,validation_status:v})} hint="Only the CDRRMO Head marks a layer as the official dataset after review." options={(['reported','preliminary','field_verified'] as const).map(v=>({value:v,label:LAYER_VALIDATION[v],tip:`Mark the layer ${LAYER_VALIDATION[v].toLowerCase()}`}))}/>
    <ChoiceGroup legend="Who may open it" value={f.access_class} columns={2} onChange={v=>setF({...f,access_class:v})} options={[{value:'internal',label:'All app users'},{value:'restricted',label:'EOC roles only'}]}/>
    <Field label="Note" optional error={problem}>{(id,d)=><Textarea id={id} aria-describedby={d} rows={2} value={f.note} onChange={e=>setF({...f,note:e.target.value})}/>}</Field>
  </Sheet>;
}
