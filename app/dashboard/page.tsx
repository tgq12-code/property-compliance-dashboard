"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Building2, CalendarDays, CheckCircle2, Clock3, Home, Landmark, ShieldCheck, UserCheck, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type Property = { id:string; name:string; city:string|null; state:string|null; escrowed:boolean; annual_property_tax:number|null };
type Business = { id:string; name:string; entity_type:string|null; state:string|null };
type Obligation = { id:string; title:string; due_date:string; status:string; amount_due:number|null; business_id:string|null; property_id:string|null };
type Reminder = { id:string; title:string; starts_at:string; active:boolean };
type UpcomingItem = { id:string; kind:"business"|"property"|"reminder"; title:string; date:string; amount:number|null; status:string };

const money=(n:number|null)=>n==null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
const dateLabel=(iso:string)=>new Date(iso.includes("T")?iso:`${iso}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const closedStatus=(status:string)=>["completed","paid","cancelled","canceled"].includes((status||"").toLowerCase());

export default function DashboardPage(){
  const router=useRouter();
  const supabase=useMemo(()=>createClient(),[]);
  const [ready,setReady]=useState(false);
  const [isAdmin,setIsAdmin]=useState(false);
  const [properties,setProperties]=useState<Property[]>([]);
  const [businesses,setBusinesses]=useState<Business[]>([]);
  const [obligations,setObligations]=useState<Obligation[]>([]);
  const [reminders,setReminders]=useState<Reminder[]>([]);
  const [updatingId,setUpdatingId]=useState<string|null>(null);

  useEffect(()=>{let active=true;(async()=>{
    for(let i=0;i<8;i++){
      const {data}=await supabase.auth.getSession();
      if(!active)return;
      if(data.session){
        const userId=data.session.user.id;
        const profile=await supabase.from("profiles").select("approved,is_admin").eq("id",userId).maybeSingle();
        if(!profile.data?.approved){await supabase.auth.signOut();router.replace("/");return;}
        setIsAdmin(Boolean(profile.data.is_admin));
        const [p,b,o,r]=await Promise.all([
          supabase.from("properties").select("id,name,city,state,escrowed,annual_property_tax").order("created_at",{ascending:false}),
          supabase.from("businesses").select("id,name,entity_type,state").order("created_at",{ascending:false}),
          supabase.from("obligations").select("id,title,due_date,status,amount_due,business_id,property_id").order("due_date",{ascending:true}),
          supabase.from("family_reminders").select("id,title,starts_at,active").eq("active",true).order("starts_at",{ascending:true})
        ]);
        setProperties((p.data??[]) as Property[]);
        setBusinesses((b.data??[]) as Business[]);
        setObligations((o.data??[]) as Obligation[]);
        setReminders((r.data??[]) as Reminder[]);
        setReady(true);
        return;
      }
      await new Promise(res=>setTimeout(res,200));
    }
    router.replace("/");
  })();return()=>{active=false};},[router,supabase]);

  async function markPaid(id:string){
    setUpdatingId(id);
    const {error}=await supabase.from("obligations").update({status:"paid",updated_at:new Date().toISOString()}).eq("id",id);
    if(!error)setObligations(current=>current.map(item=>item.id===id?{...item,status:"paid"}:item));
    setUpdatingId(null);
  }

  if(!ready)return <main className="min-h-screen bg-[#f4f7fb] p-8 text-sm text-slate-500">Loading your family dashboard...</main>;

  const today=new Date();
  const soon=new Date(today);soon.setDate(soon.getDate()+45);
  const directPay=properties.filter(p=>!p.escrowed).length;
  const escrowed=properties.filter(p=>p.escrowed).length;
  const upcomingObligations=obligations.filter(o=>{const d=new Date(`${o.due_date}T12:00:00`);return d>=today&&d<=soon&&!closedStatus(o.status);});
  const upcoming:UpcomingItem[]=[
    ...upcomingObligations.map(o=>({id:o.id,kind:(o.business_id?"business":"property") as "business"|"property",title:o.title,date:o.due_date,amount:o.amount_due,status:"Due soon"})),
    ...reminders.filter(r=>{const d=new Date(r.starts_at);return d>=today&&d<=soon;}).map(r=>({id:r.id,kind:"reminder" as const,title:r.title,date:r.starts_at,amount:null,status:"Reminder"}))
  ].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()).slice(0,8);
  const actionCount=upcoming.filter(item=>item.kind!=="reminder").length;

  return <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
    <section className="mx-auto max-w-[1380px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Family command center</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Here’s what needs attention.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Start here. If something needs action, it will show up first.</p>
        </div>
        {isAdmin&&<Link href="/admin/accounts" className="inline-flex items-center gap-2 rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700"><UserCheck size={16}/> Account approvals</Link>}
      </header>

      <section className={`overflow-hidden rounded-[28px] border-2 ${actionCount?"border-amber-300 bg-white":"border-emerald-300 bg-white"}`}>
        <div className={`flex flex-wrap items-center justify-between gap-4 border-b-2 px-5 py-5 sm:px-6 ${actionCount?"border-amber-200 bg-amber-50/70":"border-emerald-200 bg-emerald-50/70"}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${actionCount?"bg-amber-100 text-amber-700":"bg-emerald-100 text-emerald-700"}`}>{actionCount?<Clock3 size={20}/>:<CheckCircle2 size={20}/>}</div>
            <div><h2 className="text-lg font-semibold">Needs Your Attention</h2><p className="mt-1 text-sm text-slate-600">{actionCount?`${actionCount} item${actionCount===1?"":"s"} coming up in the next 45 days.`:"You’re all caught up right now."}</p></div>
          </div>
          <Link href="/reminders" className="text-sm font-semibold text-blue-700">Email settings →</Link>
        </div>
        <div className="divide-y-2 divide-slate-100">
          {upcoming.length===0?<div className="px-6 py-10 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={30}/><p className="mt-3 font-semibold">Nothing needs attention.</p><p className="mt-1 text-sm text-slate-500">We’ll surface upcoming taxes, filings and reminders here.</p></div>:upcoming.map(item=><div key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.kind==="business"?"bg-violet-50 text-violet-600":item.kind==="reminder"?"bg-blue-50 text-blue-600":"bg-sky-50 text-sky-600"}`}>{item.kind==="business"?<Building2 size={19}/>:item.kind==="reminder"?<BellRing size={19}/>:<Landmark size={19}/>}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.amount?money(item.amount):item.kind==="reminder"?"Family reminder":"Compliance deadline"}</p></div>
            <div className="text-right"><p className="text-sm font-semibold">{dateLabel(item.date)}</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.kind==="reminder"?"bg-blue-50 text-blue-700":"bg-amber-50 text-amber-700"}`}>{item.status}</span></div>
            {item.kind!=="reminder"&&<button onClick={()=>markPaid(item.id)} disabled={updatingId===item.id} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 size={15}/>{updatingId===item.id?"Saving...":"Mark paid"}</button>}
          </div>)}
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={WalletCards} label="You Pay" value={directPay} sub="Property taxes you handle" tone="blue" href="/properties"/>
        <Metric icon={ShieldCheck} label="Lender Pays" value={escrowed} sub="Impounded / escrowed" tone="green" href="/properties"/>
        <Metric icon={Building2} label="Businesses" value={businesses.length} sub="Entities being tracked" tone="violet" href="/businesses"/>
        <Metric icon={BellRing} label="Reminders" value={reminders.length} sub="Active family reminders" tone="amber" href="/reminders"/>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.95fr]">
        <section className="rounded-[28px] border-2 border-slate-300 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Properties</h2><p className="mt-1 text-sm text-slate-500">Your direct-pay properties appear first on the full page.</p></div><Link href="/properties" className="text-sm font-semibold text-blue-700">View all →</Link></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{properties.slice().sort((a,b)=>Number(a.escrowed)-Number(b.escrowed)).slice(0,6).map(p=><Link key={p.id} href="/properties" className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 transition hover:border-blue-300 hover:bg-blue-50/40"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{p.name}</p><p className="mt-1 text-xs text-slate-500">{[p.city,p.state].filter(Boolean).join(", ")}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${p.escrowed?"bg-emerald-100 text-emerald-800":"bg-sky-100 text-sky-800"}`}>{p.escrowed?"Lender pays":"You pay"}</span></div><div className="mt-4 flex items-end justify-between"><div><p className="text-[11px] uppercase tracking-wide text-slate-400">Annual tax</p><p className="mt-1 font-semibold">{money(p.annual_property_tax)}</p></div><span className="text-sm font-semibold text-blue-700">Open →</span></div></Link>)}</div>
        </section>

        <section className="rounded-[28px] border-2 border-slate-300 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold">Businesses</h2><p className="mt-1 text-sm text-slate-500">Quick access to entities and filings.</p></div><Building2 className="text-violet-600" size={20}/></div>
          <div className="mt-5 space-y-3">{businesses.length===0?<p className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-sm text-slate-500">No entities added yet.</p>:businesses.slice(0,5).map(b=><Link key={b.id} href="/businesses" className="block rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 hover:border-violet-300 hover:bg-violet-50/40"><p className="text-sm font-semibold">{b.name}</p><p className="mt-1 text-xs text-slate-500">{[b.entity_type,b.state].filter(Boolean).join(" · ")}</p></Link>)}</div>
          <Link href="/businesses" className="mt-5 flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Manage businesses</Link>
        </section>
      </div>
    </section>
  </main>;
}

function Metric({icon:Icon,label,value,sub,tone,href}:{icon:any;label:string;value:number;sub:string;tone:"blue"|"green"|"violet"|"amber";href:string}){
  const tones={blue:"bg-blue-50 text-blue-600 border-blue-200",green:"bg-emerald-50 text-emerald-600 border-emerald-200",violet:"bg-violet-50 text-violet-600 border-violet-200",amber:"bg-amber-50 text-amber-600 border-amber-200"};
  return <Link href={href} className="group rounded-[24px] border-2 border-slate-300 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tones[tone]}`}><Icon size={20}/></div><p className="mt-4 text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p><div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-slate-400">{sub}</p><span className="text-xs font-semibold text-blue-700 opacity-0 transition group-hover:opacity-100">Open →</span></div></Link>;
}
