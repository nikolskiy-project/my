#!/usr/bin/env python3
"""Rebuild the offline index from original user-supplied rule texts.

Numbered rules keep exact wording. Nested rule numbers are scoped by sub-ustav,
so, for example, Disciplinary 13 and Internal Service 13 are separate entries.
"""
from __future__ import annotations
import json, re
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'data/rules.json'
NUM=re.compile(r'^\s*(\d{1,3}(?:\.\d{1,3}){0,3})\s*\|\s*(.*)')
CH=re.compile(r'^Глава\s+\d+\s*[.:]\s*.+')
USTAVS={'Устав внутренней службы':('internal','Устав внутренней службы'),
'Дисциплинарный устав':('discipline','Дисциплинарный устав'),
'Устав комендантской и караульной служб':('guard','Устав комендантской и караульной служб'),
'Строевой устав':('drill','Строевой устав')}

def lines_of(name):return (ROOT/'sources'/name).read_text(encoding='utf-8-sig').replace('\r','').splitlines()

def numbered(name,source, initial='main'):
    rows=lines_of(name); group=initial; group_label='Общие положения'; chapter=''; current=None; output=[]; started=(name not in ('2.txt',))
    if name=='2.txt': group='general'; group_label='Общие положения'; started=False
    if name=='3.txt': group='base';group_label='Зоны воинской части'
    def finish():
        nonlocal current
        if current:
            current['text']='\n'.join(current.pop('parts')).strip()
            current['title']=current['text'].split('\n',1)[0].strip()[:170]
            current['kind']='original'
            output.append(current)
            current=None
    for lineno,raw in enumerate(rows):
        line=raw.strip()
        if not line:continue
        if name=='2.txt' and not started:
            if line=='Общее положение' and lineno>=20:started=True
            continue
        if name=='2.txt' and line in USTAVS:
            finish();group,group_label=USTAVS[line];chapter='';continue
        if name=='3.txt' and line.startswith('Положение «О зонах военных комиссариатов»'):
            finish();group='commissariat';group_label='Зоны военкоматов';chapter='';continue
        if CH.match(line):
            finish();chapter=line;continue
        if line in ('Общее положение','Положение «О поставках боеприпасов частным охранным предприятиям»'):
            finish();continue
        m=NUM.match(raw)
        if m:
            finish();num,rest=m.groups()
            uid=f'{source}.{group}-{num}'
            current={'id':uid,'source':source,'number':num,'unit':group_label,'unitCode':group,'chapter':chapter,'parts':[rest] if rest else []}
        elif current:
            current['parts'].append(line)
        # Ignore headings before first clause, e.g. image labels and appendix titles.
    finish()
    assert len({x['id'] for x in output})==len(output), f'duplicate IDs in {name}'
    return output

def info_sections():
    lines=lines_of('5.txt'); start=next(i for i,s in enumerate(lines) if s.startswith('В данном разделе собрана')); rows=lines[start:]
    current=None;output=[];chapter='Введение';sub='';seq=0
    def finish():
        nonlocal current,seq
        if not current:return
        text='\n'.join(current).strip()
        if text:
            seq+=1
            first=text.splitlines()[0]
            title=first.lstrip('•- ').strip().rstrip(':')
            # Expose names in standalone search results.
            if title.lower().startswith('bind '):title='Бинд: '+title[:140]
            output.append({'id':f'info.info-{seq}', 'source':'info','number':str(seq),'unit':sub or chapter,
                           'unitCode':f'info-{seq}','chapter':chapter,'title':title[:170], 'text':text,'kind':'original'})
        current=None
    def section(s):
        nonlocal sub
        finish();sub=s
    for raw in rows:
        s=raw.strip()
        if not s:continue
        if CH.match(s):
            finish();chapter=s;sub='';continue
        # Avoid bare image placeholders becoming fake rule text? Keep them in the index.
        if s.startswith('• ') or s.startswith('•\t'):
            finish();current=[s];continue
        if re.match(r'^(?:Код-\d|\d{2}-\d{1,2}\s*[—–-]|/r\s+\[|bind\s+)',s,re.I):
            finish();current=[s];continue
        if s in ('Требования к призывнику','Основные причины отказа','Основные правила совершения докладов','Основные тен-коды',
                 'Образцы докладов','Специальные тен-коды для ЭАА','Вооружение и амуниция:','Транспорт и техника:',
                 'Основные команды','Команды, доступные только в определённых нарядах','Воинское приветствие',
                 'Представление военнослужащего и предоставление удостоверения','Требование покинуть охраняемую территорию',
                 'Отыгровки рации','Отыгровка шлагбаума','Анимации строевой подготовки (необязательные)',
                 'Наряд охраны пропускного пункта','Примечание','Пример','Подсказка'):
            section(s);continue
        if current is None:current=[s]
        else:
            # Don't swallow short intro paragraphs into the previous unrelated bullet.
            if s.startswith(('Наряд —','Если во время','Покидать территорию','Открыть шлагбаум','Доступен со звания','Доступна с')):
                finish();current=[s]
            else:current.append(s)
    finish()
    return output

def main():
    db=json.loads(DB.read_text(encoding='utf-8'))
    catalog={x['id']:x for x in db['items'] if x['source'] in ('vps','opgo')}
    builds=[('1.txt','supply-chop'),('2.txt','ustav'),('3.txt','zones'),('4.txt','supply')]
    for filename,source in builds:
        found=numbered(filename,source)
        assert len(found)>=8,(filename,len(found))
        print(filename,source,len(found),'пунктов')
        for x in found:catalog[x['id']]=x
        db.setdefault('sourceStatus',{})[source]={'status':'full','reason':'Полный текст пользовательского файла '+filename}
    found=info_sections()
    print('5.txt info',len(found),'записей')
    assert len(found)>=60, len(found)
    for x in found:catalog[x['id']]=x
    db['sourceStatus']['info']={'status':'full','reason':'Текстовый информационный раздел из 5.txt; схемы/фотографии в TXT не входят'}
    order=list(db['sources'])
    # stable file order across reloads; numeric order in each subdocument
    db['items']=sorted(catalog.values(),key=lambda x:(order.index(x['source']),x.get('unitCode',''),int(x['number'].split('.')[0]) if x['number'].split('.')[0].isdigit() else 999,int(x['number'].split('.')[-1]) if '.' in x['number'] else 0))
    db['updatedAt']=date.today().isoformat()
    db['mode']='partial' if any(db['sourceStatus'].get(s,{}).get('status')!='full' for s in db['sources']) else 'full'
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'data/rules.js').write_text('window.PROVINCE_RULES = '+json.dumps(db,ensure_ascii=False)+';\n',encoding='utf-8')
    print('ИТОГО',len(db['items']))
    print('СТАТУСЫ',[(s,db['sourceStatus'].get(s,{}).get('status')) for s in db['sources']])
if __name__=='__main__':main()
