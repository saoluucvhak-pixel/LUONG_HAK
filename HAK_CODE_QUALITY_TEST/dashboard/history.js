"use strict";
(()=>{
const $=id=>document.getElementById(id), NS="http://www.w3.org/2000/svg";
const runs=[], architectures=[];
const el=(name,attrs={})=>{const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e};
const opt=(select,label,value)=>{const o=document.createElement("option");o.value=String(value);o.textContent=label;select.append(o)};
const td=(tr,value)=>{const c=document.createElement("td");c.textContent=String(value);tr.append(c)};
function plot(){
 const svg=$("trend");svg.replaceChildren();
 if(!runs.length){$("trendSummary").textContent="Chưa có dữ liệu";return}
 const recent=runs.slice(-20), max=Math.max(1,...recent.map(r=>r.passed+r.failed));
 svg.append(el("line",{x1:32,y1:205,x2:630,y2:205,stroke:"#8291a6"}));
 recent.forEach((r,i)=>{const x=40+i*580/recent.length,w=Math.max(4,480/recent.length),pass=r.passed/max*165,fail=r.failed/max*165;
 svg.append(el("rect",{x,y:205-pass,width:w,height:pass,fill:"#17835f"}));
 svg.append(el("rect",{x,y:205-pass-fail,width:w,height:fail,fill:"#ca4848"}));
 const title=el("title");title.textContent=r.label+": "+r.passed+" đạt, "+r.failed+" lỗi";svg.lastChild.append(title)});
 $("trendSummary").textContent="Xanh: đạt · Đỏ: lỗi · "+recent.length+" phiên gần nhất (theo thứ tự nhập)";
}
function compare(){
 const a=runs[Number($("left").value)],b=runs[Number($("right").value)],body=$("compare");body.replaceChildren();
 if(!a||!b)return;
 for(const [label,key] of [["Đạt","passed"],["Lỗi","failed"],["Tổng","total"]]){
 const tr=document.createElement("tr");td(tr,label);td(tr,a[key]);td(tr,b[key]);td(tr,b[key]-a[key]);body.append(tr)}
}
function graph(){
 const index=Number($("architecture").value),entry=architectures[index],target=$("graph");target.replaceChildren();
 if(!entry){target.textContent="Chưa có dữ liệu kiến trúc";return}
 const list=document.createElement("ul");const graph=entry.data.dependencies;
 for(const [module,deps] of Object.entries(graph).slice(0,250)){
 const li=document.createElement("li");const strong=document.createElement("strong");strong.textContent=module;li.append(strong);
 const span=document.createElement("span");span.textContent=" → "+(Array.isArray(deps)?deps.join(", "):"");li.append(span);list.append(li)}
 target.append(list);
}
function refresh(){
 for(const id of ["left","right","architecture"])$(id).replaceChildren();
 runs.forEach((r,i)=>{opt($("left"),r.label,i);opt($("right"),r.label,i)});
 if(runs.length)$("right").value=String(runs.length-1);
 architectures.forEach((r,i)=>opt($("architecture"),r.label,i));
 plot();compare();graph();
}
$("left").addEventListener("change",compare);$("right").addEventListener("change",compare);$("architecture").addEventListener("change",graph);
$("upload").addEventListener("change",async event=>{
 let loaded=0,rejected=0;
 for(const file of event.target.files||[]){
 if(file.size>5_000_000){rejected++;continue}
 try{
 const data=JSON.parse(await file.text());
 if(Array.isArray(data.checks)&&Number.isFinite(data.passed)&&Number.isFinite(data.failed)){
 runs.push({label:String(data.commit||file.name).slice(0,100),passed:data.passed,failed:data.failed,total:data.passed+data.failed});loaded++;
 }else if(data.dependencies&&typeof data.dependencies==="object"&&!Array.isArray(data.dependencies)&&Array.isArray(data.cycles)){
 architectures.push({label:file.name,data});loaded++;
 }else rejected++;
 }catch{rejected++}
 }
 $("status").textContent="Đã nhập "+loaded+" báo cáo; "+rejected+" file không phù hợp.";refresh();
});
refresh();
})();