const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'questions.js'),'utf8'),context);
const bank=context.window.QUESTIONS,scoring=require('../scoring.js');
assert.equal(bank.length,27);
assert.equal(new Set(bank.map(q=>q.id)).size,27);
assert.deepEqual([1,2,3].map(topic=>bank.filter(q=>q.topic===topic).length),[9,8,10]);
const numerical={
  'm-precision':[.04,.2],'m-promedio':[3.2],'m-rapidez':[1850,1.85],'m-camino':[15,7],
  'm-suma':[4,3,5],'m-resta':[-4,3,5],
  'v-tabla':[3,32],'v-negativa':[24,19],'v-tiempo':[18,6],
  'v-aceleracion':[8,20],'v-frenado':[6,54,59],'v-encuentro':[4,8],
  'f-empujes':[12,2],'f-pelota':[4],'f-frenado':[-2,-100],
  'f-mochila':[70,70],'f-cubeta':[30,36,36],'f-cubeta-inversa':[50,10,2]
};
assert.equal(Object.keys(numerical).length,18);
for(const q of bank){
  assert.ok(q.source&&q.prompt&&q.explain);
  assert.ok(!/resorte|rampa|trabajo mecánico|energía cinética/i.test(q.prompt));
  if(q.type==='choice'){
    assert.equal(q.choices.length,q.id==='m-ruta'?2:4,q.id);
    assert.equal(new Set(q.choices).size,q.choices.length,q.id);
    assert.ok(q.choices.includes(q.answer),q.id);
    assert.equal(scoring.grade(q,q.answer),1,q.id);
    assert.equal(scoring.grade(q,q.choices.find(option=>option!==q.answer)),0,q.id);
    assert.equal(scoring.complete(q,''),false,q.id);
    continue;
  }
  const actualNumbers=Array.from(q.parts).filter(part=>part.kind!=='choice').map(part=>part.answer);
  assert.deepEqual(actualNumbers,numerical[q.id],q.id);
  const correct=Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));
  assert.equal(scoring.grade(q,correct),1,q.id);
  assert.equal(scoring.complete(q,correct),true,q.id);
  const missing={...correct};delete missing[q.parts[0].id];
  assert.equal(scoring.complete(q,missing),false,q.id);
  const wrong=Object.fromEntries(q.parts.map(part=>[part.id,part.kind==='choice'?part.choices.find(choice=>choice!==part.answer):'no sé']));
  assert.equal(scoring.grade(q,wrong),0,q.id);
  if(q.parts.length>1){const partial={...correct,[q.parts[0].id]:wrong[q.parts[0].id]};assert.equal(scoring.grade(q,partial),(q.parts.length-1)/q.parts.length,q.id);}
}
assert.equal(scoring.number('3,20'),3.2);
assert.equal(scoring.number('−4'),-4);
assert.equal(scoring.number('4 m'),null);
assert.equal(scoring.number('4abc'),null);
const rounding=bank.find(q=>q.id==='m-rapidez').parts.find(part=>part.id==='kilometros');
assert.equal(scoring.partCorrect(rounding,'1,854'),true);
assert.equal(scoring.partCorrect(rounding,'1.86'),false);
const friction=bank.find(q=>q.id==='v-referencia');
assert.equal(friction.topic,3);
assert.equal(friction.visuals.length,friction.choices.length);
assert.deepEqual(Array.from(friction.visuals[0].friction),[6,9]);
assert.equal(friction.visuals[0].direction,'left');
const legacy=context.window.LEGACY_QUESTIONS;
assert.equal(legacy.length,bank.length);
assert.equal(legacy.find(q=>q.id==='m-precision').type,'choice');
assert.equal(legacy.find(q=>q.id==='m-ruta').type,'parts');
assert.equal(legacy.find(q=>q.id==='v-referencia').topic,2);
assert.equal(scoring.grade(legacy.find(q=>q.id==='m-sentido'),'Su sentido'),1);
console.log('PASS: 27 reactivos, cobertura, resultados independientes, variantes válidas y crédito parcial.');
