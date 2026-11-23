/* SAMS majors (from SAMS Compass). Shared by builder + evaluate. */
window.SAMS_MAJORS=[
{id:'accounting',ar:'المحاسبة',en:'Accounting',kw:['Financial Accounting','Cost Accounting','Auditing','Taxation','Excel','Financial Statements','Bookkeeping','ERP','Budgeting','Reconciliation']},
{id:'actuarial',ar:'العلوم الاكتوارية',en:'Actuarial Science',kw:['Statistics','Probability','Risk Analysis','Insurance','Data Analysis','Excel','Python','Financial Modeling','Pricing','Reserving']},
{id:'banking',ar:'إدارة الأعمال – إدارة البنوك',en:'Business Administration - Banking Management',kw:['Banking Operations','Customer Service','Credit Analysis','Risk Management','Financial Analysis','KYC','Compliance','Excel','Loans','Sales']},
{id:'economics',ar:'الاقتصاد',en:'Economics',kw:['Economic Analysis','Statistics','Econometrics','Research','Data Analysis','Excel','Forecasting','Macroeconomics','Microeconomics','Reporting']},
{id:'energy',ar:'إدارة الأعمال – المنشآت البترولية والطاقة',en:'Business Administration - Petroleum and Energy Facilities',kw:['Operations Management','Supply Chain','Project Management','Health and Safety','Procurement','Excel','Cost Control','Logistics','Reporting','Planning']},
{id:'finance',ar:'إدارة الأعمال – التمويل والاستثمار',en:'Business Administration - Finance and Investment',kw:['Financial Analysis','Financial Modeling','Investment Analysis','Portfolio Management','Valuation','Excel','Risk Management','Budgeting','Forecasting','Capital Markets']},
{id:'hr',ar:'إدارة الموارد البشرية',en:'Human Resources Management',kw:['Recruitment','Onboarding','Employee Relations','Payroll','Training and Development','Performance Management','HR Policies','Labor Law','Communication','Excel']},
{id:'marketing',ar:'إدارة الأعمال – التسويق والتجارة الإلكترونية',en:'Business Administration - Marketing and E-Commerce',kw:['Digital Marketing','Social Media','Content Creation','SEO','E-Commerce','Market Research','Branding','Google Analytics','Copywriting','Campaigns']},
{id:'mis',ar:'نظم المعلومات الإدارية',en:'Management Information Systems',kw:['SQL','Database','Excel','Data Analysis','Python','Business Analysis','Power BI','Systems Analysis','Web Development','ERP']},
{id:'public-admin',ar:'الإدارة العامة والمحلية',en:'Public and Local Administration',kw:['Public Administration','Policy Analysis','Planning','Reporting','Communication','Project Management','Organization','Research','Excel','Teamwork']}
];
window.SAMS_ACADEMY='Sadat Academy for Management Sciences';
window.SAMS_majorById=function(id){return window.SAMS_MAJORS.find(function(m){return m.id===id})||null};
/* builder: chips that fill the major input. call samsMajorChips(inputId) after render */
window.samsMajorChips=function(inp,onPick){
  var box=document.getElementById('majChips'),el=document.getElementById(inp);
  if(!box||!el)return;
  var cur=el.value.trim();
  box.innerHTML=window.SAMS_MAJORS.map(function(m){return '<button type="button" class="chip'+(cur===m.en?' on':'')+'" data-id="'+m.id+'">'+m.ar+'</button>'}).join('')+'<button type="button" class="chip" data-id="">تخصص تاني</button>';
  box.querySelectorAll('.chip').forEach(function(c){c.addEventListener('click',function(){
    box.querySelectorAll('.chip').forEach(function(x){x.classList.toggle('on',x===c)});
    var m=window.SAMS_majorById(c.dataset.id);
    if(m){el.value=m.en;el.dispatchEvent(new Event('input',{bubbles:true}));}
    else{el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();}
    if(onPick)onPick(m);
  })});
};
/* evaluate page: track chips + suggested keywords */
document.addEventListener('DOMContentLoaded',function(){
  var box=document.getElementById('trackChips');
  if(!box||!window.SAMS_MAJORS)return;
  var track=null;
  box.innerHTML=window.SAMS_MAJORS.map(function(m){return '<button type="button" class="chip" data-id="'+m.id+'">'+m.ar+'</button>'}).join('')+'<button type="button" class="chip on" data-id="">تخصص تاني / مش مهم</button>';
  box.querySelectorAll('.chip').forEach(function(c){c.addEventListener('click',function(){
    box.querySelectorAll('.chip').forEach(function(x){x.classList.toggle('on',x===c)});
    track=window.SAMS_majorById(c.dataset.id);
  })});
  var orig=window.renderReport;
  if(typeof orig!=='function')return;
  window.renderReport=function(rep){
    orig(rep);
    if(!track)return;
    var t='';try{t=(document.getElementById('cvPaste').value.trim()||cvText||'')}catch(e){}
    t=t.toLowerCase();
    var miss=track.kw.filter(function(k){return t.indexOf(k.toLowerCase())<0});
    var have=track.kw.filter(function(k){return t.indexOf(k.toLowerCase())>=0});
    var d=document.createElement('div');d.className='card';
    d.innerHTML='<div class="step-title" style="font-size:17px"><i class="fa-solid fa-compass" style="color:var(--brand2)"></i> كلمات مقترحة لتخصص '+track.ar+'</div>'+
    '<p class="step-hint">كلمات شائعة في وظايف المجال ده. ضيف بس اللي بتعرفه فعلًا.</p>'+
    (miss.length?'<div class="lbl" style="margin-top:0">ناقصة في الـ CV:</div>'+miss.map(function(w){return '<span class="kw">'+w+'</span>'}).join(''):'<p class="step-hint">الـ CV فيه كل الكلمات المقترحة. ممتاز.</p>')+
    (have.length?'<div class="lbl">موجودة بالفعل:</div>'+have.map(function(w){return '<span class="kw">'+w+'</span>'}).join(''):'');
    var r=document.getElementById('evalResult');
    var cta=r.lastElementChild;r.insertBefore(d,cta);
  };
});
