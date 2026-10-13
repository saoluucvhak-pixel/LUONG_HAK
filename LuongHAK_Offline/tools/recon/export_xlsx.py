"""Xuất các sheet của workbook lương HAK (NL_*, DL_*, RP_*) ra JSON để chạy tools/recon/*.js.
Dùng: python3 export_xlsx.py <file.xlsx> <out.json> [header_row_của_RP_THBL]
File xuất ra chứa dữ liệu cá nhân — giữ ngoài repo."""
import sys, json, datetime, openpyxl
src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
def tab(n):
    rows = list(wb[n].iter_rows(values_only=True)); h = [str(x).strip() if x is not None else '' for x in rows[0]]; res = []
    for r in rows[1:]:
        if all(v is None for v in r): continue
        d = {}
        for k, v in zip(h, r):
            if not k: continue
            if isinstance(v, (datetime.datetime, datetime.date)): v = v.strftime('%Y-%m-%d')
            d[k] = v
        res.append(d)
    return res
def thbl():
    rows = list(wb['RP_THBL'].iter_rows(values_only=True)); h = rows[4]
    return [{str(k).strip(): v for k, v in zip(h, r) if k} for r in rows[5:] if not (r[3] is None and r[2] is None)]
data = {n: tab(n) for n in wb.sheetnames if n.startswith(('NL_', 'DL_', 'RP_THLUONG', 'RP_BHXH'))}
if 'RP_THBL' in wb.sheetnames: data['RP_THBL'] = thbl()
json.dump(data, open(out, 'w'), ensure_ascii=False, default=str)
