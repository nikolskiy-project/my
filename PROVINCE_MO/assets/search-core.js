/* Offline search for Province MO: typo tolerance, aliases, token stems, source-aware ranking. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.RuleSearch=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const STOP=new Set('я мы ты он она они вы это его ее им как какой какое какая какие когда где зачем почему что чтобы про за и или в во на по до от с со о об к ко из для при под над не но да ли же бы есть можно нельзя мне мой моя мои свое ли сколько после чем быть должен должны обязаны правило правила пункт пункты нарушение нужно расскажи мне перечисли назови узнать скажи покажи полный список виды какой какая хотя бы'.split(/\s+/));
const DOC_NAMES={vps:['впс','правила сервера','внутренние правила'],opgo:['опго','гос организации','госорганизации'],ustav:['устав','уставы','общевоинские','воинский','дисциплинарный','караульный','строевой'],zones:['зона','зоны','периметр','военкомат','кпп'],supply:['поставка','поставки','боеприпасы','бп','мвд'],info:['инфо','информационный','тен коды','команды'], 'supply-chop':['чоп','частное охранное предприятие','охранное предприятие']};
const GROUPS=[
 {aliases:['виды взысканий','виды сзысканий','какие взыскания','какие есть взыскания','какие наказания в мо','список наказаний','меры взысканий','дисциплинарные взыскания','дисциплинарка','сзыскания','сзысканий','взысканий','взыскание в армии'],terms:['устное предупреждение','наряд вне очереди','карцер','письменный выговор','увольнение'],targets:['ustav.discipline-13']},
 {aliases:['виды поощрений','список поощрений','как поощряют','чем награждают','награды','благодарность'],terms:['поощрения','благодарности','награды'],targets:['ustav.discipline-6']},
 {aliases:['уволят','уволили','увольнение','выгонят из фракции','три выговора','3 выговора','за выговоры'],terms:['увольнение','выговор'],targets:['opgo-6.3']},
 {aliases:['три преда','3 предупреждения','сколько предупреждений','преды','выговор за предупреждения'],terms:['предупреждение','выговор'],targets:['opgo-6.1','opgo-6.2']},
 {aliases:['очс','черный список','чс госок','черный список госорганизаций'],terms:['общий черный список','увольнение'],targets:['ustav.discipline-13','opgo-6.6.1','opgo-6.6.2','opgo-6.6.3']},
 {aliases:['сколько можно афк','афк','afk','отошел','спать на посту','сон на посту','бездействие','стоять афк'],terms:['сон','afk','минут'],targets:['ustav.discipline-21','opgo-11.25']},
 {aliases:['дезертирство','самоволка','самовольно ушел','ушел из части','покинул вч'],terms:['дезертирство','покидать часть'],targets:['ustav.discipline-14','ustav.internal-40']},
 {aliases:['своя машина','свое авто','личная тачка','личный автомобиль','личный транспорт','на своем авто','своя тачка'],terms:['личный транспорт'],targets:['opgo-11.10','ustav.discipline-32']},
 {aliases:['скрины','пруфы','доква','доказуха','сколько хранить скрины','хранение доказательств','видео доказательства'],terms:['доказательства','хранить'],targets:['opgo-4.6','ustav.discipline-37']},
 {aliases:['субординация','порядок подчинения','неподчинение','не слушается командира','старший по званию'],terms:['субординация','приказы'],targets:['ustav.internal-14','ustav.internal-21','ustav.internal-36','ustav.discipline-18']},
 {aliases:['график','рабочее время','во сколько смена','когда смена','рабочий день','смена контрактника'],terms:['смена','будние дни','суббота'],targets:['ustav.internal-38','opgo-3.1']},
 {aliases:['поверка','когда построение','общее построение','когда проверка личного состава'],terms:['поверка','среда','суббота'],targets:['ustav.internal-39']},
 {aliases:['кпп','пропускной пункт','проходная','пропуск','проверка на кпп'],terms:['пропускной пункт','документы'],targets:['zones.base-8','zones.base-9']},
 {aliases:['зеленая зона','желтая зона','жёлтая зона','красная зона','черная зона','чёрная зона','запретная зона','границы части','какие зоны'],terms:['зоны','красная','желтая','черная'],targets:['zones.base-3','zones.base-8']},
 {aliases:['зона военкомата','оранжевая зона','призывная зона','доступ в военкомат'],terms:['военкомат','оранжевая'],targets:['zones.commissariat-4','zones.commissariat-8']},
 {aliases:['поставка мвд','поставки в мвд','поставка полиции','сколько до поставки','заявка на бп'],terms:['поставка','мвд','часов'],targets:['supply.main-5','supply.main-5.1']},
 {aliases:['как далеко от колонны','на каком расстоянии от колонны','отойти от колонны','пять метров от колонны'],terms:['пять метров','отойти от колонны'],targets:['supply.main-3','supply-chop.main-4']},
 {aliases:['поставка чоп','поставки чоп','сколько стоит ящик','цена патронов','сколько ящиков чоп'],terms:['частное охранное','ящиков','рублей'],targets:['supply-chop.main-7']},
 {aliases:['рация','доклад','доклады','тен код','тенкоды','тен коды','коды','код 0','код 1','код 2','код 3','код 4'],terms:['доклад','код','рация'],source:'info'},
 {aliases:['команды мо','как открыть шлагбаум','открыть ворота','как включить тревогу','бинды мо','отыгровки'],terms:['команда','шлагбаум','тревога'],source:'info'},
 {aliases:['виды взысканий в армии','перечень взысканий','какие существуют взыскания','список взысканий','какие бывают взыскания'],terms:['взыскания','предупреждение','карцер'],targets:['ustav.discipline-13']},
 {aliases:['патруль','часовой','вышка','наряды','посты','караул','охрана территории'],terms:['наряд','часовой','охрану'],source:'info'},
 {aliases:['дм','dm','дезматч','убийство без причины','мг','mg','тк','tk','дб','db','nonrp','нонрп'],terms:['нарушение rp','игровой процесс'],source:'vps'}
];
function norm(s){return String(s??'').toLowerCase().normalize('NFKC').replace(/ё/g,'е').replace(/[«»“”'`]/g,' ').replace(/[-–—‑]/g,' ').replace(/[^a-zа-я0-9./]+/gi,' ').replace(/\s+/g,' ').trim();}
function stem(w){w=norm(w);if(w.length<5||/^\d/.test(w))return w;return w.replace(/(иями|ями|ениями|ение|ений|остью|ость|овать|ировать|ались|ивающий|ивший|ившие|ающего|ающая|ающиеся|ового|овыми|енных|ения|аться|иться|аете|аются|яются|ного|ными|овая|овые|ыми|ому|ему|его|ая|ою|ам|ям|ов|ев|ах|ях|ом|ем|им|ит|ут|ют|ал|ила|или|ено|ить|ать|ый|ий|ое|ую|ой|ые|у|ы|и|а|я|е|о)$/u,'');}
function tokenize(s){return norm(s).split(' ').filter(x=>x.length>1&&!STOP.has(x));}
function similar(a,b){if(a===b)return 1;if(a.length<4||b.length<4)return 0;const x=stem(a),y=stem(b);if(x.length>=4&&y.length>=4&&(x===y||(x.startsWith(y)&&x.length-y.length<=2)||(y.startsWith(x)&&y.length-x.length<=2)))return .8;if(Math.abs(a.length-b.length)>1||a.length<5||b.length<5)return 0;let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++e>1)return 0;if(a.length>b.length)i++;else if(a.length<b.length)j++;else{i++;j++;}}return e+((i<a.length||j<b.length)?1:0)<=1?.52:0;}
function wordScore(words,t){let s=0;for(const w of words){if(w===t)return 1;s=Math.max(s,similar(w,t));}return s;}
function matchesAlias(q,g){const all=norm(q);const words=tokenize(q);return g.aliases.some(alias=>{const a=norm(alias);return a.includes(' ')?all.includes(a):words.some(t=>similar(t,a)>=.75);});}
function indexItem(x){const title=norm(x.title),content=norm(x.text||x.summary||''),tags=norm(x.tags||''),unit=norm((x.unit||'')+' '+(x.chapter||''));return {...x,_normText:content,_normTitle:title,_title:tokenize(title),_content:tokenize(content),_tags:tokenize(tags),_unit:tokenize(unit)};}
function numberQuery(q){let s=norm(q).replace(/^(пункт|п|статья|ст)\s+/,'');let m=s.match(/^(?:(впс|опго|дисциплинарный устав|дисциплинарный|ду|увс|внутренней службы|устав|мо|строевой|караульный|зоны|военкомат|поставки|чоп|инфо)\s+)?(?:пункт\s+)?(\d{1,3}(?:\.\d{1,3}){0,3})$/);if(!m)return null;let spec=m[1]||'';const map={впс:'vps',опго:'opgo',ду:'ustav',увс:'ustav',мо:'ustav',устав:'ustav','дисциплинарный':'ustav','дисциплинарный устав':'ustav','внутренней службы':'ustav',строевой:'ustav',караульный:'ustav',зоны:'zones',военкомат:'zones',поставки:'supply',чоп:'supply-chop',инфо:'info'};let unit=spec.includes('дисциплинар')||spec==='ду'?'discipline':spec==='увс'||spec.includes('внутренней')?'internal':spec==='строевой'?'drill':spec==='караульный'?'guard':spec==='военкомат'?'commissariat':null;return{source:map[spec]||null,unit,number:m[2]};}
function numericSort(a,b){const aa=String(a).split('.').map(Number),bb=String(b).split('.').map(Number);for(let i=0;i<Math.max(aa.length,bb.length);i++){const d=(aa[i]??-1)-(bb[i]??-1);if(d)return d;}return 0;}
function search(items,query,opts={}){
 const q=norm(query),tokens=tokenize(q),groups=GROUPS.filter(g=>matchesAlias(q,g)),ref=numberQuery(query),source=opts.source||'all';let hits=[];
 for(const raw of items){let x=raw._content?raw:indexItem(raw);if(source!=='all'&&x.source!==source)continue;
  if(!q){hits.push({...x,_score:1});continue;}
  if(ref){if(x.number===ref.number&&(!ref.source||x.source===ref.source)&&(!ref.unit||x.unitCode===ref.unit))hits.push({...x,_score:9999});continue;}
  let score=0,matched=0;
  if(q.length>=4&&x._normTitle.includes(q))score+=115;
  if(q.length>=4&&x._normText.includes(q))score+=75;
  for(const t of tokens){const v=Math.max(wordScore(x._title,t)*60,wordScore(x._unit,t)*27,wordScore(x._tags,t)*40,wordScore(x._content,t)*19);score+=v;if(v)matched++;}
  if(tokens.length>1)score*=.32+.68*matched/tokens.length;
  for(const g of groups){
    if(g.targets?.includes(x.id))score+=250;
    if(g.source&&g.source!==x.source)continue;
    const keywordCount=tokenize(g.terms.join(' ')).reduce((n,t)=>n+(wordScore([...x._title,...x._unit,...x._content],t)>.5?1:0),0);
    score+=Math.min(35,keywordCount*7);
  }
  const hint=Object.entries(DOC_NAMES).find(([,names])=>names.some(k=>q===norm(k)));
  if(hint&&hint[0]===x.source)score+=15;
  if(score>=Math.max(11,tokens.length*3))hits.push({...x,_score:Math.round(score*10)/10});
 }
 hits.sort((a,b)=>b._score-a._score||a.source.localeCompare(b.source)||numericSort(a.number,b.number));return hits;
}
return{norm,tokenize,stem,indexItem,search,numberQuery,numericSort,GROUPS};
});
