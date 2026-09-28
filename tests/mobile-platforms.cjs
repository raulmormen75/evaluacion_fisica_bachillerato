const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {webkit,chromium,devices}=require('playwright');
let url=process.env.EXAM_URL||'https://evaluacion-fisica-ifr.vercel.app/';
const key='ifr-physics-exam-v1';let server;
async function state(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);}
async function noOverflow(page,label){
  const size=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(size.content<=size.viewport+1,label+' '+JSON.stringify(size));
}
async function answer(page,q){
  if(q.type==='choice')await page.locator('[data-choice]').filter({hasText:q.answer}).tap();
  else for(const part of q.parts){
    const field=page.locator('[data-part="'+part.id+'"]');
    if(part.kind==='choice')await field.selectOption(part.answer);
    else{await field.tap();await field.fill(String(Math.abs(part.answer)));if(part.answer<0)await page.locator('[data-sign="'+part.id+'"]').tap();}
  }
}
async function checkSupport(page,q){
  for(const image of await page.locator('.question-figure img').all()){
    await image.evaluate(element=>element.decode());
    assert.equal(await image.evaluate(element=>element.complete&&element.naturalWidth>0),true,q.id);
  }
  if(q.formulas?.length){
    const math=page.locator('.question-formula math');assert.equal(await math.count(),q.formulas.length,q.id);
    const dimensions=await math.evaluateAll(elements=>elements.map(element=>{const box=element.getBoundingClientRect();return {width:box.width,height:box.height,text:element.textContent};}));
    for(const item of dimensions)assert.ok(item.width>0&&item.height>=12&&item.text&&!item.text.includes('undefined'),q.id+' '+JSON.stringify(item));
  }
  if(q.visuals)assert.equal(await page.locator('.force-diagram').count(),q.choices.length);
}
async function platform(engine,device,name){
  const browser=await engine.launch({headless:true});
  const failures=[],screenshots=[];
  try{
    const context=await browser.newContext({...device,acceptDownloads:true,reducedMotion:'reduce'});
    const page=await context.newPage();page.on('pageerror',error=>failures.push(error.message));
    await page.goto(url,{waitUntil:'networkidle'});
    assert.equal(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
    assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
    assert.equal(await page.locator('.intro').evaluate(element=>getComputedStyle(element).animationName),'none');
    const animated=await browser.newContext({...device,reducedMotion:'no-preference'}),animatedPage=await animated.newPage();
    await animatedPage.goto(url,{waitUntil:'networkidle'});
    assert.equal(await animatedPage.evaluate(()=>matchMedia('(prefers-reduced-motion: no-preference)').matches),true);
    await animatedPage.waitForTimeout(350);
    const visible=await animatedPage.locator('.intro').evaluate(element=>({opacity:getComputedStyle(element).opacity,transform:getComputedStyle(element).transform}));
    assert.equal(visible.opacity,'1');assert.ok(['none','matrix(1, 0, 0, 1, 0, 0)'].includes(visible.transform));
    await animatedPage.locator('#name').fill('Animación');await animatedPage.locator('#group').fill('QA');
    await animatedPage.getByRole('button',{name:'Iniciar prueba'}).tap();await animatedPage.waitForTimeout(350);
    assert.equal(await animatedPage.locator('.exam-flow').evaluate(element=>getComputedStyle(element).opacity),'1');
    await animatedPage.locator('#next').tap();assert.equal((await state(animatedPage)).index,0);
    await animated.close();
    for(const selector of ['.brand-shield','.exam-mouse']){
      await page.locator(selector).evaluate(element=>element.decode());
      assert.equal(await page.locator(selector).evaluate(element=>element.complete&&element.naturalWidth>0),true);
    }
    for(const viewport of [{width:320,height:568},{width:375,height:667},{width:667,height:375}]){
      await page.setViewportSize(viewport);await noOverflow(page,name+' intro '+viewport.width);
    }
    await page.setViewportSize(device.viewport);
    const intro=path.join(os.tmpdir(),'ifr-mobile-'+name+'-intro.png');await page.screenshot({path:intro,fullPage:true});screenshots.push(intro);
    await page.locator('#name').tap();await page.locator('#name').fill('Alumno '+name);
    await page.locator('#group').tap();await page.locator('#group').fill('Móvil');
    await page.getByRole('button',{name:'Iniciar prueba'}).tap();
    const initial=await state(page);assert.equal(initial.version,4);assert.equal(initial.ids.length,27);
    const bank=await page.evaluate(()=>window.QUESTIONS),byId=new Map(bank.map(q=>[q.id,q]));
    let testedDraft=false,testedSelect=false;
    for(let index=0;index<27;index++){
      const snapshot=await state(page),q=byId.get(snapshot.ids[index]);
      assert.equal(snapshot.index,index,q.id);
      await page.locator('#next').tap();assert.equal((await state(page)).index,index,q.id);
      assert.equal(await page.locator('#next').evaluate(element=>getComputedStyle(element).animationName),'none');
      assert.equal(await page.locator('.grade-line, #restart, #restartTop, [data-back]').count(),0,q.id);
      await checkSupport(page,q);
      for(const viewport of [{width:320,height:568},{width:375,height:667},{width:667,height:375}]){
        await page.setViewportSize(viewport);await noOverflow(page,name+' '+q.id+' '+viewport.width);
      }
      await page.setViewportSize(device.viewport);
      if(['v-grafica','v-frenado','v-referencia'].includes(q.id)){
        const screenshot=path.join(os.tmpdir(),'ifr-mobile-'+name+'-'+q.id+'.png');await page.screenshot({path:screenshot,fullPage:true});screenshots.push(screenshot);
      }
      if(q.type==='parts'){
        assert.ok((await page.locator('input[data-part]').evaluateAll(elements=>elements.map(element=>parseFloat(getComputedStyle(element).fontSize)))).every(size=>size>=16),'iOS input must avoid text zoom');
        if(q.parts.some(part=>part.kind==='choice'))testedSelect=true;
        if(!testedDraft){
          const part=q.parts.find(part=>part.kind!=='choice'),field=page.locator('[data-part="'+part.id+'"]');
          await field.fill('');await page.locator('[data-sign="'+part.id+'"]').tap();
          assert.equal(await field.inputValue(),'-');await page.locator('#next').tap();assert.equal((await state(page)).index,index);
          await page.reload({waitUntil:'networkidle'});assert.equal(await field.inputValue(),'-');
          await field.fill('2');await page.locator('[data-sign="'+part.id+'"]').tap();assert.equal(await field.inputValue(),'-2');
          await page.reload({waitUntil:'networkidle'});assert.equal(await field.inputValue(),'-2');
          await page.locator('[data-sign="'+part.id+'"]').tap();assert.equal(await field.inputValue(),'2');
          await field.tap();await field.fill(String(part.answer));
          await page.reload({waitUntil:'networkidle'});
          const restored=await state(page);
          assert.equal(restored.index,index);assert.deepEqual(restored.ids,initial.ids);assert.deepEqual(restored.orderings,initial.orderings);
          assert.equal(await page.locator('[data-part="'+part.id+'"]').inputValue(),String(part.answer));testedDraft=true;
        }
      }
      await answer(page,q);await page.locator('#next').tap();
      if(index===0){
        await page.reload({waitUntil:'networkidle'});const restored=await state(page);
        assert.equal(restored.index,1);assert.deepEqual(restored.ids,initial.ids);assert.deepEqual(restored.orderings,initial.orderings);
      }
    }
    assert.ok(testedDraft&&testedSelect);
    await page.getByRole('button',{name:'Entregar y ver resultado'}).tap();
    assert.equal(await page.locator('.grade-line strong').innerText(),'10.00 / 10');
    assert.equal(await page.locator('.review').count(),27);
    for(const viewport of [{width:320,height:568},{width:375,height:667},{width:667,height:375}]){
      await page.setViewportSize(viewport);await noOverflow(page,name+' result '+viewport.width);
    }
    await page.setViewportSize(device.viewport);
    const result=path.join(os.tmpdir(),'ifr-mobile-'+name+'-result.png');await page.screenshot({path:result});screenshots.push(result);
    await page.locator('a#pdf[download]').waitFor({state:'visible'});
    assert.equal(await page.locator('a#pdf').getAttribute('target'),'_blank');
    const downloadPromise=page.waitForEvent('download');await page.locator('a#pdf').tap();
    const download=await downloadPromise,pdfPath=path.join(os.tmpdir(),'ifr-mobile-'+name+'.pdf');await download.saveAs(pdfPath);
    const bytes=fs.readFileSync(pdfPath);assert.equal(bytes.subarray(0,4).toString(),'%PDF');assert.ok(bytes.length>50000);
    const pdfImage=path.join(os.tmpdir(),'ifr-mobile-'+name+'-pdf.png');
    const report=JSON.parse(execFileSync('python',['-c','import fitz,json,sys; d=fitz.open(sys.argv[1]); t="\\n".join(p.get_text() for p in d); d[0].get_pixmap(matrix=fitz.Matrix(1,1)).save(sys.argv[2]); print(json.dumps({"pages":len(d),"text":t}))',pdfPath,pdfImage],{encoding:'utf8'}));
    assert.ok(report.text.includes('10.00 / 10'));assert.ok(report.text.includes('100.00%'));
    assert.equal((report.text.match(/^Correcto$/gm)||[]).length,27);assert.equal((report.text.match(/1\.00 \/ 1 punto/g)||[]).length,27);
    await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.grade-line strong').innerText(),'10.00 / 10');
    await page.getByRole('button',{name:'Iniciar otro intento'}).first().tap();assert.equal(await page.locator('#startForm').count(),1);
    assert.deepEqual(failures,[]);
    console.log(JSON.stringify({status:'PASS',name,browser:browser.version(),questions:27,widths:[320,375,667],touch:true,reducedMotion:true,draftAndProgressRestored:true,pdfBytes:bytes.length,pdfPages:report.pages,pdfPath,pdfImage,screenshots}));
    await context.close();
  }finally{await browser.close();}
}
(async()=>{
  if(url==='local'){
    const root=path.resolve(__dirname,'..'),mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.ttf':'font/ttf'};
    server=http.createServer((request,response)=>{const relative=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'index.html',file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});});
    const port=await new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));url='http://127.0.0.1:'+port+'/';
  }
  console.log('Playwright '+require('playwright/package.json').version+' | '+url);
  try{await platform(webkit,devices['iPhone 13'],'webkit-iphone');await platform(chromium,devices['Pixel 7'],'chromium-pixel');}
  finally{if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server?.close();});
