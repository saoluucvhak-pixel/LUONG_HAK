// Đối chiếu bảng lương Excel (Power Query) với engine của app theo từng nhân viên.
// Dữ liệu thật chứa thông tin cá nhân → KHÔNG đưa vào repo. Xuất JSON từ workbook bằng tools/recon/export_xlsx.py rồi chạy:
//   node tools/recon/recon-t9-2025.js <quyChe 2026|1.7> <cheDoBu to|false|true|daihiep> <đường-dẫn-json>
const R=require("path").join(__dirname,"..","..")+"/";
const E=require(R+"engine.js"), HR=require(R+"hr.js");
const D=require(require("path").resolve(process.env.RECON_DATA||process.argv[4]||"sep2025.json"));
const KY="2025-09", qc=process.argv[2]||"2026";
const db=HR.seedDanhMuc();
["nhanvien","hopdong","chitiethd","nhanthan","thanhtoan","canhan","chamcong","sanluong","bandam","psluong","ungluong","tiencom","kyluong","kyluong_lichsu","dm_congthuc","nghiphep","nghiom"].forEach(k=>db[k]=db[k]||[]);
db.dm_baohiem=[["BH_KPCD.01",.005],["BH_KPCD.03",0]].map(([m,k])=>({"Mã bảo hiểm":m,"DN.BHXH":.175,"DN.BHYT":.03,"DN.BHTN":.01,"DN.KPCD":.02,"NLD.BHXH":.08,"NLD.BHYT":.015,"NLD.BHTN":.01,"NLD.KPCD":k,"Hiệu lực từ":"2020-01-01"}));
const ct={};D.NL_CHITIET_NS.forEach(r=>ct[r["Mã nhân viên/CCCD"]]=r);
D.NL_NHANSU.forEach(r=>{const ma=r["Mã nhân viên/CCCD"],so=ma+"/HĐ01",c=ct[ma]||{};
 db.nhanvien.push({"Mã NV":ma,"Họ và tên":r["Họ và tên"],"Trạng thái":"Đang làm việc"});
 db.hopdong.push({"Mã NV":ma,"Số HĐLĐ":so,"Ngày vào làm":r["Ngày vào làm"]||"2020-01-01","Hình thức HĐLĐ":"Không xác định thời hạn"});
 db.chitiethd.push({"Mã NV":ma,"Số HĐLĐ":so,"Hiệu lực từ":"2025-01-01","Phòng ban":r["Mã PB"],"Chức vụ":r["Mã CV"],"Mã lương":[r["Mã tiền lương 1"],r["Mã tiền lương 2"]].filter(Boolean).join(", "),
  "Lương thỏa thuận":String(r["Lương thỏa thuận"]||""),"Lương cơ bản":String(r["Lương cơ bản"]||""),"Mức đóng bảo hiểm":r["Mã BHXH"],"Thuế TNCN":"LT01","Phụ cấp":r["Mã phụ cấp"]||"","Hỗ trợ":[r["Mã hỗ trợ"],r["Mã hỗ trợ 2"]].filter(Boolean).join(", "),"Tăng ca":r["Mã tăng ca"]||"","HTTT":"Chuyển khoản"});
 for(let k=0;k<(+c["Người phụ thuộc"]||0);k++)db.nhanthan.push({"Mã NV":ma,"Họ tên nhân thân":"NPT"+k,"Quan hệ":"Con","Đăng ký phụ thuộc":"Có","Hiệu lực từ":"2024-01-01"});});
