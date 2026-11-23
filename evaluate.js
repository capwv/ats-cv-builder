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
