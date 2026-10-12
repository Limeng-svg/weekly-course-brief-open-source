/* Local-only Canvas calendar and reviewed course-brief imports. */
(function () {
  'use strict';
  const plain = v => typeof v === 'string' ? v : '';
  const strings = v => Array.isArray(v) ? v.filter(x=>typeof x==='string') : [];
  function safeUrl(v) { try { const u=new URL(v); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
  function fmtDate(iso, zone) {
    const d=new Date(iso); if(!Number.isFinite(d.getTime())) throw new Error('文件包含无效日期。');
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
    const get=t=>parts.find(p=>p.type===t).value;
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} (${zone})`;
  }
  function icsTime(p, zone) {
    if(!p) return '日期未提供';
    const m=p.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if(!m) throw new Error('日历含有无法识别的时间格式。');
    const [_,y,mo,day,hh,mm,ss,z]=m;
    const raw=`${y}-${mo}-${day}`;
    const date=new Date(`${raw}T${hh||'00'}:${mm||'00'}:${ss||'00'}Z`);
    if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==raw || +(hh||0)>23 || +(mm||0)>59 || +(ss||0)>59) throw new Error('日历包含无效日期或时分。');
    if(!hh) return `${raw} (全天，未提供截止时分)`;
    if(z) return fmtDate(`${raw}T${hh}:${mm}:${ss}Z`,zone);
    const tz=p.params.match(/(?:^|;)TZID=([^;]+)/i)?.[1]?.replace(/^"|"$/g,'');
    return `${raw} ${hh}:${mm} (${tz||'源文件未提供时区'})`;
  }
  const unescapeICS=s=>s.replace(/\\([nN,;\\])/g,(_,x)=>/n/i.test(x)?'\n':x);
  function parseICS(text, zone, weekStart) {
    if(!/BEGIN:VCALENDAR/i.test(text)) throw new Error('请选择 Canvas 导出的 .ics 日历文件。');
    new Intl.DateTimeFormat('en',{timeZone:zone});
    const blocks=text.replace(/\r?\n[ \t]/g,'').match(/BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT/g)||[];
    const unique=new Map(); let repeated=0;
    for(const block of blocks) {
      const obj={}; let alarm=false;
      for(const line of block.split(/\r?\n/)) {
        if(line==='BEGIN:VALARM'){alarm=true;continue;} if(line==='END:VALARM'){alarm=false;continue;} if(alarm)continue;
        const i=line.indexOf(':');if(i<0)continue;
        const left=line.slice(0,i),key=left.split(';')[0].toUpperCase();obj[key]={value:line.slice(i+1),params:left.slice(key.length)};
      }
      const id=obj.UID?.value||block;
      const old=unique.get(id);if(!old || +(obj.SEQUENCE?.value||0)>=+(old.SEQUENCE?.value||0))unique.set(id,obj);
    }
    const deadlines=[],calendarEvents=[];
    for(const obj of unique.values()) {
      if(obj.STATUS?.value==='CANCELLED')continue;
      if(obj.RRULE){repeated++;continue;}
      const task=unescapeICS(obj.SUMMARY?.value||'未命名日历事项');
      const rawUrl=obj.URL?.value||obj.DESCRIPTION?.value.match(/https?:\/\/[^\s\\<>]+/)?.[0]||'';
      const assignment=/\/(assignments|quizzes)\//i.test(rawUrl)||/assignment/i.test(obj.UID?.value||'');
      const course=unescapeICS(obj.CATEGORIES?.value||'Canvas 日历');
      const row={date:icsTime(obj.DTSTART,zone),course,task,weight:'日历未提供权重',detail:assignment?'Canvas 日历中的作业日期；需在自己的作业页面核实差异化日期与延期。':'日历事项的开始时间，不自动视为作业截止。',url:safeUrl(rawUrl)};
      (assignment?deadlines:calendarEvents).push(row);
    }
    for(const rows of [deadlines,calendarEvents]) rows.sort((a,b)=>a.date.localeCompare(b.date));
    if(!deadlines.length&&!calendarEvents.length) throw new Error(repeated?'文件仅含重复事项；请在 Canvas 核对重复日程。':'日历中没有可显示的一次性事项。');
    const start=weekStart?new Date(weekStart+'T00:00:00Z'):null;
    if(start && (!Number.isFinite(start.getTime()) || start.toISOString().slice(0,10)!==weekStart))throw new Error('请填写有效的周报开始日期。');
    const end=start?new Date(start.getTime()+6*86400000).toISOString().slice(0,10):null;
    const thisWeek=start?deadlines.filter(x=>x.date.slice(0,10)>=weekStart&&x.date.slice(0,10)<=end):[];
    return {courses:[],deadlines,calendarEvents,thisWeek,period:start?`${weekStart} — ${end}`:'',notes:[`导入时区：${zone}。UTC 时间已转换；有 TZID 的本地时间保留源时区；全天事项没有被补写截止时分。`,...(repeated?[`${repeated}项带有重复规则，未展开，请回到 Canvas 核对。`]:[]),'日历不包含讲义全文；Lecture 与 Tutorial 需另行读取 Modules、Pages、Files 或课堂录像。']};
  }
  function parseBrief(text) {
    const raw=JSON.parse(text);if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('请选择本看板格式的课程周报 JSON。');
    const courses=(Array.isArray(raw.courses)?raw.courses:[]).filter(c=>c&&typeof c==='object').map(c=>({code:plain(c.code),name:plain(c.name),lectureTitle:plain(c.lectureTitle),lecture:strings(c.lecture),lectureStatus:plain(c.lectureStatus),tutorialTitle:plain(c.tutorialTitle),tutorial:strings(c.tutorial),tasks:strings(c.tasks),links:(Array.isArray(c.links)?c.links:[]).filter(a=>Array.isArray(a)&&typeof a[0]==='string'&&safeUrl(a[1])).map(a=>[a[0],safeUrl(a[1])])})).filter(c=>c.lecture.length||c.tutorial.length||c.tasks.length);
    const rows=key=>(Array.isArray(raw[key])?raw[key]:[]).filter(x=>x&&typeof x==='object'&&typeof x.task==='string').map(x=>({date:plain(x.date)||plain(x.when)||'日期未提供',course:plain(x.course),task:x.task,weight:plain(x.weight),detail:plain(x.detail),url:safeUrl(x.url)}));
    const result={courses,deadlines:rows('deadlines'),calendarEvents:rows('calendarEvents'),thisWeek:rows('thisWeek'),notes:strings(raw.notes),scope:plain(raw.scope),period:plain(raw.period)};
    if(!courses.length&&!result.deadlines.length&&!result.calendarEvents.length&&!result.thisWeek.length)throw new Error('周报文件未包含可显示的课程内容或事项。');
    return result;
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={parseICS,parseBrief,fmtDate,safeUrl};return;}
  const result=document.getElementById('canvas-result'),status=document.getElementById('import-status'),file=document.getElementById('import-file'),save=document.getElementById('export');
  let imported=null;
  function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
  function link(url,label){if(!safeUrl(url))return null;const a=el('a',label||'来源页面 ↗');a.href=safeUrl(url);a.target='_blank';a.rel='noopener noreferrer';return a;}
  function list(items,parent){if(!items.length)return;const u=el('ul');items.forEach(v=>u.append(el('li',v)));parent.append(u);}
  function rows(title,items){if(!items?.length)return;const s=el('section');s.append(el('h2',title));items.forEach(x=>{const a=el('article','','deadline'),content=el('div');a.append(el('div',x.date,'date'),content);content.append(el('div',`${x.course}${x.weight?' · '+x.weight:''}`,'eyebrow'),el('h3',x.task),el('p',x.detail));const l=link(x.url);if(l)content.append(l);s.append(a);});result.append(s);}
  function render(d){
    result.replaceChildren();result.hidden=false;
    result.append(el('h2',(document.getElementById('school').value.trim()||'Canvas 大学')+' · 已导入资料'));
    if(d.period)result.append(el('p',d.period,'meta'));if(d.scope)result.append(el('p',d.scope));
    rows('本周作业与提交节点',d.thisWeek);
    if(d.courses.length){const s=el('section'),grid=el('div','','courses');s.append(el('h2','Lecture 与 Tutorial'),grid);d.courses.forEach(c=>{const a=el('article','','course'),head=el('div','','course-head'),b=el('div','','course-content');head.append(el('div',c.code,'code'),el('h3',c.name));a.append(head,b);if(c.lecture.length){b.append(el('h4','Lecture · '+c.lectureTitle),el('p',c.lectureStatus,'meta'));list(c.lecture,b);}if(c.tutorial.length){b.append(el('h4','Tutorial / Lab · '+c.tutorialTitle));list(c.tutorial,b);}if(c.tasks.length){b.append(el('h4','本周行动'));list(c.tasks,b);}const l=el('div','','sources');c.links.forEach(([n,u])=>l.append(link(u,n+' ↗')));b.append(l);grid.append(a);});result.append(s);}
    rows('作业截止时间',d.deadlines);rows('其他日历事项 · 开始时间',d.calendarEvents);
    if(d.notes.length){const f=el('footer');f.append(el('h3','来源与核查说明'));list(d.notes,f);result.append(f);}
    save.hidden=false;
  }
  async function importFile(){
    const f=file.files[0];if(!f)return;
    try{
      if(f.size>5*1024*1024)throw new Error('请选择小于5MB的日历或周报文件。');
      const text=await f.text(),zone=document.getElementById('zone').value.trim();
      const d=/\.ics$/i.test(f.name)?parseICS(text,zone,document.getElementById('week-start').value):/\.json$/i.test(f.name)?parseBrief(text):null;
      if(!d)throw new Error('支持 .ics 日历或 .json 课程周报。');
      imported=d;render(d);status.className='';status.textContent=`已导入 ${f.name}：${d.courses.length}门课程内容，${d.deadlines.length}项作业日期，${d.calendarEvents?.length||0}项其他日历事项。`;
    }catch(e){status.className='error';status.textContent='未导入：'+e.message;}
  }
  file.addEventListener('change',importFile);
  document.getElementById('zone').addEventListener('change',importFile);
  document.getElementById('week-start').addEventListener('change',importFile);
  document.getElementById('school').addEventListener('change',()=>{if(imported)render(imported);});
  save.addEventListener('click',()=>{if(!imported)return;const u=URL.createObjectURL(new Blob([JSON.stringify(imported,null,2)],{type:'application/json'})),a=el('a');a.href=u;a.download='canvas-course-brief.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
})();