const days=[...Array(31)].map((_,i)=>("0"+(i+1)).slice(-2));
D.DL_Chamcong.forEach(r=>{const o={"Kỳ":KY,"Mã NV":r["Mã NV"],"Hình thức công":r["HÌnh thức công"]};days.forEach(d=>{if(r[d]!=null)o[d]=r[d];});db.chamcong.push(o);});
D.DL_Sanluong.forEach(r=>db.sanluong.push({"Phiếu cân":r["Phiếu cân"],"Ngày cân":r["Ngày cân 1"],"KL hàng (Tấn)":r["KL hàng (Tấn)"],"Mã phòng ban":r["Mã phòng ban"],"NV vắng":r["NV vắng"]||""}));
D.DL_Ungluong.forEach(r=>{if(r["Mã NV2"])db.ungluong.push({"Ngày hạch toán":r["Ngày hạch toán"],"Mã NV":r["Mã NV2"],"Tạm ứng":r["Tạm ứng"]});});
D.DL_PSLUONG.forEach(r=>{if(r["Mã NV"])db.psluong.push({"Ngày hạch toán":r["Ngày hạch toán"],"Mã NV":r["Mã NV"],"Thưởng":r["Thưởng"],"Thu nhập khác":r["Thu nhập khác"],"Trừ khác":r["Trừ khác"]});});
db.congty=[{"Mã công ty":"HAKDN","Tên công ty":"HAK","Quy chế tính lương":qc}];
const sp=HR.staffForPayroll(db,2025,9), slK=HR.sanLuongKy(db,2025,9,"sanluong"), bdK=HR.sanLuongKy(db,2025,9,"bandam");
const bu=process.argv[3]||"to";
const kq=E.tinhBangLuong(Object.assign({},db,{nhansu:sp.list,sanluong:slK.rows,bandam:bdK.rows}),2025,9,bu==="false"?false:bu,{quyChe:qc});
console.log("staff",sp.list.length,"warn",sp.warn.length,"alloc unalloc",slK.alloc.unallocated,"canhbao",kq.canhbao.length);
const M={"Lương thời gian":"Lương thời gian","Sản lượng (Tấn)":"Sản lượng (tấn)","Lương sản lượng":"Lương sản lượng","Lương bù sản lượng":"Lương bù SL","Lương ban dăm":"Lương bơm dăm","Lương tăng ca":"Tiền tăng ca","Phụ cấp công tác":"Phụ cấp công tác","Phụ cấp TN":"Phụ cấp","Tiền cơm":"Tiền cơm","Lương hỗ trợ":"Lương hỗ trợ","Cộng BH NLĐ":"BH trừ NLĐ","NLĐ.KPCĐ":"KPCĐ trừ NLĐ","Truy thu bảo hiểm":"Truy thu BH","Tạm ứng":"Tạm ứng","Tổng thu nhập":"Tổng thu nhập"};
const app={};kq.bangluong.forEach(b=>app[b["Mã NV"]]=b);
const diffs={};let ok=0;const bad=[];
D.RP_THLUONG.forEach(x=>{const ma=x["Mã nhân viên/CCCD"],b=app[ma];if(!b){bad.push(ma+" thiếu");return;}
 const dd=[];Object.keys(M).forEach(k=>{const e=+x[k]||0,a=+b[M[k]]||0;if(Math.abs(e-a)>(k==="Sản lượng (Tấn)"?0.01:1)){dd.push(k+": Excel "+Math.round(e*100)/100+" / App "+Math.round(a*100)/100);diffs[k]=(diffs[k]||0)+1;}});
 if(dd.length)bad.push(x["Mã tiền lương 1"]+" "+x["Họ và tên"]+" ["+ma.slice(-4)+"] "+dd.join(" | "));else ok++;});
console.log("Khớp hoàn toàn (trước thuế/thực lĩnh):",ok,"/",D.RP_THLUONG.length);console.log(diffs);console.log(bad.join("\n"));
console.log("--- cảnh báo phân bổ ---");slK.alloc.warnings.slice(0,12).forEach(w=>console.log(w.slice(0,260)));
const tot=D.RP_THLUONG.reduce((s,x)=>s+(+x["Sản lượng (Tấn)"]||0),0), tA=kq.bangluong.reduce((s,x)=>s+(+x["Sản lượng (tấn)"]||0),0);
console.log("Tổng tấn Excel(NV)",tot.toFixed(2),"App(NV)",tA.toFixed(2),"Tổng phiếu",D.DL_Sanluong.reduce((s,r)=>s+(+r["KL hàng (Tấn)"]||0),0).toFixed(2));
{ // So sánh RIÊNG phần phân bổ sản lượng khi giả lập đủ công mọi ngày (để cô lập khác biệt do quy tắc công/ngày — R-73, V5 mục IX)
  const db2=JSON.parse(JSON.stringify(db));
  const sp=new Set(D.NL_NHANSU.filter(r=>/^02\./.test(r["Mã PB"])).map(r=>r["Mã nhân viên/CCCD"]));
  db2.chamcong.forEach(r=>{if(sp.has(r["Mã NV"])&&r["Hình thức công"]==="BT")days.forEach(d=>{if(+d<=30)r[d]=1;});});
  const s2=HR.sanLuongKy(db2,2025,9,"sanluong"); const by={};s2.rows.forEach(x=>by[x["Mã NV"]]=(by[x["Mã NV"]]||0)+(+x["KL hàng (Tấn)"]||0));
  let bad=0;D.RP_THLUONG.filter(x=>x["Mã tiền lương 1"]==="SP").forEach(x=>{const e=+x["Sản lượng (Tấn)"],a=by[x["Mã nhân viên/CCCD"]]||0;if(Math.abs(e-a)>0.01){bad++;console.log("LỆCH",x["Họ và tên"],e,a.toFixed(2));}});
  console.log("Phân bổ sản lượng với giả lập đủ công: lệch",bad,"/16; chưa phân bổ",s2.alloc.unallocated.toFixed(2));
}
