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
  'v-pendiente':[-2],'v-tabla':[3,32],'v-negativa':[24,19],'v-tiempo':[18,6],
  'v-aceleracion':[8,20],'v-frenado':[6,54,59],'v-encuentro':[10],
  'f-empujes':[12,2],'f-pelota':[4],'f-frenado':[-2,-100],
  'f-mochila':[70,70],'f-cubeta':[30,36,36],'f-cubeta-inversa':[50,10,2]
};
assert.equal(Object.keys(numerical).length,19);
for(const q of bank){
  assert.ok(q.source&&q.prompt&&q.explain);
  assert.ok(!/resorte|rampa|trabajo mecánico|energía cinética/i.test(q.prompt));
  if(q.type==='choice'){
    assert.equal(q.choices.length,q.id==='m-ruta'?2:4,q.id);
    assert.equal(new Set(q.choices).size,q.choices.length,q.id);
    assert.ok(q.choices.includes(q.answer),q.id);
    assert.equal(scoring.grade(q,q.answer),1,q.id);
    for(const option of q.choices.filter(option=>option!==q.answer))assert.equal(scoring.grade(q,option),0,q.id+': '+option);
    assert.equal(scoring.complete(q,''),false,q.id);
    continue;
  }
  const actualNumbers=Array.from(q.parts).filter(part=>part.kind!=='choice').map(part=>part.answer);
  assert.deepEqual(actualNumbers,numerical[q.id],q.id);
  const correct=Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));
  for(const part of q.parts.filter(part=>part.kind==='choice')){
    for(const option of part.choices){
      assert.equal(scoring.partCorrect(part,option),option===part.answer,q.id+': '+part.id+': '+option);
      const singleWrong={...correct,[part.id]:option};
      assert.equal(scoring.grade(q,singleWrong),option===part.answer?1:(q.parts.length-1)/q.parts.length,q.id+': '+option);
    }
  }
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
assert.equal(scoring.partCorrect(rounding,'1,854'),false);
assert.equal(scoring.partCorrect(rounding,'1,850'),true);
assert.equal(scoring.partCorrect(rounding,'1.86'),false);
const precisionParts=bank.find(q=>q.id==='m-precision').parts;
assert.equal(scoring.partCorrect(precisionParts[0],'0.035'),false);
assert.equal(scoring.partCorrect(precisionParts[0],'0.04'),true);
assert.equal(scoring.partCorrect(precisionParts[0],'0,040'),true);
assert.equal(scoring.partCorrect(precisionParts[1],'0.205'),false);
assert.equal(scoring.partCorrect(precisionParts[1],'0.2'),true);
const friction=bank.find(q=>q.id==='v-referencia');
assert.equal(friction.topic,3);
assert.equal(friction.visuals.length,friction.choices.length);
assert.deepEqual(Array.from(friction.visuals[0].friction),[6,9]);
assert.equal(friction.visuals[0].direction,'left');
const graph=bank.find(q=>q.id==='v-grafica');
assert.ok(graph.image?.src&&fs.existsSync(path.join(root,graph.image.src)));
assert.equal(graph.answer,'No cambia de posición.');
assert.deepEqual(Array.from(bank.find(q=>q.id==='v-tabla').table[1]),['Posición (m)','2','11','20']);
for(const id of ['v-pendiente','v-tabla','v-negativa','v-tiempo','v-aceleracion','v-frenado','v-encuentro'])assert.ok(bank.find(q=>q.id===id).formulas?.length,id);
assert.equal(bank.find(q=>q.id==='f-tercera').answer,'La cubeta jala la cuerda hacia abajo.');
const v3=context.window.V3_QUESTIONS;
const singleNumeric=bank.find(q=>q.id==='v-pendiente'),singlePart=singleNumeric.parts[0].id;
for(const value of ['-','texto','2.3.4'])assert.equal(scoring.complete(singleNumeric,{[singlePart]:value}),false,value);
for(const value of ['-2','2,5','0'])assert.equal(scoring.complete(singleNumeric,{[singlePart]:value}),true,value);
const legacyNumeric=v3.find(q=>q.id==='v-pendiente');
assert.equal(scoring.complete(legacyNumeric,{[legacyNumeric.parts[0].id]:'texto'}),true);
assert.equal(v3.length,bank.length);
assert.deepEqual(Array.from(v3.find(q=>q.id==='v-encuentro').parts,part=>part.answer),[4,8]);
assert.equal(v3.find(q=>q.id==='v-grafica').answer,'No cambia de posición.');
assert.notEqual(v3.find(q=>q.id==='f-tercera').answer,bank.find(q=>q.id==='f-tercera').answer);
assert.equal(scoring.partCorrect(v3.find(q=>q.id==='m-rapidez').parts.find(part=>part.id==='kilometros'),'1,854'),true);
const v2=context.window.V2_QUESTIONS;
assert.equal(v2.length,bank.length);
assert.equal(v2.find(q=>q.id==='v-pendiente').type,'choice');
assert.equal(v2.find(q=>q.id==='v-grafica').image,null);
assert.equal(v2.find(q=>q.id==='v-tabla').table,null);
assert.equal(v2.find(q=>q.id==='f-primera').answer,'0 N');
const legacy=context.window.LEGACY_QUESTIONS;
assert.equal(legacy.length,bank.length);
assert.equal(legacy.find(q=>q.id==='m-precision').type,'choice');
assert.equal(legacy.find(q=>q.id==='m-ruta').type,'parts');
assert.equal(legacy.find(q=>q.id==='v-referencia').topic,2);
assert.equal(legacy.find(q=>q.id==='v-pendiente').type,'choice');
assert.equal(scoring.grade(legacy.find(q=>q.id==='m-sentido'),'Su sentido'),1);
console.log('PASS: 27 reactivos, cobertura, resultados independientes, variantes válidas y crédito parcial.');
