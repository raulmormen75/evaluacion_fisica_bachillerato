(function(){
  'use strict';
  const app=document.getElementById('app');
  const S=window.ExamScoring, NEW_BANK=window.QUESTIONS, V3_BANK=window.V3_QUESTIONS, V2_BANK=window.V2_QUESTIONS, LEGACY_BANK=window.LEGACY_QUESTIONS, TOPICS=window.TOPICS;
  const KEY='ifr-physics-exam-v1', VERSION=4, TOTAL=NEW_BANK.length;
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  let BANK=NEW_BANK,byId=new Map(NEW_BANK.map(q=>[q.id,q]));
  let state=null,noticeTimer=null,persisted=true;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const format=value=>Number(value).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  function selectBank(version){BANK=version===1?LEGACY_BANK:version===2?V2_BANK:version===3?V3_BANK:NEW_BANK;byId=new Map(BANK.map(q=>[q.id,q]));}
  function shuffle(items){
    const result=[...items];
    for(let i=result.length-1;i>0;i--){
      const random=new Uint32Array(1);crypto.getRandomValues(random);
      const j=random[0]%(i+1);[result[i],result[j]]=[result[j],result[i]];
    }
    return result;
  }
  function notice(message){
    clearTimeout(noticeTimer);
    const element=document.getElementById('notice');element.textContent=message;
    noticeTimer=setTimeout(()=>element.textContent='',4500);
  }
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state));persisted=true;}
    catch{persisted=false;notice('No se pudo guardar el avance. Mantén esta pestaña abierta.');}
    const indicator=document.getElementById('saved');
    if(indicator)indicator.textContent=persisted?'':'Sin guardar. Mantén esta pestaña abierta.';
  }
  function orderedQuestions(){return state.ids.map(id=>byId.get(id));}
  function current(){return byId.get(state.ids[state.index]);}
  function choiceKey(q,part){return part?q.id+':'+part.id:q.id;}
  function optionsFor(q,part){return state.orderings[choiceKey(q,part)];}
  function restore(){
    try{
      const saved=JSON.parse(localStorage.getItem(KEY));
      if(!saved||![1,2,3,VERSION].includes(saved.version))return;
      selectBank(saved.version);
      if(!Array.isArray(saved.ids)||saved.ids.length!==TOTAL||
        new Set(saved.ids).size!==TOTAL||!saved.ids.every(id=>byId.has(id))||
        !Number.isInteger(saved.index)||saved.index<0||saved.index>=TOTAL||
        typeof saved.name!=='string'||!saved.name.trim()||typeof saved.group!=='string'||!saved.group.trim()||
        typeof saved.answers!=='object'||!saved.answers||typeof saved.orderings!=='object'||!saved.orderings||
        typeof saved.done!=='boolean')return;
      for(const q of BANK){
        const pools=q.type==='choice'?[[choiceKey(q),q.choices]]:q.parts.filter(part=>part.kind==='choice').map(part=>[choiceKey(q,part),part.choices]);
        for(const [key,choices] of pools){const order=saved.orderings[key];if(!Array.isArray(order)||order.length!==choices.length||new Set(order).size!==choices.length||!order.every(choice=>choices.includes(choice)))return;}
        const answer=saved.answers[q.id];
        if(answer!==undefined){
          if(q.type==='choice'&&typeof answer!=='string')return;
          if(q.type==='parts'&&(typeof answer!=='object'||!answer||Array.isArray(answer)||Object.values(answer).some(value=>typeof value!=='string')))return;
        }
      }
      const previous=saved.ids.slice(0,saved.index);
      if(previous.some(id=>!S.complete(byId.get(id),saved.answers[id])))return;
      if(saved.done&&(!saved.finished||saved.ids.some(id=>!S.complete(byId.get(id),saved.answers[id]))))return;
      if(saved.readyToSubmit&&(saved.index!==TOTAL-1||saved.ids.some(id=>!S.complete(byId.get(id),saved.answers[id]))))return;
      state=saved;
    }catch{state=null;}
  }
  function startScreen(){
    if(state){if(state.done)return results();if(state.readyToSubmit)return review();return renderQuestion();}
    selectBank(VERSION);
    app.innerHTML=`<div class="intro"><section class="card dark"><div class="eyebrow">Bachillerato · Física I</div><h1>Evaluación<br>de Física I</h1><p class="muted">Conceptos y resolución de ejercicios.</p><div class="stats"><div><strong>${TOTAL}</strong><span>ejercicios</span></div><div><strong>${TOPICS.length}</strong><span>temas</span></div><div><strong>75</strong><span>min aprox.</span></div></div><div class="topics-content"><ul class="topic-list">${TOPICS.map(topic=>`<li>${esc(topic)}</li>`).join('')}</ul><img class="exam-mouse" src="assets/exam-mouse.png" alt="Ratón gris con lentes, playera blanca y short azul, sonriente y con el pulgar levantado." width="1024" height="1536"></div></section><section class="card"><div class="eyebrow">Datos del alumno</div><h2>Registra tus datos</h2><p class="exam-instructions">Ten a la mano papel y lápiz. Responde cada ejercicio antes de avanzar; después no podrás volver. El intento se guarda en este navegador.</p><form id="startForm"><label class="field" for="name">Nombre completo<input id="name" required maxlength="100" autocomplete="name" placeholder="Escribe tu nombre"></label><label class="field" for="group">Grupo<input id="group" required maxlength="80" placeholder="Ej. Tercer cuatrimestre, grupo A"></label><button class="primary wide" type="submit">Iniciar prueba</button></form></section></div>`;
    document.getElementById('startForm').onsubmit=event=>{
      event.preventDefault();if(state)return;
      const name=document.getElementById('name').value.trim(),group=document.getElementById('group').value.trim();
      if(!name||!group){notice('Escribe tu nombre y tu grupo.');return;}
      try{localStorage.setItem(KEY+':test','1');localStorage.removeItem(KEY+':test');}
      catch{notice('Para iniciar, permite guardar datos en este navegador.');return;}
      state={version:VERSION,name,group,started:new Date().toISOString(),ids:shuffle([1,2,3]).flatMap(topic=>shuffle(BANK.filter(q=>q.topic===topic)).map(q=>q.id)),answers:{},orderings:{},index:0,readyToSubmit:false,done:false};
      BANK.forEach(q=>{
        if(q.type==='choice')state.orderings[choiceKey(q)]=shuffle(q.choices);
        else q.parts.filter(part=>part.kind==='choice').forEach(part=>state.orderings[choiceKey(q,part)]=shuffle(part.choices));
      });
      save();renderQuestion();
    };
  }
  function partMarkup(q,part,value){
    const id='part-'+part.id;
    if(part.kind==='choice')return `<label class="field answer-field" for="${id}">${esc(part.label)}<select id="${id}" data-part="${part.id}"><option value="">Selecciona una opción</option>${optionsFor(q,part).map(option=>`<option value="${esc(option)}" ${value===option?'selected':''}>${esc(option)}</option>`).join('')}</select></label>`;
    return `<label class="field answer-field" for="${id}">${esc(part.label)}<span class="input-with-unit"><input id="${id}" data-part="${part.id}" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="24" value="${esc(value||'')}" placeholder="Escribe un número" aria-describedby="unit-${part.id}"><span id="unit-${part.id}" class="unit">${esc(part.unit||'')}</span></span></label>`;
  }
  function forceArrow(start,end,y,color){
    const left=end<start,tip=left?end+7:end-7;
    return `<line x1="${start}" y1="${y}" x2="${end}" y2="${y}" stroke="${color}" stroke-width="3" stroke-linecap="round"/><path d="M ${end} ${y} L ${tip} ${y-4} L ${tip} ${y+4} Z" fill="${color}"/>`;
  }
  function forceDiagram(q,option){
    const visual=q.visuals?.[q.choices.indexOf(option)];if(!visual)return '';
    const stages=[6,9].map((push,index)=>{
      const top=index*82,friction=visual.friction[index],direction=visual.direction;
      const frictionArrow=friction?forceArrow(direction==='left'?160:200,direction==='left'?160-friction*6:200+friction*6,top+57,'#626D88'):'';
      const frictionLabel=`Fricción: ${friction} N${friction?(direction==='left'?' ←':' →'):''}`;
      return `<rect x="1" y="${top+1}" width="358" height="78" rx="8" fill="#F7F8FC" stroke="#DDE2EF"/><text x="12" y="${top+22}" class="force-label force-label-push">Empuje: ${push} N →</text><text x="188" y="${top+22}" class="force-label force-label-friction">${frictionLabel}</text><line x1="130" y1="${top+68}" x2="230" y2="${top+68}" stroke="#A9B2C8" stroke-width="2"/><rect x="160" y="${top+35}" width="40" height="30" rx="3" fill="#E6EBFA" stroke="#1C1E5A" stroke-width="1.5"/><text x="180" y="${top+53}" text-anchor="middle" class="force-box-label">caja</text>${forceArrow(200,200+push*6,top+46,'#2B2F8F')}${frictionArrow}`;
    }).join('');
    return `<svg class="force-diagram" viewBox="0 0 360 164" role="img" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${stages}</svg>`;
  }
  const sub=(letter,index)=>`<msub><mi>${letter}</mi><mi>${index}</mi></msub>`;
  const vf=sub('v','f'),vi=sub('v','i'),xf=sub('x','f'),xi=sub('x','i'),x0=sub('x','0'),tf=sub('t','f'),ti=sub('t','i');
  const dx='<mrow><mi>Δ</mi><mi>x</mi></mrow>',half='<mfrac><mn>1</mn><mn>2</mn></mfrac>';
  const FORMULAE={
    acceleration:`<mi>a</mi><mo>=</mo><mfrac><mrow>${vf}<mo>−</mo>${vi}</mrow><mi>t</mi></mfrac>`,
    tableVelocity:`<mi>v</mi><mo>=</mo><mfrac><mrow>${xf}<mo>−</mo>${xi}</mrow><mrow>${tf}<mo>−</mo>${ti}</mrow></mfrac>`,
    uniformPosition:`<mi>x</mi><mo>=</mo>${x0}<mo>+</mo><mi>v</mi><mi>t</mi>`,
    displacementSpeed:`${dx}<mo>=</mo><mi>v</mi><mi>t</mi>`,
    finalFromDisplacement:`${xf}<mo>=</mo>${x0}<mo>+</mo>${dx}`,
    displacementPositions:`${dx}<mo>=</mo>${xf}<mo>−</mo>${x0}`,
    timeFromDisplacement:`<mi>t</mi><mo>=</mo><mfrac>${dx}<mi>v</mi></mfrac>`,
    finalVelocity:`${vf}<mo>=</mo>${vi}<mo>+</mo><mi>a</mi><mi>t</mi>`,
    acceleratedPosition:`${xf}<mo>=</mo>${x0}<mo>+</mo>${vi}<mi>t</mi><mo>+</mo>${half}<mi>a</mi><msup><mi>t</mi><mn>2</mn></msup>`,
    distanceFinal:`<mi>d</mi><mo>=</mo>${xf}<mo>−</mo>${x0}`,
    remainingDistance:`<mi>d</mi><mo>=</mo>${sub('d','0')}<mo>−</mo><mo>(</mo>${sub('v','A')}<mo>+</mo>${sub('v','L')}<mo>)</mo><mi>t</mi>`
  };
  function questionSupport(q){
    const figure=q.image?`<figure class="question-figure"><img src="${esc(q.image.src)}" alt="${esc(q.image.alt)}" width="640" height="360"></figure>`:'';
    const table=q.table?`<div class="question-table-wrap"><table class="question-table"><tbody>${q.table.map(row=>`<tr><th scope="row">${esc(row[0])}</th>${row.slice(1).map(value=>`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'';
    const formulas=q.formulas?.length?`<div class="question-formulas"><strong>${q.formulas.length===1?'Fórmula':'Fórmulas'}</strong>${q.formulas.map(formula=>`<div class="question-formula"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${esc(formula.text)}">${FORMULAE[formula.id]}</math></div>`).join('')}</div>`:'';
    return figure+table+formulas;
  }
  function renderQuestion(){
    if(state.done)return results();if(state.readyToSubmit)return review();
    const q=current(),answer=state.answers[q.id];
    const fields=q.type==='choice'?`<div class="choices">${optionsFor(q).map((option,index)=>{const diagram=forceDiagram(q,option);return `<button type="button" class="choice ${diagram?'choice-with-visual':''} ${answer===option?'selected':''}" data-choice="${esc(option)}" aria-pressed="${answer===option}"><b>${String.fromCharCode(65+index)}</b><span class="choice-text">${esc(option)}</span>${diagram}</button>`;}).join('')}</div>`:`<p class="small muted">Escribe solo el número en cada casilla. Puedes usar punto o coma decimal.</p><div class="parts">${q.parts.map(part=>partMarkup(q,part,answer?.[part.id])).join('')}</div>`;
    app.innerHTML=`<div class="exam-flow ${q.visuals||q.image||q.formulas?.length?'visual-question':''}"><section class="card"><div class="qtop"><span>Ejercicio ${state.index+1} de ${TOTAL} · Tema ${q.topic}</span><span class="type">${esc(q.mode||((q.type==='choice')?'Concepto':'Resolución'))}</span></div><h2 id="questionTitle" tabindex="-1">${esc(TOPICS[q.topic-1])}</h2><p class="prompt">${esc(q.prompt)}</p>${questionSupport(q)}${fields}<div class="save-state" id="saved">${persisted?'':'Sin guardar. Mantén esta pestaña abierta.'}</div><div class="nav-buttons"><button id="next" class="primary" data-incomplete="${!S.complete(q,answer)}">${state.index===TOTAL-1?'Finalizar prueba':'Siguiente'}</button></div></section></div>`;
    document.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>{state.answers[q.id]=button.dataset.choice;save();renderQuestion();});
    document.querySelectorAll('[data-part]').forEach(field=>{
      const update=()=>{state.answers[q.id]={...(state.answers[q.id]||{}),[field.dataset.part]:field.value};field.classList.remove('missing');save();document.getElementById('next').dataset.incomplete=String(!S.complete(q,state.answers[q.id]));};
      field.addEventListener(field.tagName==='SELECT'?'change':'input',update);
    });
    document.getElementById('next').onclick=()=>{
      if(!S.complete(q,state.answers[q.id]))return blockedNext(q);
      if(state.index===TOTAL-1){state.readyToSubmit=true;save();review();}
      else{state.index++;save();renderQuestion();document.getElementById('questionTitle').focus();window.scrollTo(0,0);}
    };
  }
  function blockedNext(q){
    if(q.type==='choice')document.querySelector('.choices').classList.add('missing-group');
    else q.parts.forEach(part=>{const value=state.answers[q.id]?.[part.id];if(!String(value??'').trim())document.getElementById('part-'+part.id).classList.add('missing');});
    const button=document.getElementById('next');button.classList.remove('blocked');void button.offsetWidth;button.classList.add('blocked');
    notice(q.type==='parts'?'Completa todas las partes antes de avanzar.':'Selecciona una respuesta antes de avanzar.');
    setTimeout(()=>{button.classList.remove('blocked');document.querySelector('.choices')?.classList.remove('missing-group');document.querySelectorAll('.missing').forEach(field=>field.classList.remove('missing'));},1100);
  }
  function review(){
    if(!state||state.done||state.index!==TOTAL-1||orderedQuestions().some(q=>!S.complete(q,state.answers[q.id])))return;
    app.innerHTML=`<section class="card exam-flow"><div class="eyebrow">Entrega final</div><h1>Finaliza tu prueba</h1><p><strong>${esc(state.name)}</strong> · ${esc(state.group)}</p><p>Entrega para consultar tu calificación y descargar el PDF.</p><button id="finish" class="primary">Entregar y ver resultado</button></section>`;
    document.getElementById('finish').onclick=()=>{if(state.done)return;state.done=true;state.finished=new Date().toISOString();save();results();window.scrollTo(0,0);};
  }
  function totals(){
    const topics=TOPICS.map(()=>({score:0,total:0}));let points=0;
    orderedQuestions().forEach(q=>{const score=S.grade(q,state.answers[q.id]);points+=score;topics[q.topic-1].score+=score;topics[q.topic-1].total++;});
    return {points,topics,grade:points/TOTAL*10,percentage:points/TOTAL*100};
  }
  function answerRow(label,actual,expected,correct){return `<div class="answer-item"><strong>${esc(label)}</strong><div class="answer-columns"><div><span class="answer-label">Tu respuesta</span><span>${esc(actual)}</span></div>${correct?'':`<div class="answer-fix"><span class="answer-label">Respuesta correcta</span><span>${esc(expected)}</span></div>`}</div></div>`;}
  function details(){return orderedQuestions().map((q,index)=>{
    const answer=state.answers[q.id],points=S.grade(q,answer),correct=points===1,status=correct?'correct':points>0?'partial':'incorrect';
    const rows=q.type==='choice'?answerRow('Respuesta',answer,q.answer,correct):q.parts.map(part=>{const actual=answer?.[part.id],suffix=part.unit?' '+part.unit:'';return answerRow(part.label,String(actual??'')+suffix,String(part.answer)+suffix,S.partCorrect(part,actual));}).join('');
    return `<article class="review result-${status}"><div class="review-heading"><div class="review-number">${index+1}</div><h3>${esc(TOPICS[q.topic-1])}</h3><span class="result-badge">${correct?'Correcto':points>0?'Parcial':'Incorrecto'}</span></div><p class="review-prompt">${esc(q.prompt)}</p>${questionSupport(q)}<div class="answer-list">${rows}</div>${correct?'':`<p class="review-explanation">${esc(q.explain)}</p>`}<div class="review-points">${format(points)} / 1 punto</div></article>`;
  }).join('');}
  function results(){
    if(!state?.done)return;const result=totals();
    app.innerHTML=`<section class="card"><div class="eyebrow">Evaluación entregada</div><h1>Tu resultado</h1><p><strong>${esc(state.name)}</strong> · ${esc(state.group)}</p><div class="grade-line"><strong>${format(result.grade)} / 10</strong><span>${format(result.percentage)}%</span></div><p>${format(result.points)} de ${TOTAL} puntos.</p><div class="row no-print"><button id="pdf" class="primary">Descargar resultado en PDF</button><button id="restartTop">Iniciar otro intento</button></div><div class="results-grid">${result.topics.map((topic,index)=>`<div class="result-tile"><span>Tema ${index+1}</span><strong>${format(topic.score)} / ${topic.total}</strong><small>${esc(TOPICS[index])}</small></div>`).join('')}</div><h2>Detalle de tus respuestas</h2>${details()}<div class="row no-print restart-area"><button id="restart">Iniciar otro intento</button></div></section>`;
    document.getElementById('pdf').onclick=downloadPDF;
    document.getElementById('restart').onclick=restart;
    document.getElementById('restartTop').onclick=restart;
  }
  async function downloadPDF(){
    if(!state?.done||!window.jspdf?.jsPDF||!window.IFRPDF){notice('No se pudo preparar el PDF. Recarga e inténtalo de nuevo.');return;}
    const button=document.getElementById('pdf');if(button.disabled)return;
    button.disabled=true;button.textContent='Preparando PDF…';
    try{
      const snapshot=JSON.parse(JSON.stringify(state));
      const assets=await IFRPDF.loadAssets();
      const report=IFRPDF.build({jsPDF:jspdf.jsPDF,state:snapshot,questions:orderedQuestions(),topics:TOPICS,scoring:S,totals:totals(),assets});
      const filename='Evaluacion_Fisica_I_'+snapshot.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').slice(0,60)+'.pdf';
      await report.save(filename,{returnPromise:true});
    }catch(error){console.error('PDF:',error);notice('No se pudo generar el PDF. Inténtalo de nuevo.');}
    finally{button.disabled=false;button.textContent='Descargar resultado en PDF';}
  }
  function restart(){
    if(!state?.done||document.getElementById('pdf')?.disabled)return;
    try{localStorage.removeItem(KEY);}catch{notice('No se pudo iniciar otro intento.');return;}
    state=null;startScreen();window.scrollTo(0,0);
  }
  restore();startScreen();window.addEventListener('pagehide',()=>{if(state)save();});
})();
