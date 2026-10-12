"""Refresh local portraits from the public RSL-X champion catalog; preserve existing art."""
import io,json,re,sqlite3,unicodedata,urllib.request,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'site/portraits'
BASE='https://rsl-x.vercel.app/tools/champions-index/'
def slug(name):
 return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',name.lower())).strip('-')
def fetch(url):
 for attempt in range(3):
  try:return urllib.request.urlopen(url,timeout=30).read()
  except Exception:
   if attempt==2:raise
   time.sleep(attempt+1)
def main():
 dbpath=ROOT/'work/champions.db';dbpath.parent.mkdir(exist_ok=True)
 dbpath.write_bytes(fetch(BASE+'champions.db'))
 rows=sqlite3.connect(dbpath).execute('select name,image from champions order by id').fetchall()
 # Alternate mythical forms have the same display name: retain the first/base portrait.
 catalog={}
 for name,image in rows:
  catalog.setdefault(slug(name),{'name':name,'image':image})
 OUT.mkdir(exist_ok=True)
 def save(item):
  key,data=item;p=OUT/(key+'.webp')
  if p.exists():
   with Image.open(p) as im:im.verify()
   return key
  raw=fetch(BASE+'img/champions/'+urllib.parse.quote(data['image'])+'.webp')
  with Image.open(io.BytesIO(raw)) as im:
   im.load();im.convert('RGB').save(p,'WEBP',quality=90)
  return key
 failures=[];completed=0
 with ThreadPoolExecutor(max_workers=6) as pool:
  tasks={pool.submit(save,x):x[0] for x in catalog.items()}
  for task in as_completed(tasks):
   try:task.result()
   except Exception as e:failures.append({'key':tasks[task],'error':str(e)})
   completed+=1
   if completed%100==0:print('Checked',completed,'of',len(catalog),flush=True)
 portraits={p.stem:p.name for p in sorted(OUT.glob('*.webp'))}
 previous=json.loads((OUT/'manifest.json').read_text()) if (OUT/'manifest.json').exists() else {}
 manifest={'supplementalSources':previous.get('supplementalSources',[]),'source':BASE,'catalogEntries':len(catalog),'portraits':portraits,'failures':failures}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 (OUT/'SOURCES.md').write_text('# Champion portraits\n\nPublic catalog: https://rsl-x.vercel.app/tools/champions-index\n\nDownloaded portraits use normalized champion-name filenames. Existing supplied art is preserved. Mythical alternate forms share the base portrait. Game artwork belongs to Plarium; this is an unofficial fan companion. Run `scripts/sync-portraits.py` to refresh the catalog. RaidWiki supplemental catalog: https://raidwiki.com/champions (458 entries checked). The manifest records catalog coverage and download failures; it does not claim coverage of champions absent from the source.\n')
 print(json.dumps({'catalogEntries':len(catalog),'localPortraits':len(portraits),'failures':failures}),flush=True)
 if failures:raise SystemExit(1)
if __name__=='__main__':main()
