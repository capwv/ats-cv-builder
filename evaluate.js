/* SIRA ATS Check — client-side CV evaluation. No backend; file never leaves the device. */
'use strict';
const STOPWORDS = new Set('a an the and for with you your are will this that from have has our their they them who can all any per etc job role work team skills experience years plus strong ability knowledge including other about into across within such well must new we looking requirements seeking candidate responsibilities nice ideal preferred bonus familiarity of to in on is be as at by or it its if so us do does not no off up out over more most than then too very just also may might would could should'.split(' '));
const IRR={built:'build',led:'lead',ran:'run',wrote:'write',made:'make',grew:'grow',taught:'teach',won:'win',sold:'sell',held:'hold',met:'meet',took:'take',gave:'give',did:'do',spoke:'speak',drove:'drive',driven:'drive',written:'write',known:'know',shown:'show',brought:'bring',bought:'buy',caught:'catch',sought:'seek',sent:'send',spent:'spend',meant:'mean',kept:'keep',lost:'lose',paid:'pay'};
function stem(w){
  if(IRR[w]) w=IRR[w];
  if(w.length<=4) return w;
  let s=w;
  if(/ies$/.test(s)) s=s.slice(0,-3)+'y';
  else s=s.replace(/(izations?|isations?|ations?|ing|ed|es|s)$/,'');
  if(s.length>4) s=s.replace(/(ment|er)$/,'');
  if(s.length>4 && /[^aeiou]e$/.test(s)) s=s.slice(0,-1);
  if(/([bcdfghjklmnpqrstvwxz])\1$/.test(s)) s=s.slice(0,-1);
  return s;
}
function tokenize(t){
  return (String(t||'').toLowerCase().match(/\.net\b|c\+\+|c#|[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*/g)||[]).filter(w=>!STOPWORDS.has(w));
}
function esc(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(msg){ const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',2200); }
const AR_RE=/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/* ---- file extraction (same libraries as the builder) ---- */
async function loadImportLibrary(name,src){
  if(window[name]) return;
  await new Promise((res,rej)=>{ const sc=document.createElement('script'); sc.src=src; sc.onload=res; sc.onerror=rej; document.head.appendChild(sc); });
}
async function extractCVFile(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['pdf','docx','txt'].includes(ext)) throw new Error('type');
  if(file.size>10*1024*1024) throw new Error('size');
  const bytes=await file.arrayBuffer();
  if(ext==='txt') return new TextDecoder().decode(bytes);
  if(ext==='docx'){
    await loadImportLibrary('mammoth','https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
    return (await mammoth.extractRawText({arrayBuffer:bytes})).value;
  }
  if(!window.pdfjsLib) window.pdfjsLib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;
  try{
    if(pdf.numPages>20) throw new Error('pages');
    const pages=[];
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i), content=await page.getTextContent();
      let previousY=null, line='', lines=[];
      for(const item of content.items){
        if(!item.str) continue;
        const y=item.transform[5];
        if(previousY!==null && Math.abs(y-previousY)>4){lines.push(line);line='';}
        line+=(line?' ':'')+item.str; previousY=y;
        if(item.hasEOL){lines.push(line);line='';previousY=null;}
      }
      if(line) lines.push(line); pages.push(lines.join('\n'));
    }
    return pages.join('\n\n');
  }finally{await pdf.destroy();}
}

/* ---- evaluation heuristics ---- */
const SECTION_PATTERNS={
  summary:/^(professional\s+)?(summary|profile|objective|about)\b/,
  education:/^(education|academic)\b/,
  experience:/^(work\s+)?(experience|employment|internship|work history)\b/,
  projects:/^(personal\s+|selected\s+)?projects\b/,
  skills:/^((technical|core|key)\s+)?(skills|technologies|tech stack)\b/,
  certs:/^(certifications?|courses|certificates|training)\b/,
  langs:/^languages?\b/
};
const ACTION_VERBS=['developed','built','created','designed','implemented','managed','led','improved','increased','reduced','analyzed','launched','achieved','collaborated','automated','optimized','delivered','coordinated','researched','tested','deployed','engineered','organized','presented','trained'];

function findSections(text){
  const found={};
  for(const raw of text.split('\n')){
    const line=raw.trim().toLowerCase().replace(/[:\-–—|]+$/,'').trim();
    if(!line||line.length>45) continue;
    for(const key of Object.keys(SECTION_PATTERNS)){
      if(!found[key] && SECTION_PATTERNS[key].test(line)) found[key]=true;
    }
  }
  return found;
}

function evaluateCV(text,jdText){
  const checks=[];
  const add=(group,ok,pts,fix,sev)=>checks.push({group,ok,pts,fix,sev:sev||(ok?'ok':'bad')});
  const words=text.split(/\s+/).filter(Boolean);
  const nWords=words.length;
  const lines=text.split('\n');
  const sec=findSections(text);

  /* contact */
  const hasEmail=/[^\s@]+@[^\s@]+\.[^\s@]{2,}/.test(text);
  add('contact',hasEmail,8,'مفيش إيميل واضح في الـ CV — اكتبه في أول سطر، من غيره الشركة مش هتعرف ترد عليك');
  const phoneM=text.match(/\+?\d[\d\s().-]{7,}\d/);
  const hasPhone=!!phoneM && phoneM[0].replace(/\D/g,'').length>=8;
  add('contact',hasPhone,6,'ضيف رقم موبايل واضح بالأرقام الإنجليزية (01xxxxxxxxx)');
  const hasLinked=/linkedin/i.test(text)||/github/i.test(text)||/behance|kaggle|portfolio/i.test(text);
  add('contact',hasLinked,4,'ضيف لينك LinkedIn أو GitHub — بيعزز ثقة الـ recruiter وبيعلّي الترتيب','warn');
  const firstLine=(lines.find(l=>l.trim().length>2)||'').trim();
  const nameOK=firstLine.length>=3 && firstLine.length<=60 && !/@|\d{6,}/.test(firstLine) && firstLine.split(/\s+/).length<=6 && !AR_RE.test(firstLine);
  add('contact',nameOK,2,'خلي أول سطر في الـ CV هو اسمك بالإنجليزي — الـ ATS بيقراه كاسم صاحب الملف','warn');

  /* sections */
  add('sections',!!sec.summary,6,'ضيف قسم Summary أو Objective في أول الـ CV — أهم 3 سطور بيقراهم الـ ATS والـ recruiter');
  add('sections',!!sec.education,6,'ضيف قسم Education بعنوان إنجليزي واضح: الجامعة والتخصص وسنين الدراسة');
  add('sections',!!(sec.experience||sec.projects),8,'ضيف قسم Experience أو Projects بعنوان واضح — دي أثقل حاجة عند أي نظام فرز');
  add('sections',!!sec.skills,6,'ضيف قسم Skills بعنوان واضح فيه مهاراتك الحقيقية — الـ ATS بيطابق عليها');
  add('sections',!!(sec.certs||sec.langs),2,'ضيف قسم Certifications أو Languages لو عندك — خانات زيادة بتقوّي الملف','warn');

  /* content */
  const lower=text.toLowerCase();
  const verbHits=ACTION_VERBS.filter(v=>new RegExp('\\b'+v,'i').test(lower));
  add('content',verbHits.length>=3,6,'ابدأ كل نقطة خبرة بفعل قوي زي Developed أو Built أو Led — الأفعال دي بتوزن عند الـ ATS');
  const hasQuant=/\d+\s*%|\d+\+|\$\s?\d|\b\d{2,}\b/.test(text);
  add('content',hasQuant,6,'ضيف أرقام ونتايج ملموسة (٪ أو عدد مستخدمين أو مشاريع) — الأرقام بتحبها أنظمة الـ ATS');
  const hasDates=/(20|19)\d{2}\s*[-–—]\s*((20|19)\d{2}|present|current|now)/i.test(text)||/\b(20|19)\d{2}\b.*\b(20|19)\d{2}\b/.test(text);
  add('content',hasDates,5,'اكتب سنين واضحة جنب كل خبرة وتعليم (مثلًا 2023 - 2027) — النظام بيحسب بيها مدة الخبرة');
  const bulletCount=(text.match(/^\s*[•\-\*▪◦]\s+\S/gm)||[]).length;
  add('content',bulletCount>=3,5,'نظّم الخبرات والمشاريع بنقط (bullets) مش فقرات طويلة — أسهل في القراءة للنظام وللبني آدم');
  add('content',!AR_RE.test(text),4,'الـ CV فيه كلام بالعربي — أنظمة الـ ATS بتتلخبط فيه، خلّي الملف كله إنجليزي');

  /* format & length */
  const inRange=nWords>=180&&nWords<=750, nearRange=nWords>=120&&nWords<=950;
  add('format',inRange||nearRange,8,nWords<180?'الـ CV قصير أوي ('+nWords+' كلمة) — ضيف تفاصيل في الخبرات والمهارات':(nWords>750?'الـ CV طويل ('+nWords+' كلمة) — خلّيه صفحة واحدة للطلبة وحديثي التخرج':''),
    inRange?'ok':'warn');
  const longLines=lines.filter(l=>l.trim().length>140).length;
  add('format',longLines<=2,3,'فيه سطور طويلة جدًا — غالبًا التنسيق فيه جدول أو عمودين، والـ ATS بيلخبط ترتيبها','warn');
  const pipeLines=lines.filter(l=>(l.match(/\|/g)||[]).length>=2).length;
  add('format',pipeLines<=1,3,'شكل الملف فيه جداول أو أعمدة (علامات | كتير) — استبدلها بتنسيق عمود واحد بسيط','warn');

  /* JD keyword match or general depth */
  let missing=[],kwPct=null,hasJD=false;
  const jdTerms=[...new Set(tokenize(jdText))];
  if(jdTerms.length>0){
    hasJD=true;
    const cvStems=new Set(tokenize(text).map(stem));
    const seen=new Set(), top=[];
    jdTerms.forEach(w=>{ const sw=stem(w); if(!seen.has(sw)){ seen.add(sw); top.push(w); } });
    const capped=top.slice(0,60);
    const hits=capped.filter(w=>cvStems.has(stem(w)));
    missing=capped.filter(w=>!cvStems.has(stem(w))).slice(0,10);
    const ratio=capped.length?hits.length/capped.length:0;
    kwPct=Math.round(ratio*100);
    checks.push({group:'jd',ok:ratio>=0.7,pts:26,earned:26*ratio,sev:ratio>=0.7?'ok':(ratio>=0.4?'warn':'bad'),
      fix:'ضيف الكلمات المفتاحية الناقصة من إعلان الوظيفة في المهارات والخبرات — بس اللي بتعرفه فعلًا'});
  }else{
    const extraSecs=[sec.projects,sec.certs,sec.langs].filter(Boolean).length;
    add('depth',extraSecs>=2,8,'ضيف أقسام زيادة زي Projects و Certifications و Languages — بتقوّي الملف قدام النظام','warn');
    add('depth',bulletCount>=6,6,'خلي عندك 6 نقط إنجاز على الأقل موزعة على خبراتك ومشاريعك','warn');
    add('depth',nWords>=300&&nWords<=700,8,nWords<300?'المحتوى لسه قليل — وسّع في الخبرات والمشاريع':'المحتوى زيادة عن اللزوم — اختصر عشان يفضل مركّز','warn');
    const summWords=(()=>{ const ix=lines.findIndex(l=>SECTION_PATTERNS.summary.test(l.trim().toLowerCase())); if(ix<0) return 0; return (lines[ix+1]||'').split(/\s+/).filter(Boolean).length; })();
    add('depth',summWords>=10||!sec.summary,4,'خلي الـ Summary سطرين تلاتة يعرّفوا بيك وبهدفك — مش جملة عامة','warn');
  }

  let got=0,max=0;
  checks.forEach(ch=>{ max+=ch.pts; got+=ch.earned!==undefined?ch.earned:(ch.ok?ch.pts:0); });
  const pct=Math.round(got/max*100);
  const lo=Math.max(0,pct-4), hi=Math.min(100,pct+3);
  const fixes=checks.filter(ch=>!ch.ok&&ch.fix).sort((a,b)=>b.pts-a.pts).map(ch=>ch.fix).slice(0,3);
  return {lo,hi,pct,words:nWords,checks,fixes,missing,hasJD,kwPct};
}

/* ---- page wiring ---- */
let cvText='', evalMode='general';
const $=id=>document.getElementById(id);

function setMode(m){
  evalMode=m;
  $('chipGeneral').classList.toggle('on',m==='general');
  $('chipJD').classList.toggle('on',m==='jd');
  $('jdWrap').style.display=m==='jd'?'block':'none';
}

async function onFileChosen(file){
  if(!file) return;
  const st=$('fileStatus');
  st.textContent='بنقرا الملف على جهازك...';
  try{
    const text=await extractCVFile(file);
    if(text.trim().length<20) throw new Error('empty');
    cvText=text;
    $('cvPaste').value='';
    $('srcBox').textContent=text.split('\n').slice(0,8).join('\n');
    $('srcPreview').style.display='block';
    st.textContent='خلصنا القراءة ✅ — عدد الكلمات: '+text.split(/\s+/).filter(Boolean).length;
  }catch(e){
    cvText='';
    const messages={size:'الملف أكبر من 10MB. اختار نسخة أصغر.',type:'اختار PDF أو DOCX أو TXT.',pages:'اختار CV لحد 20 صفحة.',empty:'مقدرناش نلاقي نص في الملف — لو PDF سكان (صورة) استخدم نسخة نصية أو الصق النص تحت.'};
    st.textContent=messages[e.message]||'معرفناش نقرا الملف. جرّب نسخة PDF نصية مش محمية أو DOCX أو TXT، أو الصق النص تحت.';
  }
}

function groupMeta(g){
  return {contact:{icon:'fa-address-card',title:'بيانات التواصل'},
    sections:{icon:'fa-layer-group',title:'الأقسام الأساسية'},
    content:{icon:'fa-pen-nib',title:'قوة المحتوى'},
    format:{icon:'fa-ruler-combined',title:'التنسيق والطول'},
    depth:{icon:'fa-plus',title:'عمق الملف'},
    jd:{icon:'fa-bullseye',title:'مطابقة وصف الوظيفة'}}[g]||{icon:'fa-circle',title:g};
}

function renderReport(rep){
  const r=$('evalResult');
  const verdict=rep.pct>=85?'ممتاز 🔥 — الـ CV ده جاهز يتقدم':rep.pct>=70?'جامد — ظبط النقط اللي تحت وهيبقى أقوى':rep.pct>=55?'كويس — بس محتاج شغل قبل التقديم':'محتاج شغل — ابدأ بالنقط اللي تحت بالترتيب';
  const gaugeColor=rep.pct>=70?'var(--brand2)':'var(--gold)';
  const circ=2*Math.PI*80;
  const scoreLabel=rep.hasJD?'سكور تقديري مطابق لوصف الوظيفة':'نطاق تقديري لجاهزية الـ CV قدام أنظمة ATS';
  const kwLine=rep.hasJD?`<div style="font-size:13px;margin-top:8px;padding:9px 12px;border-radius:10px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25)">تطابق الكلمات المفتاحية مع الإعلان: <b>${rep.kwPct}%</b></div>`:'';
  const groups=[];
  const seen=new Map();
  for(const ch of rep.checks){ if(!seen.has(ch.group)) seen.set(ch.group,[]); seen.get(ch.group).push(ch); }
  for(const [g,rows] of seen){ const meta=groupMeta(g); groups.push({meta,rows}); }
  const sevTxt={bad:'ناقص',warn:'يتحسّن',ok:'تمام'};
  r.innerHTML=`
  <div class="card score-wrap">
    <span class="step-ico"><i class="fa-solid fa-gauge-high"></i></span>
    <div class="step-title">${scoreLabel}</div>
    <div class="gauge">
      <svg width="190" height="190">
        <circle cx="95" cy="95" r="80" fill="none" stroke="#101c38" stroke-width="14"/>
        <circle cx="95" cy="95" r="80" fill="none" stroke="${gaugeColor}" stroke-width="14" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ*(1-rep.pct/100)}" style="transition:stroke-dashoffset 1.2s ease"/>
      </svg>
      <div class="num"><div class="rng" style="color:${gaugeColor}">${rep.lo}–${rep.hi}</div><div class="of">من 100 · نطاق تقريبي</div></div>
    </div>
    <div class="score-verdict">${verdict}</div>
    ${kwLine}
    <div style="font-size:12px;color:var(--mut);margin-top:8px;line-height:1.9">عدد الكلمات: ${rep.words} · بنقيس: التواصل · الأقسام · قوة المحتوى · التنسيق${rep.hasJD?' · مطابقة الوظيفة':''}</div>
    <div style="font-size:11.5px;color:var(--mut);margin-top:10px;line-height:1.8"><i class="fa-solid fa-circle-info"></i> ده تقدير التطبيق بتاعنا، مش سكور ATS رسمي من أي شركة توظيف، ومش ضمان قبول.</div>
  </div>
  ${rep.fixes.length?`<div class="card">
    <div class="step-title" style="font-size:17px"><i class="fa-solid fa-screwdriver-wrench" style="color:var(--gold)"></i> أهم ${rep.fixes.length} حاجات تبدأ بيهم</div>
    ${rep.fixes.map(f=>`<div class="fix"><i class="fa-solid fa-arrow-up"></i><span>${esc(f)}</span></div>`).join('')}
    ${rep.missing.length?`<div style="margin-top:8px"><div class="lbl" style="margin-top:0">كلمات في إعلان الوظيفة مش موجودة في الـ CV:</div>${rep.missing.map(w=>`<span class="kw">${esc(w)}</span>`).join('')}</div>`:''}
  </div>`:''}
  <div class="card">
    <div class="step-title" style="font-size:17px"><i class="fa-solid fa-list-check" style="color:var(--brand2)"></i> التقرير بالتفصيل</div>
    ${groups.map(gr=>`
      <div class="lbl" style="margin-top:16px"><i class="fa-solid ${gr.meta.icon}" style="color:var(--brand2)"></i> ${gr.meta.title}</div>
      ${gr.rows.map(ch=>`<div class="fix ${ch.ok?'ok':''}"><i class="fa-solid ${ch.ok?'fa-circle-check':'fa-circle-xmark'}" style="${ch.ok?'':'color:var(--bad)'}"></i><span style="flex:1">${ch.ok?'':'<b>'+sevTxt[ch.sev]+':</b> '}${esc(ch.ok?okText(ch):ch.fix)}</span><span class="sev sev-${ch.sev}">${ch.ok?ch.pts+'/'+ch.pts:(ch.earned!==undefined?Math.round(ch.earned)+'/'+ch.pts:'0/'+ch.pts)}</span></div>`).join('')}
    `).join('')}
  </div>
  <div class="card" style="text-align:center">
    <div class="step-title" style="font-size:17px">عايز تظبطها من الأول؟</div>
    <p class="step-hint">البيلدر بتاعنا بيسألك أسئلة بالمصري ويطلعلك CV إنجليزي ATS-safe من غير ما تكتب سطر واحد بنفسك.</p>
    <a class="cta" href="index.html" style="text-decoration:none">اعمل CV جديد بالبيلدر <i class="fa-solid fa-arrow-left"></i></a>
  </div>`;
  r.style.display='block';
  r.scrollIntoView({behavior:'smooth',block:'start'});
}
function okText(ch){
  return ({contact:'موجودة وواضحة',sections:'موجودة بعنوان واضح',content:'شكلها كويس',format:'مناسبة',depth:'موجودة',jd:'تطابق الكلمات المفتاحية قوي'})[ch.group]||'تمام';
}

function runEvaluation(){
  const pasted=$('cvPaste').value.trim();
  const text=pasted||cvText;
  if(!text||text.trim().length<20){ toast('ارفع ملف الـ CV أو الصق نصّه الأول'); $('uploadCard').scrollIntoView({behavior:'smooth'}); return; }
  let jd='';
  if(evalMode==='jd'){
    jd=($('jdTitle').value+'\n'+$('jdText').value).trim();
    if(tokenize(jd).length===0){ toast('الصق وصف الوظيفة الأول، أو اختار تقييم عام'); $('jdText').focus(); return; }
  }
  const rep=evaluateCV(text,jd);
  renderReport(rep);
}

document.addEventListener('DOMContentLoaded',()=>{
  $('cvFile').addEventListener('change',e=>{ onFileChosen(e.target.files[0]); e.target.value=''; });
  $('cvPaste').addEventListener('input',()=>{ if($('cvPaste').value.trim()){ cvText=''; $('fileStatus').textContent='هنحلّل النص اللي لصقته.'; $('srcPreview').style.display='none'; } });
});
