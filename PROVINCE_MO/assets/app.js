'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const el = {search:$('#searchInput'),clear:$('#clearBtn'),dockSearch:$('#dockSearchInput'),dockClear:$('#dockClearBtn'),grid:$('#resultsGrid'),count:$('#resultCount'),title:$('#resultsTitle'),caption:$('#resultsCaption'),more:$('#moreBtn'),sort:$('#sortSelect'),sourceGrid:$('#sourceGrid'),notice:$('#dataNotice'),date:$('#dataDate'),toast:$('#toast')};
  const ORDER=['vps','opgo','ustav','zones','supply','supply-chop','info'];
  const icons={file:'ic-file',copy:'ic-copy',check:'ic-check',link:'ic-link',search:'ic-search',chevron:'ic-chevron'};
  const icon=n=>`<svg aria-hidden="true"><use href="#${icons[n]||'ic-file'}"/></svg>`;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plural=(n,forms)=>forms[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?1:2];
  let data={items:[],sources:{}}, prepared=[], hits=[], query='', filter='all', sort='relevance', visible=24, expandedCards=new Set(), toastTimer;
  const numbers=(a,b)=>window.RuleSearch.numericSort ? RuleSearch.numericSort(a,b):String(a).localeCompare(String(b),undefined,{numeric:true});
  const scored=()=>{
    let rows=filter==='all'?hits:[...hits].filter(x=>x.source===filter);
    if(sort==='document')rows=[...rows].sort((a,b)=>ORDER.indexOf(a.source)-ORDER.indexOf(b.source)||numbers(a.number,b.number));
    if(sort==='number')rows=[...rows].sort((a,b)=>numbers(a.number,b.number)||ORDER.indexOf(a.source)-ORDER.indexOf(b.source));
    return rows;
  };
  function highlight(v){
    const str=h(v);if(!query)return str;
    const tokens=RuleSearch.tokenize(query).filter(t=>t.length>=4).slice(0,7);
    if(!tokens.length)return str;
    const clean=RuleSearch.norm(query),re= new RegExp('('+[...new Set(tokens)].map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')[а-яёa-z]{0,5}','gi');
    return str.replace(re,'<mark>$&</mark>');
  }
  function title(x){return x.title&&x.title.length>=8?x.title:((x.text||'').split(/[.!?\n]/)[0]||'Пункт '+x.number).slice(0,135)}
  function renderCard(x,i){
    const doc=data.sources[x.source]||{};const open=expandedCards.has(x.id),txt=x.text||x.summary||x.title||'';
    const summary=txt.slice(0,260)+(txt.length>260?'…':'');
    const textType=x.kind==='original'?'ПОЛНЫЙ ТЕКСТ ИЗ ПРЕДОСТАВЛЕННОГО ДОКУМЕНТА':x.kind==='imported'?'ТЕКСТ ИЗ ПЕРВОИСТОЧНИКА':'КРАТКИЙ КОНСПЕКТ';
    const sanction=x.sanction||'';
    return `<article class="law-card ${h(x.source)} ${open?'is-open':''}" data-id="${h(x.id)}" style="animation-delay:${Math.min(i,12)*14}ms">
      <div class="law-meta"><div class="law-ref"><span class="law-type">${h(doc.short||x.source)}</span><span class="law-number">${x.source==='info'?'Запись '+h(x.number):/^\d/.test(x.number)?'Пункт '+h(x.number):h(x.number)}</span></div><span class="law-verified">${h(x.unit ? x.unit+' · '+(x.chapter||''):x.chapter||'PROVINCE #3')}</span></div>
      <h3>${highlight(title(x))}</h3><p class="law-summary">${highlight(summary)}</p>
      ${sanction?`<div class="law-sanction"><span>Мера:</span> ${highlight(sanction)}</div>`:''}
      <div class="law-acts">${doc.url?`<a href="${h(doc.url)}" target="_blank" rel="noopener noreferrer">${icon('link')} Оригинал</a>`:''}<button type="button" class="copy-law" data-id="${h(x.id)}">${icon('copy')} Копировать</button><button type="button" class="view-detail" data-id="${h(x.id)}" aria-expanded="${open}" aria-controls="detail-${h(x.id)}">Подробнее ${icon('chevron')}</button></div>
      <div class="law-detail" id="detail-${h(x.id)}"><div class="law-detail-clip"><div class="law-detail-inner"><div class="law-detail-title">${icon('file')} ${textType}</div><div class="law-detail-content">${highlight(txt)}</div>${x.chapter?`<div class="law-detail-chapter">${h(x.chapter)}</div>`:''}</div></div></div>
    </article>`;
  }
  function sourceCards(){
    el.sourceGrid.innerHTML=ORDER.map(key=>{
      const doc=data.sources[key],n=data.items.filter(x=>x.source===key).length;
      const state=data.sourceStatus?.[key]?.status||'unavailable';
      const status=state==='full'?' · Полный текст':state==='seed'?' · Краткий индекс':' · Нет текста';
      return `<${doc.url?'a':'div'} ${doc.url?`href="${h(doc.url)}" target="_blank" rel="noopener noreferrer" title="Открыть документ на форуме"`:''} class="source-card"><span class="source-icon">${icon('file')}</span><span class="source-copy"><strong>${h(doc.short)}</strong><span class="source-count">${n.toLocaleString('ru-RU')} ${plural(n,['пункт','пункта','пунктов'])}${h(status)}</span></span>${doc.url?icon('link').replace('<svg ','<svg class="source-external" '):''}</${doc.url?'a':'div'}>`
    }).join('');
  }
  function render(){
    const counts=Object.fromEntries(ORDER.map(k=>[k,hits.filter(x=>x.source===k).length]));
    $('#filter-all').textContent=hits.length.toLocaleString('ru-RU');
    ORDER.forEach(k=>{const span=$(`#filter-${k}`); if(span)span.textContent=counts[k].toLocaleString('ru-RU')});
    const rows=scored();
    el.count.textContent=rows.length.toLocaleString('ru-RU');
    el.title.firstChild.textContent=query?'Результаты поиска ':'Все пункты ';
    el.caption.textContent=query?`Запрос: «${query}» · поиск по правилам и синонимам`:'Поиск по доступным текстам семи разделов.';
    if(!rows.length){
      const unavailable=ORDER.filter(k=>(data.sourceStatus?.[k]?.status||'')==='unavailable');
      el.grid.innerHTML=`<div class="empty-state"><span class="empty-icon">${icon('search')}</span><strong>По доступным пунктам совпадений нет</strong><p>${unavailable.length?'ВПС и ОПГО пока представлены кратким индексом. Полные тексты остальных пяти разделов уже загружены.':'Попробуй другое описание, сокращение или номер пункта.'}</p></div>`;
      el.more.hidden=true;return;
    }
    el.grid.innerHTML=rows.slice(0,visible).map(renderCard).join('');
    el.more.hidden=rows.length<=visible;
    el.more.innerHTML=`Показать ещё (${Math.min(24,rows.length-visible)}) ${icon('chevron')}`;
  }
  function run(){hits=RuleSearch.search(prepared,query);visible=24;render()}
  function setQuery(value){query=(value||'').slice(0,180);el.search.value=query;el.dockSearch.value=query;el.clear.hidden=!query;el.dockClear.hidden=!query;expandedCards.clear();run();}
  function selectFilter(key){filter=key;$$('[data-source]').forEach(b=>{const selected=b.dataset.source===key;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});visible=24;render();}
  function notify(msg){el.toast.textContent=msg;el.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.toast.classList.remove('show'),2500)}
  async function copy(x){const t=`${data.sources[x.source]?.short||x.source}, пункт ${x.number}: ${x.text||x.title}`;try{await navigator.clipboard.writeText(t);notify('Пункт скопирован')}catch(_){const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();try{document.execCommand('copy');notify('Пункт скопирован')}finally{a.remove();}}}
  el.search.addEventListener('input',()=>setQuery(el.search.value));
  el.dockSearch.addEventListener('input',()=>setQuery(el.dockSearch.value));
  el.clear.addEventListener('click',()=>{setQuery('');el.search.focus()});
  el.dockClear.addEventListener('click',()=>{setQuery('');el.dockSearch.focus()});
  $('#suggestions').addEventListener('click',e=>{const b=e.target.closest('[data-query]');if(b){setQuery(b.dataset.query);document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});}});
  $('#filterRow').addEventListener('click',e=>{const b=e.target.closest('[data-source]');if(b)selectFilter(b.dataset.source)});
  el.sort.addEventListener('change',()=>{sort=el.sort.value;render()});
  el.more.addEventListener('click',()=>{visible+=24;render()});
  $('#backSearchBtn').addEventListener('click',()=>document.getElementById('search').scrollIntoView({behavior:'smooth'}));
  el.grid.addEventListener('click',e=>{const button=e.target.closest('button[data-id]');if(!button)return;const id=button.dataset.id;if(button.classList.contains('copy-law')){const entry=prepared.find(x=>x.id===id);if(entry)copy(entry);return;}if(expandedCards.has(id))expandedCards.delete(id);else expandedCards.add(id);const card=button.closest('.law-card');card.classList.toggle('is-open',expandedCards.has(id));button.setAttribute('aria-expanded',String(expandedCards.has(id)));});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();el.search.focus();window.scrollTo({top:0,behavior:'smooth'})}if(e.key==='Escape'&&[el.search,el.dockSearch].includes(document.activeElement)){document.activeElement.blur()}});
  const payload=window.PROVINCE_RULES;
  if(!payload?.items||!payload?.sources){el.grid.innerHTML='<div class="empty-state"><strong>База не найдена</strong><p>Нужен файл data/rules.js. Распакуй архив полностью.</p></div>';el.date.textContent='Данные не загружены';return;}
  data=payload;prepared=payload.items.map(x=>RuleSearch.indexItem(x));sourceCards();
  const unavailable=ORDER.some(k=>data.sourceStatus?.[k]?.status!=='full');
  el.notice.hidden=!unavailable;
  el.date.textContent='Каталог: '+(data.updatedAt||'дата неизвестна');
  const params=new URLSearchParams(location.search);setQuery(params.get('q')||'');
})();
