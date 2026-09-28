const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const key='ifr-physics-exam-v1';
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json'};
const server=http.createServer((request,response)=>{
  const relative=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
function listen(){return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));}
async function session(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);}
async function current(page){return page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key));return window.QUESTIONS.find(q=>q.id===state.ids[state.index]);},key);}
async function answer(page,q){
  if(q.type==='choice')await page.locator('[data-choice]').filter({hasText:q.answer}).click();
  else for(const part of q.parts){const field=page.locator('[data-part="'+part.id+'"]');if(part.kind==='choice')await field.selectOption(part.answer);else await field.fill(String(part.answer));}
}
async function noOverflow(page){const size=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(size.content<=size.viewport+1,JSON.stringify(size));}
(async()=>{
  const port=await listen(),url=process.env.EXAM_URL||'http://127.0.0.1:'+port+'/';
  const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  const errors=[];
  try{
    const desktop=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    const page=await desktop.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url,{waitUntil:'networkidle'});
    assert.match(await page.title(),/Física I/);
    assert.equal(await page.locator('img.brand-shield').evaluate(image=>image.complete&&image.naturalWidth>0),true);
    await page.locator('img[src="assets/exam-mouse.png"]').evaluate(image=>image.decode());
    assert.equal(await page.locator('img[src="assets/exam-mouse.png"]').evaluate(image=>image.naturalWidth>0),true);
    assert.match(await page.locator('body').evaluate(node=>getComputedStyle(node).fontFamily),/Plus Jakarta Sans/);
    assert.equal(await page.locator('audio').count(),0);
    await noOverflow(page);
    const desktopIntroScreenshot=path.join(os.tmpdir(),'ifr-fisica-desktop-intro.png');await page.screenshot({path:desktopIntroScreenshot});
    await page.locator('#name').fill('Alumno de prueba');assert.equal(await page.locator('#group').count(),0);
    await page.getByRole('button',{name:'Iniciar prueba'}).click();
    await page.waitForTimeout(350);
    const desktopQuestionScreenshot=path.join(os.tmpdir(),'ifr-fisica-desktop-question.png');await page.screenshot({path:desktopQuestionScreenshot});
    const initial=await session(page);assert.equal(initial.group,'Tercer cuatrimestre');assert.equal(initial.ids.length,20);assert.equal(initial.version,5);
    assert.equal(await page.locator('#restart').count(),0);
    await page.locator('#next').click();assert.equal((await session(page)).index,0);
    assert.match(await page.locator('#notice').innerText(),/respuesta|partes/);
    const first=await current(page);
    if(first.type==='parts'){
      const part=first.parts[0],field=page.locator('[data-part="'+part.id+'"]');
      if(part.kind==='choice')await field.selectOption(part.answer);else await field.fill(String(part.answer));
      if(first.parts.length>1){await page.locator('#next').click();assert.equal((await session(page)).index,0);}
      await page.reload({waitUntil:'networkidle'});
      assert.equal((await session(page)).ids.join('|'),initial.ids.join('|'));
      assert.deepEqual((await session(page)).orderings,initial.orderings);
      assert.equal(String((await session(page)).answers[first.id][part.id]),String(part.answer));
    }
    let desktopFrictionScreenshot,desktopGraphScreenshot;
    for(let index=0;index<20;index++){
      const q=await current(page);
      assert.equal(await page.locator('.grade-line, #restart, #restartTop, [data-back]').count(),0,q.id);
      if(index>0){
        await page.locator('#next').click();
        assert.equal((await session(page)).index,index,q.id+' must block unanswered navigation');
      }
      if(q.type==='parts'&&q.parts.length>1){
        const firstPart=q.parts[0],field=page.locator('[data-part="'+firstPart.id+'"]');
        if(firstPart.kind==='choice')await field.selectOption(firstPart.answer);else await field.fill(String(firstPart.answer));
        await page.locator('#next').click();
        assert.equal((await session(page)).index,index,q.id+' must require every part');
      }
      await noOverflow(page);
      if(q.id==='v-grafica'){
        await page.locator('.question-figure img').evaluate(image=>image.decode());
        assert.equal(await page.locator('.question-figure img').evaluate(image=>image.complete&&image.naturalWidth===640),true);
        assert.equal(await page.locator('.choices .choice').count(),4);
        await noOverflow(page);
        desktopGraphScreenshot=path.join(os.tmpdir(),'ifr-fisica-grafica-escritorio.png');
        await page.screenshot({path:desktopGraphScreenshot,fullPage:true});
      }
      if(q.id==='v-pendiente')assert.equal(await page.locator('.question-formula math mfrac').count(),1);
      if(q.id==='v-tabla')assert.equal(await page.locator('.question-table td').count(),6);
      if(q.id==='v-referencia'){
        assert.equal(await page.locator('.force-diagram').count(),4);
        assert.equal(await page.locator('.force-diagram .force-box-label').count(),8);
        desktopFrictionScreenshot=path.join(os.tmpdir(),'ifr-fisica-friccion-desktop.png');
        await page.screenshot({path:desktopFrictionScreenshot,fullPage:true});
      }
      await answer(page,q);
      assert.equal(await page.locator('#next').getAttribute('data-incomplete'),'false');
      await page.locator('#next').click();
      if(index===0){const saved=await session(page);assert.equal(saved.index,1);await page.reload({waitUntil:'networkidle'});assert.equal((await session(page)).index,1);assert.deepEqual((await session(page)).orderings,initial.orderings);assert.equal(await page.locator('[data-back]').count(),0);}
    }
    assert.equal(await page.getByRole('heading',{name:'Finaliza tu prueba'}).count(),1);
    assert.equal(await page.locator('.grade-line').count(),0);
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.getByRole('heading',{name:'Finaliza tu prueba'}).count(),1);
    await page.getByRole('button',{name:'Entregar y ver resultado'}).click();
    assert.match(await page.locator('.grade-line').innerText(),/10.00 \/ 10/);
    assert.equal(await page.locator('.review').count(),20);
    assert.equal(await page.locator('.result-tile').count(),3);
    await noOverflow(page);
    await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>scrollY),0);
    const desktopResultScreenshot=path.join(os.tmpdir(),'ifr-fisica-desktop-result.png');await page.screenshot({path:desktopResultScreenshot});
    const complete=await session(page);
    await page.reload({waitUntil:'networkidle'});assert.equal((await session(page)).done,true);
    const downloadPromise=page.waitForEvent('download');await page.locator('#pdf').click();const download=await downloadPromise;
    const bytes=fs.readFileSync(await download.path());
    assert.equal(bytes.subarray(0,4).toString(),'%PDF');assert.ok(bytes.length>50000);
    const pdfPath=path.join(os.tmpdir(),'ifr-fisica-qa.pdf');fs.writeFileSync(pdfPath,bytes);
    await page.getByRole('button',{name:'Iniciar otro intento'}).first().click();
    assert.equal(await page.locator('#startForm').count(),1);
    await page.locator('#name').fill('Segundo intento');assert.equal(await page.locator('#group').count(),0);
    await page.getByRole('button',{name:'Iniciar prueba'}).click();
    const second=await session(page);
    assert.notEqual(second.ids.join('|'),initial.ids.join('|'));
    const orderSamples=[initial,second];
    for(let attempt=0;attempt<8;attempt++){
      await page.evaluate(key=>localStorage.removeItem(key),key);
      // pagehide saves an active state, so use a fresh page after closing this attempt.
      const randomPage=await desktop.newPage();
      await randomPage.goto(url,{waitUntil:'networkidle'});
      await randomPage.locator('#name').fill('Verificación de orden');assert.equal(await randomPage.locator('#group').count(),0);
      await randomPage.getByRole('button',{name:'Iniciar prueba'}).click();
      orderSamples.push(await session(randomPage));
      await randomPage.close();
    }
    const topicsById=await page.evaluate(()=>Object.fromEntries(window.QUESTIONS.map(q=>[q.id,q.topic])));
    const topicOrders=orderSamples.map(snapshot=>snapshot.ids.map(id=>topicsById[id]).filter((topic,index,all)=>index===0||topic!==all[index-1]).join('|'));
    assert.ok(topicOrders.every(order=>order.split('|').length===3),'Each topic must form one consecutive group');
    assert.ok(new Set(topicOrders).size>1,'Topic order varies across attempts');
    for(const topic of [1,2,3])assert.ok(new Set(orderSamples.map(snapshot=>snapshot.ids.filter(id=>topicsById[id]===topic).join('|'))).size>1,'Exercises vary within topic '+topic);
    for(const optionKey of Object.keys(initial.orderings))assert.equal(new Set(orderSamples.map(snapshot=>snapshot.orderings[optionKey].join('|'))).size,1,'Options stay fixed for '+optionKey);
    const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,acceptDownloads:true});
    const mobilePage=await mobile.newPage();mobilePage.on('pageerror',error=>errors.push(error.message));
    await mobilePage.goto(url,{waitUntil:'networkidle'});await noOverflow(mobilePage);
    const introScreenshot=path.join(os.tmpdir(),'ifr-fisica-mobile-intro.png');await mobilePage.screenshot({path:introScreenshot,fullPage:true});
    await mobilePage.locator('#name').fill('Alumno móvil');assert.equal(await mobilePage.locator('#group').count(),0);
    await mobilePage.getByRole('button',{name:'Iniciar prueba'}).click();await noOverflow(mobilePage);
    const questionScreenshot=path.join(os.tmpdir(),'ifr-fisica-mobile-question.png');await mobilePage.screenshot({path:questionScreenshot,fullPage:true});
    await mobilePage.addInitScript(storageKey=>{const seed=sessionStorage.getItem('ifr-test-seed');if(seed)localStorage.setItem(storageKey,seed);},key);
    await mobilePage.evaluate(key=>{
      const state=JSON.parse(localStorage.getItem(key)),bank=window.QUESTIONS;
      state.index=state.ids.indexOf('v-referencia');
      state.ids.slice(0,state.index).forEach(id=>{const q=bank.find(item=>item.id===id);state.answers[id]=q.type==='choice'?q.answer:Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));});
      sessionStorage.setItem('ifr-test-seed',JSON.stringify(state));
    },key);
    await mobilePage.reload({waitUntil:'networkidle'});await noOverflow(mobilePage);
    assert.equal(await mobilePage.locator('.force-diagram').count(),4,JSON.stringify(await mobilePage.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));return {index:saved?.index,id:saved?.ids?.[saved.index],version:saved?.version,prompt:document.querySelector('.prompt')?.textContent,heading:document.querySelector('h1')?.textContent};},key)));
    const mobileFrictionScreenshot=path.join(os.tmpdir(),'ifr-fisica-friccion-movil.png');await mobilePage.screenshot({path:mobileFrictionScreenshot,fullPage:true});
    await mobilePage.evaluate(key=>{
      const state=JSON.parse(localStorage.getItem(key)),bank=window.QUESTIONS;
      state.index=state.ids.indexOf('v-grafica');
      state.ids.slice(0,state.index).forEach(id=>{const q=bank.find(item=>item.id===id);state.answers[id]=q.type==='choice'?q.answer:Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));});
      sessionStorage.setItem('ifr-test-seed',JSON.stringify(state));
    },key);
    await mobilePage.reload({waitUntil:'networkidle'});await noOverflow(mobilePage);
    await mobilePage.locator('.question-figure img').evaluate(image=>image.decode());
    assert.equal(await mobilePage.locator('.question-figure img').evaluate(image=>image.naturalWidth===640),true);
    const mobileGraphScreenshot=path.join(os.tmpdir(),'ifr-fisica-grafica-movil.png');await mobilePage.screenshot({path:mobileGraphScreenshot,fullPage:true});
    await mobilePage.evaluate(key=>{
      const state=JSON.parse(localStorage.getItem(key)),bank=window.QUESTIONS;
      state.index=state.ids.indexOf('v-frenado');
      state.ids.slice(0,state.index).forEach(id=>{const q=bank.find(item=>item.id===id);state.answers[id]=q.type==='choice'?q.answer:Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));});
      sessionStorage.setItem('ifr-test-seed',JSON.stringify(state));
    },key);
    await mobilePage.reload({waitUntil:'networkidle'});await noOverflow(mobilePage);
    assert.equal(await mobilePage.locator('.question-formula math').count(),3);
    const mobileFormulaScreenshot=path.join(os.tmpdir(),'ifr-fisica-formulas-movil.png');await mobilePage.screenshot({path:mobileFormulaScreenshot,fullPage:true});
    const mobileIds=await mobilePage.evaluate(()=>window.QUESTIONS.map(q=>q.id));
    for(const id of mobileIds){
      await mobilePage.evaluate(({key,id})=>{
        const state=JSON.parse(localStorage.getItem(key)),bank=window.QUESTIONS;
        state.index=state.ids.indexOf(id);state.done=false;state.readyToSubmit=false;state.answers={};
        state.ids.slice(0,state.index).forEach(previousId=>{const q=bank.find(item=>item.id===previousId);state.answers[previousId]=q.type==='choice'?q.answer:Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));});
        sessionStorage.setItem('ifr-test-seed',JSON.stringify(state));
      },{key,id});
      await mobilePage.reload({waitUntil:'networkidle'});await noOverflow(mobilePage);
      const q=await current(mobilePage),before=(await session(mobilePage)).index;
      await mobilePage.locator('#next').click();assert.equal((await session(mobilePage)).index,before,id);
      await answer(mobilePage,q);assert.equal(await mobilePage.locator('#next').getAttribute('data-incomplete'),'false',id);
    }
    await mobilePage.evaluate(snapshot=>sessionStorage.setItem('ifr-test-seed',JSON.stringify(snapshot)),complete);
    await mobilePage.reload({waitUntil:'networkidle'});await noOverflow(mobilePage);
    assert.equal(await mobilePage.locator('.review').count(),20);
    await mobilePage.waitForTimeout(350);assert.equal(await mobilePage.evaluate(()=>scrollY),0);
    const resultScreenshot=path.join(os.tmpdir(),'ifr-fisica-mobile-result.png');await mobilePage.screenshot({path:resultScreenshot});
    const legacyContext=await browser.newContext({viewport:{width:1280,height:800}});
    const legacyPage=await legacyContext.newPage();legacyPage.on('pageerror',error=>errors.push(error.message));
    await legacyPage.goto(url,{waitUntil:'networkidle'});
    await legacyPage.addInitScript(storageKey=>{const seed=sessionStorage.getItem('ifr-test-seed');if(seed)localStorage.setItem(storageKey,seed);},key);
    await legacyPage.evaluate(key=>{
      const bank=window.LEGACY_QUESTIONS,orderings={};
      bank.forEach(q=>{
        if(q.type==='choice')orderings[q.id]=q.choices;
        else q.parts.filter(part=>part.kind==='choice').forEach(part=>orderings[q.id+':'+part.id]=part.choices);
      });
      sessionStorage.setItem('ifr-test-seed',JSON.stringify({version:1,name:'Alumno anterior',group:'Tercer cuatrimestre A',started:new Date().toISOString(),ids:bank.map(q=>q.id),answers:{'m-sentido':'Su sentido'},orderings,index:1,readyToSubmit:false,done:false}));
    },key);
    await legacyPage.reload({waitUntil:'networkidle'});
    assert.match(await legacyPage.locator('.prompt').innerText(),/Una báscula marca 2 kg de más/);
    assert.equal((await session(legacyPage)).version,1);
    await legacyPage.evaluate(key=>{
      const state=JSON.parse(localStorage.getItem(key)),bank=window.LEGACY_QUESTIONS.filter(q=>state.ids.includes(q.id));
      bank.forEach(q=>{state.answers[q.id]=q.type==='choice'?q.answer:Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));});
      state.done=true;state.finished=new Date().toISOString();state.index=bank.length-1;state.readyToSubmit=true;
      sessionStorage.setItem('ifr-test-seed',JSON.stringify(state));
    },key);
    await legacyPage.reload({waitUntil:'networkidle'});
    assert.match(await legacyPage.locator('.grade-line').innerText(),/10.00 \/ 10/);
    await legacyPage.getByRole('button',{name:'Iniciar otro intento'}).first().click();
    await legacyPage.locator('#name').fill('Alumno nuevo');assert.equal(await legacyPage.locator('#group').count(),0);
    await legacyPage.getByRole('button',{name:'Iniciar prueba'}).click();
    assert.equal((await session(legacyPage)).version,5);
    await legacyContext.close();
    const v2Context=await browser.newContext({viewport:{width:1280,height:800}});
    const v2Page=await v2Context.newPage();v2Page.on('pageerror',error=>errors.push(error.message));
    await v2Page.goto(url,{waitUntil:'networkidle'});
    await v2Page.addInitScript(storageKey=>{const seed=sessionStorage.getItem('ifr-test-seed');if(seed)localStorage.setItem(storageKey,seed);},key);
    await v2Page.evaluate(key=>{
      const bank=window.V2_QUESTIONS,orderings={};
      bank.forEach(q=>{if(q.type==='choice')orderings[q.id]=q.choices;else q.parts.filter(part=>part.kind==='choice').forEach(part=>orderings[q.id+':'+part.id]=part.choices);});
      const ids=bank.map(q=>q.id),index=ids.indexOf('v-grafica'),answers={};
      ids.slice(0,index).forEach(id=>{const q=bank.find(item=>item.id===id);answers[id]=q.type==='choice'?q.answer:Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));});
      sessionStorage.setItem('ifr-test-seed',JSON.stringify({version:2,name:'Alumno versión anterior',group:'Tercer cuatrimestre A',started:new Date().toISOString(),ids,answers,orderings,index,readyToSubmit:false,done:false}));
    },key);
    await v2Page.reload({waitUntil:'networkidle'});
    assert.match(await v2Page.locator('.prompt').innerText(),/línea permanece horizontal/);
    assert.equal(await v2Page.locator('.question-figure img').count(),0);
    await v2Page.locator('[data-choice]').filter({hasText:'Permanece en reposo respecto al eje elegido'}).click();
    await v2Page.locator('#next').click();
    assert.match(await v2Page.locator('.prompt').innerText(),/pendiente/);
    assert.equal(await v2Page.locator('[data-choice]').count(),4);
    await v2Page.evaluate(key=>sessionStorage.setItem('ifr-test-seed',localStorage.getItem(key)),key);
    await v2Page.reload({waitUntil:'networkidle'});
    assert.equal((await session(v2Page)).version,2);
    assert.match(await v2Page.locator('.prompt').innerText(),/pendiente/);
    await v2Context.close();
    const v3Context=await browser.newContext({viewport:{width:1280,height:800}});
    const v3Page=await v3Context.newPage();v3Page.on('pageerror',error=>errors.push(error.message));
    await v3Page.goto(url,{waitUntil:'networkidle'});
    await v3Page.addInitScript(storageKey=>{const seed=sessionStorage.getItem('ifr-test-seed');if(seed)localStorage.setItem(storageKey,seed);},key);
    await v3Page.evaluate(key=>{
      const bank=window.V3_QUESTIONS,orderings={};
      bank.forEach(q=>{if(q.type==='choice')orderings[q.id]=q.choices;else q.parts.filter(part=>part.kind==='choice').forEach(part=>orderings[q.id+':'+part.id]=part.choices);});
      const ids=bank.map(q=>q.id),index=ids.indexOf('v-encuentro'),answers={};
      ids.slice(0,index).forEach(id=>{const q=bank.find(item=>item.id===id);answers[id]=q.type==='choice'?q.answer:Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));});
      sessionStorage.setItem('ifr-test-seed',JSON.stringify({version:3,name:'Alumno versión tres',group:'Tercer cuatrimestre A',started:new Date().toISOString(),ids,answers,orderings,index,readyToSubmit:false,done:false}));
    },key);
    await v3Page.reload({waitUntil:'networkidle'});
    assert.equal((await session(v3Page)).version,3);
    assert.equal(await v3Page.locator('[data-part]').count(),2);
    const oldQuestion=await v3Page.evaluate(()=>window.V3_QUESTIONS.find(q=>q.id==='v-encuentro'));
    await answer(v3Page,oldQuestion);await v3Page.locator('#next').click();
    const v3Advanced=await session(v3Page);
    await v3Page.evaluate(key=>sessionStorage.setItem('ifr-test-seed',localStorage.getItem(key)),key);
    await v3Page.reload({waitUntil:'networkidle'});
    assert.deepEqual(await session(v3Page),v3Advanced);
    await v3Context.close();
    const migration=await browser.newContext({viewport:{width:390,height:844}}),migrationPage=await migration.newPage();
    await migrationPage.goto(url,{waitUntil:'networkidle'});
    await migrationPage.addInitScript(storageKey=>{const seed=sessionStorage.getItem('ifr-test-seed');if(seed)localStorage.setItem(storageKey,seed);},key);
    for(const scenario of ['extra-current','retained-current','all-retained-done','historical-done']){
      const original=await migrationPage.evaluate(({key,scenario})=>{
        const bank=window.V4_QUESTIONS,approved=window.QUESTIONS.map(q=>q.id),extras=bank.filter(q=>!approved.includes(q.id)).map(q=>q.id);
        const orderings={};bank.forEach(q=>{if(q.type==='choice')orderings[q.id]=[...q.choices].reverse();else q.parts.filter(part=>part.kind==='choice').forEach(part=>orderings[q.id+':'+part.id]=[...part.choices].reverse());});
        let ids=[extras[0],approved[0],extras[1],approved[1],extras[2],...approved.slice(2),...extras.slice(3)],index=scenario==='extra-current'?4:5;
        if(scenario==='all-retained-done'){ids=[...approved,...extras];index=20;}
        if(scenario==='historical-done'){ids=bank.map(q=>q.id);index=26;}
        const answers={};ids.slice(0,scenario==='historical-done'?27:index).forEach(id=>{const q=bank.find(item=>item.id===id);answers[id]=q.type==='choice'?q.answer:Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));});
        const snapshot={version:4,name:'Migración veinte',group:'Grupo histórico',started:new Date().toISOString(),ids,answers,orderings,index,readyToSubmit:scenario==='historical-done',done:scenario==='historical-done'};
        if(snapshot.done)snapshot.finished=new Date().toISOString();
        sessionStorage.setItem('ifr-test-seed',JSON.stringify(snapshot));return snapshot;
      },{key,scenario});
      await migrationPage.reload({waitUntil:'networkidle'});
      const restored=await session(migrationPage);
      if(scenario==='historical-done'){
        assert.equal(restored.ids.length,27);assert.equal(await migrationPage.locator('.review').count(),27);
        assert.equal(await migrationPage.locator('.grade-line strong').innerText(),'10.00 / 10');assert.equal(restored.group,'Grupo histórico');
      }else{
        assert.equal(restored.ids.length,20);assert.equal(restored.scope20,true);assert.equal(restored.group,'Tercer cuatrimestre');
        const approved=await migrationPage.evaluate(()=>window.QUESTIONS.map(q=>q.id));
        assert.deepEqual(restored.ids,original.ids.filter(id=>approved.includes(id)));
        for(const [id,value] of Object.entries(original.answers))if(approved.includes(id))assert.deepEqual(restored.answers[id],value,id);
        assert.ok(Object.keys(restored.answers).every(id=>approved.includes(id)));
        if(scenario==='all-retained-done'){assert.equal(restored.readyToSubmit,true);assert.equal(await migrationPage.getByRole('heading',{name:'Finaliza tu prueba'}).count(),1);}
        else{assert.equal(restored.index,2);assert.equal(restored.ids[restored.index],approved[2]);}
        await migrationPage.evaluate(key=>sessionStorage.setItem('ifr-test-seed',localStorage.getItem(key)),key);
        await migrationPage.reload({waitUntil:'networkidle'});assert.deepEqual(await session(migrationPage),restored);
      }
    }
    await migration.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: recorrido completo, bloqueo, persistencia, migración, diagramas de fricción, PDF, escritorio y móvil.');
    console.log(JSON.stringify({pdfPath,desktopIntroScreenshot,desktopQuestionScreenshot,desktopFrictionScreenshot,desktopGraphScreenshot,desktopResultScreenshot,introScreenshot,questionScreenshot,mobileFrictionScreenshot,mobileGraphScreenshot,mobileFormulaScreenshot,resultScreenshot,pdfBytes:bytes.length}));
    await desktop.close();await mobile.close();
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
