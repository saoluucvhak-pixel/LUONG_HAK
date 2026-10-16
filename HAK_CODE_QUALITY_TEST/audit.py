import argparse,json,pathlib,re,sys
EXT={'.js','.jsx','.ts','.tsx','.py','.gs','.html','.json'}
SKIP={'node_modules','.git','dist','build','.venv','venv','coverage','__pycache__'}
RULES=[('SECRET_ASSIGNMENT',re.compile(r'(?i)\b(?:password|api[_-]?key|secret|token)\s*[:=]\s*[\'\"][^\'\"]{8,}[\'\"]'),'high'),('DANGEROUS_EVAL',re.compile(r'\b(?:eval|new Function)\s*\('),'medium'),('INSECURE_HTML',re.compile(r'\.innerHTML\s*='),'medium'),('BARE_EXCEPT',re.compile(r'^\s*except\s*:\s*$',re.M),'medium')]
def scan(root):
 findings=[];count=0
 for p in root.rglob('*'):
  if not p.is_file() or p.suffix.lower() not in EXT or any(x in SKIP for x in p.relative_to(root).parts) or p.stat().st_size>2000000:continue
  count+=1
  try:lines=p.read_text(encoding='utf-8').splitlines()
  except UnicodeError:continue
  for n,line in enumerate(lines,1):
   if 'hak-audit-ignore-line' in line:continue
   for code,rx,severity in RULES:
    if rx.search(line):findings.append({'file':str(p.relative_to(root)),'line':n,'rule':code,'severity':severity})
 return {'schemaVersion':1,'scannedFiles':count,'findings':findings,'high':sum(x['severity']=='high' for x in findings)}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('path',nargs='?',default='.');parser.add_argument('--fail-on-high',action='store_true');args=parser.parse_args()
 report=scan(pathlib.Path(args.path).resolve());print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(1 if args.fail_on_high and report['high'] else 0)
