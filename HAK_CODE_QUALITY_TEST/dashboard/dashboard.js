"use strict";
(() => {
 const state={quality:null,security:null,architecture:null,observer:null};
 const $=id=>document.getElementById(id);
 const put=(id,v)=>{$(id).textContent=String(v)};
 function cell(row,value){const td=document.createElement("td");td.textContent=String(value??"");row.appendChild(td)}
 function rows(id,data,cols){const body=$(id);body.replaceChildren();if(!data.length){const tr=document.createElement("tr");const td=document.createElement("td");td.colSpan=cols.length;td.className="empty";td.textContent="Không có mục nào";tr.appendChild(td);body.appendChild(tr);return}for(const item of data.slice(0,1000)){const tr=document.createElement("tr");for(const col of cols)cell(tr,col(item));body.appendChild(tr)}}
 function render(){
  const q=state.quality,s=state.security,a=state.architecture,o=state.observer;
  put("tests",q?Number(q.passed||0)+Number(q.failed||0):"—");
  put("failed",q?Number(q.failed||0):"—");
  put("security",s&&Array.isArray(s.findings)?s.findings.length:"—");
  put("cycles",a&&Array.isArray(a.cycles)?a.cycles.length:"—");
  put("proposals",o&&Array.isArray(o.proposals)?o.proposals.length:"—");
  rows("checks",q&&Array.isArray(q.checks)?q.checks:[],[x=>x.name,x=>x.status]);
  rows("findings",s&&Array.isArray(s.findings)?s.findings:[],[x=>x.rule,x=>x.severity,x=>x.file+":"+x.line]);
  const arch=$("architecture");arch.replaceChildren();
  if(a&&a.dependencies&&typeof a.dependencies==="object"){const list=document.createElement("ul");for(const [file,deps] of Object.entries(a.dependencies).slice(0,300)){const li=document.createElement("li");li.textContent=file+" → "+(Array.isArray(deps)?deps.join(", "):"");list.appendChild(li)}arch.appendChild(list)}else arch.textContent="Chưa có dữ liệu";
  const skills=$("skills");skills.replaceChildren();
  if(o&&Array.isArray(o.proposals)){if(!o.proposals.length)skills.textContent="Chưa có đề xuất";for(const proposal of o.proposals.slice(0,200)){const p=document.createElement("p");p.textContent=(proposal.category||"Skill")+" — "+(proposal.proposal||"Chờ đánh giá")+" (chờ phê duyệt)";skills.appendChild(p)}}else skills.textContent="Chưa có dữ liệu";
 }
 const shapes=[
  ["quality",x=>Array.isArray(x.checks)&&typeof x.passed==="number"],
  ["security",x=>Array.isArray(x.findings)&&typeof x.scannedFiles==="number"],
  ["architecture",x=>x.dependencies&&typeof x.dependencies==="object"&&Array.isArray(x.cycles)],
  ["observer",x=>Array.isArray(x.proposals)&&x.approvalRequired===true]
 ];
 $("files").addEventListener("change",async event=>{
  let loaded=0,errors=0;
  for(const file of Array.from(event.target.files||[])){
   if(file.size>5_000_000){errors++;continue}
   try{const obj=JSON.parse(await file.text());const match=shapes.find(([,check])=>check(obj));if(!match){errors++;continue}state[match[0]]=obj;loaded++}catch{errors++}
  }
  render();put("message",`Đã đọc ${loaded} báo cáo. ${errors} file không hợp lệ hoặc chưa được hỗ trợ.`);
 });
 render();
})();