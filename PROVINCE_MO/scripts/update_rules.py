#!/usr/bin/env python3
"""Refresh the two publicly available server rule sources (VPS and OPGO).

Run `python scripts/update_rules.py --fetch` to download VPS and OPGO.
Run `python scripts/update_rules.py --browser` for script-rendered posts.
If a post requires authorization, use `--browser --visible` and sign in once.
Saved HTML/TXT files in `imports/` take priority. A page with no rule text never
replaces an existing catalog, and its state is reported as unavailable.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'data/rules.json'
NUMBER = re.compile(r'^\s*(?:Статья|Пункт|§)?\s*(\d{1,3}(?:\.\d{1,3}){1,3})\s*(?:[.:)\]—–-]\s*|\s+)(.*)$', re.I)
CHAPTER = re.compile(r'^\s*(?:(?:Глава|Раздел|Часть)\s+[\dIVX]+|\d{1,2}\.\s+[^\d]).*$', re.I)
STOP = ('Поделиться сообщением','Ссылка на сообщение','Эта тема закрыта для публикации ответов')


def clean(line: str) -> str:
    return re.sub(r'\s+',' ',line.replace('\xa0',' ')).strip()


def extract(html: str) -> tuple[list[str], list[tuple[str,str]]]:
    from bs4 import BeautifulSoup, NavigableString
    soup = BeautifulSoup(html,'html.parser')
    post = (soup.select_one('article[data-commentid]') or soup.select_one('article.ipsComment') or
            soup.select_one('div[data-role="commentContent"]') or soup.select_one('[data-role="commentContent"]'))
    if post is None:
        return [], []
    body = post.select_one('[data-role="commentContent"]') or post.select_one('.ipsType_richText') or post
    links=[]
    for a in body.select('a[href]'):
        href=a.get('href','')
        label=clean(a.get_text(' ',strip=True))
        if label and href.startswith(('http://','https://','/')) and len(label)>5:
            links.append((label,urljoin('https://forum.gtaprovince.ru/',href)))
    for x in list(body.select('script, style, nav, blockquote, .ipsQuote, .ipsEmbedded, .ipsSpoiler_header')):
        x.decompose()
    for tag in list(body.select('br')):
        tag.replace_with(NavigableString('\n'))
    # Insert boundaries before numbered elements; preserve explanations and subclauses.
    for tag in list(body.find_all(['p','li','tr','h1','h2','h3','h4','h5','section'])):
        tag.insert_before(NavigableString('\n'))
        tag.insert_after(NavigableString('\n'))
    for tag in list(body.find_all('div')):
        if tag.find(['p','li','h2','h3','h4']):
            continue
        tag.insert_before(NavigableString('\n'))
        tag.insert_after(NavigableString('\n'))
    raw=body.get_text(' ',strip=False)
    raw=re.sub(r'(?<!\d)[ \t]+(?=\d{1,3}(?:\.\d{1,3}){1,3}\s*[—–-])','\n',raw)
    lines=[clean(s) for s in raw.replace('\r','').split('\n')]
    return [s for s in lines if s and s not in ('Спойлер','***')],links


def parse(lines: list[str], source: str) -> list[dict]:
    sections=[]; current=None; chapter=''; seen=set()
    for line in lines:
        if line.startswith(STOP):break
        if CHAPTER.match(line) and not NUMBER.match(line):chapter=line[:160]
        match=NUMBER.match(line)
        if match:
            number,rest=match.groups()
            if number in seen:continue
            seen.add(number)
            if current: sections.append(current)
            current={'source':source,'number':number,'parts':[rest] if rest else [],'chapter':chapter}
            continue
        if current:
            current['parts'].append(line)
    if current:sections.append(current)
    result=[]
    for x in sections:
        txt='\n'.join(x.pop('parts')).strip()
        if len(txt)<8:continue
        first=next((l for l in txt.split('\n') if l.strip()),'Пункт '+x['number'])
        x.update(id=f"{source}-{x['number']}",title=first[:165],text=txt[:35000],kind='imported')
        result.append(x)
    return result


def info_links(lines: list[str], links: list[tuple[str,str]], source: str) -> list[dict]:
    if source!='info':return []
    seen=set();output=[]
    for label,url in links:
        if (label,url) in seen or len(label)<9 or urlparse(url).netloc not in ('forum.gtaprovince.ru','docs.google.com'):continue
        seen.add((label,url));n=len(output)+1
        output.append({'id':f'info-link-{n}', 'source':'info','number':f'ресурс-{n}','title':label[:145], 'text':f'{label}\n{url}', 'chapter':'Информационные ресурсы Министерства обороны', 'url':url, 'kind':'link'})
    return output[:150]


def request_page(url: str) -> str:
    import requests
    r=requests.get(url,timeout=(7,14),headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0','Accept-Language':'ru-RU,ru;q=0.9,en;q=0.8'})
    r.raise_for_status()
    return r.text


def chromium_pages(pages:dict[str,str], visible:bool) -> dict[str,str]:
    from playwright.sync_api import sync_playwright
    out={}
    profile=ROOT/'.browser-profile'
    with sync_playwright() as p:
        browser=p.chromium.launch_persistent_context(user_data_dir=str(profile),headless=not visible,
          viewport={'width':1280,'height':900},locale='ru-RU')
        try:
            for key,url in pages.items():
                page=browser.new_page()
                try:
                    page.goto(url,wait_until='domcontentloaded',timeout=45000)
                    page.wait_for_timeout(2600)
                    if visible:
                        print(f'{key}: если нужен вход на форум, выполни его в окне браузера, затем вернись к терминалу и нажми Enter')
                        input()
                        page.reload(wait_until='domcontentloaded',timeout=45000)
                        page.wait_for_timeout(1500)
                    out[key]=page.content()
                except Exception as exc:print(f'  {key}: браузерная загрузка не удалась: {exc}')
                finally:page.close()
        finally:browser.close()
    return out


def build(fetch:bool,browser:bool,visible:bool,input_dir:str):
    db=json.loads(DB.read_text(encoding='utf-8'))
    inputs=ROOT/input_dir
    lookup={x['id']:x for x in db.get('items',[])}
    status=db.setdefault('sourceStatus',{})
    htmls={};origin={};
    for key in ('vps','opgo'):
        meta=db['sources'][key]
        for ext in ('.html','.htm','.txt'):
            f=inputs/f'{key}{ext}'
            if f.exists():
                htmls[key]=(f.read_text(encoding='utf-8-sig'),ext)
                origin[key]=str(f.relative_to(ROOT));break
    remote={key:db['sources'][key]['url'] for key in ('vps','opgo') if key not in htmls}
    if fetch and not browser:
        from concurrent.futures import ThreadPoolExecutor,as_completed
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures={pool.submit(request_page,url):key for key,url in remote.items()}
            for future in as_completed(futures):
                key=futures[future]
                try:htmls[key]=(future.result(),'.html');origin[key]=remote[key]
                except Exception as e:print(f'  {key}: не удалось загрузить: {e}')
    if browser:
        try:
            for key,content in chromium_pages(remote,visible).items():htmls[key]=(content,'.html');origin[key]=remote[key]
        except ImportError:
            print('Для режима --browser установи playwright: pip install playwright && python -m playwright install chromium')
    for key in ('vps','opgo'):
        if key not in htmls:
            if status.get(key,{}).get('status') not in ('full','seed'):status[key]={'status':'unavailable','reason':'Источник не удалось загрузить'}
            continue
        raw,ext=htmls[key]
        if ext=='.txt':lines=[clean(x) for x in raw.splitlines() if clean(x)];links=[]
        else:lines,links=extract(raw)
        candidates=parse(lines,key)
        if not candidates:candidates=info_links(lines,links,key)
        count_existing=sum(1 for x in lookup.values() if x['source']==key)
        if not candidates or (len(candidates)<count_existing and count_existing>30):
            print(f'  {key}: текст правил недоступен либо неполон ({len(candidates)} пунктов, было {count_existing}); сохранён предыдущий каталог')
            if status.get(key,{}).get('status') not in ('full','seed'):status[key]={'status':'unavailable','reason':'На странице отсутствует читаемый текст нормативных пунктов'}
            continue
        # Replacing a cached seed with the full, verified forum article.
        for k in list(lookup):
            if lookup[k]['source']==key:del lookup[k]
        for x in candidates:lookup[x['id']]=x
        status[key]={'status':'full','reason':f'{len(candidates)} пунктов из {origin[key]}' if ext!='.txt' else f'{len(candidates)} пунктов из сохранённого текста'}
        print(f'  {key}: загружено {len(candidates)} пунктов')
    db['items']=sorted(lookup.values(),key=lambda x:(list(db['sources']).index(x['source']), x.get('unitCode',''),tuple(int(v) if v.isdigit() else v for v in re.split(r'[.]',str(x['number'])))))
    db['updatedAt']=date.today().isoformat()
    db['mode']='full' if all(status.get(k,{}).get('status')=='full' for k in db['sources']) else 'partial'
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'data'/'rules.js').write_text('window.PROVINCE_RULES = '+json.dumps(db,ensure_ascii=False)+';\n',encoding='utf-8')
    print('\nИтого:',len(db['items']),'пунктов; разделов с доступным текстом:',sum(status.get(k,{}).get('status')=='full' for k in db['sources']),'из',len(db['sources']))
    for key in db['sources']:
        if status.get(key,{}).get('status')!='full':print('  НЕ ПОЛОН:',key,'—',status[key].get('reason',''))
    return 0

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--fetch',action='store_true',help='Скачать тексты шести тем с форума')
    ap.add_argument('--browser',action='store_true',help='Прочитать темы через Chromium (требуется Playwright)')
    ap.add_argument('--visible',action='store_true',help='Открыть браузер для возможного входа в форум')
    ap.add_argument('--input-dir',default='imports',help='Папка с HTML/TXT страницами (приоритет перед сетью)')
    a=ap.parse_args();sys.exit(build(a.fetch,a.browser,a.visible,a.input_dir))
