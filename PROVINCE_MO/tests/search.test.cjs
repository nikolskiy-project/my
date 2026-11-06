const assert=require('node:assert/strict');
const core=require('../assets/search-core.js');
const db=require('../data/rules.json');
const top=q=>core.search(db.items,q).slice(0,6).map(x=>x.id);
const expected={
 'виды сзысканий':'ustav.discipline-13',
 'виды взысканий':'ustav.discipline-13',
 'какие наказания в МО':'ustav.discipline-13',
 'список взысканий':'ustav.discipline-13',
 'дисциплинарный устав 13':'ustav.discipline-13',
 'сколько хранить скрины':'opgo-4.6',
 'три выговора':'opgo-6.3',
 'афк':'ustav.discipline-21',
 'жёлтая зона':'zones.base-3',
 'Код-0':'info.info-43',
 'поставка чоп':'supply-chop.main-7',
 'субординация':'ustav.internal-14',
 'на каком расстоянии от колонны':'supply.main-3'
};
for(const [q,id] of Object.entries(expected))assert.equal(top(q)[0],id,`Запрос: ${q}; вместо ${id} получил ${top(q)}`);
assert.equal(db.items.filter(x=>x.source==='ustav').length,120);
assert.equal(db.items.filter(x=>x.source==='zones').length,19);
assert.equal(db.items.filter(x=>x.source==='supply').length,25);
assert.equal(db.items.filter(x=>x.source==='supply-chop').length,11);
assert.equal(db.items.filter(x=>x.source==='info').length,144);
assert.equal(db.items.filter(x=>x.source==='opgo').length,18);
assert.equal(db.items.filter(x=>x.source==='vps').length,0);
assert.equal(db.items.length,337);
assert(db.items.find(x=>x.id==='ustav.discipline-13').text.includes('занесение в общий черный список'));
assert(db.items.some(x=>x.id==='ustav.internal-13'));
assert(db.items.some(x=>x.id==='ustav.drill-13'));
assert.deepEqual(top('дисциплинарный устав 999'),[]);
console.log('Passed: 13 semantic searches, 7 source counts, duplicate rule numbers, original sanctions.');
