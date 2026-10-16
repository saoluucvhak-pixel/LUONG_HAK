"use strict";
(()=>{
 const $=id=>document.getElementById(id);
 const put=(id,value)=>$(id).textContent=String(value);
 function addRow(folder,name,summary){
  const tr=document.createElement("tr");
  for(const value of [folder,name,summary]){const td=document.createElement("td");td.textContent=String(value);tr.append(td)}
  $("list").append(tr);
 }
 async function refresh(){
  put("status","Đang đọc báo cáo…");
  try{
   const response=await fetch("/api/reports",{cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const data=await response.json(),reports=Array.isArray(data.reports)?data.reports:[];
   $("list").replaceChildren();
   let failed=0,security=0,cycles=0,skills=0;
   for(const entry of reports){
    const report=entry.report||{};
    if(entry.name==="hak-quality-results.json")failed+=Number(report.failed)||0;
    if(entry.name==="hak-security-results.json")security+=Array.isArray(report.findings)?report.findings.length:0;
    if(entry.name==="hak-architecture-results.json")cycles+=Array.isArray(report.cycles)?report.cycles.length:0;
    if(entry.name==="hak-skill-proposals.json")skills+=Array.isArray(report.proposals)?report.proposals.length:0;
    const summary=entry.name==="hak-quality-results.json"?"Đạt: "+(report.passed??"?")+" · Lỗi: "+(report.failed??"?"):
     entry.name==="hak-security-results.json"?"Phát hiện: "+(report.findings?.length??"?"):
     entry.name==="hak-architecture-results.json"?"Module: "+(report.modules??"?"):
     "Đề xuất: "+(report.proposals?.length??"?");
    addRow(entry.folder,entry.name,summary);
   }
   for(const [key,value] of Object.entries({count:reports.length,failed,security,cycles,skills}))put(key,value);
   put("status",reports.length?"Đã tải "+reports.length+" báo cáo.":"Chưa tìm thấy báo cáo. Hãy chép JSON vào thư mục reports.");
  }catch(err){put("status","Không đọc được dữ liệu. Hãy chạy serve.py rồi mở địa chỉ localhost.");}
 }
 $("reload").addEventListener("click",refresh);
 refresh();
})();