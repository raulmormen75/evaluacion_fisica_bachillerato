const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const key='ifr-physics-exam-v1';
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.ttf':'font/ttf','.json':'application/json'};
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
  const port=await listen(),url='http://127.0.0.1:'+port+'/';
  const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  const errors=[];
  try{
    const desktop=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    const page=await desktop.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url,{waitUntil:'networkidle'});
    assert.match(await page.title(),/Física I/);
    assert.equal(await page.locator('img.brand-shield').evaluate(image=>image.complete&&image.naturalWidth>0),true);
    assert.match(await page.locator('body').evaluate(node=>getComputedStyle(node).fontFamily),/Plus Jakarta Sans/);
    assert.equal(await page.locator('audio').count(),0);
    await noOverflow(page);
    const desktopIntroScreenshot=path.join(os.tmpdir(),'ifr-fisica-desktop-intro.png');await page.screenshot({path:desktopIntroScreenshot});
    await page.locator('#name').fill('Alumno de prueba');await page.locator('#group').fill('Tercer cuatrimestre A');
    await page.getByRole('button',{name:'Iniciar prueba'}).click();
    await page.waitForTimeout(350);
    const desktopQuestionScreenshot=path.join(os.tmpdir(),'ifr-fisica-desktop-question.png');await page.screenshot({path:desktopQuestionScreenshot});
    const initial=await session(page);assert.equal(initial.ids.length,27);
    assert.equal(await page.locator('#restart').count(),0);
    await page.locator('#next').click();assert.equal((await session(page)).index,0);
    assert.match(await page.locator('#notice').innerText(),/respuesta|partes/);
    const first=await current(page);
    if(first.type==='parts'){
      const part=first.parts[0],field=page.locator('[data-part="'+part.id+'"]');
      if(part.kind==='choice')await field.selectOption(part.answer);else await field.fill(String(part.answer));
      await page.locator('#next').click();assert.equal((await session(page)).index,0);
      await page.reload({waitUntil:'networkidle'});
      assert.equal((await session(page)).ids.join('|'),initial.ids.join('|'));
      assert.deepEqual((await session(page)).orderings,initial.orderings);
      assert.equal(String((await session(page)).answers[first.id][part.id]),String(part.answer));
    }
    for(let index=0;index<27;index++){
      const q=await current(page);await answer(page,q);
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
    assert.equal(await page.locator('.review').count(),27);
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
    await page.locator('#name').fill('Segundo intento');await page.locator('#group').fill('Tercer cuatrimestre A');
    await page.getByRole('button',{name:'Iniciar prueba'}).click();
    const second=await session(page);
    assert.notEqual(second.ids.join('|'),initial.ids.join('|'));
    const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,acceptDownloads:true});
    const mobilePage=await mobile.newPage();mobilePage.on('pageerror',error=>errors.push(error.message));
    await mobilePage.goto(url,{waitUntil:'networkidle'});await noOverflow(mobilePage);
    const introScreenshot=path.join(os.tmpdir(),'ifr-fisica-mobile-intro.png');await mobilePage.screenshot({path:introScreenshot,fullPage:true});
    await mobilePage.locator('#name').fill('Alumno móvil');await mobilePage.locator('#group').fill('Tercer cuatrimestre B');
    await mobilePage.getByRole('button',{name:'Iniciar prueba'}).click();await noOverflow(mobilePage);
    const questionScreenshot=path.join(os.tmpdir(),'ifr-fisica-mobile-question.png');await mobilePage.screenshot({path:questionScreenshot,fullPage:true});
    await mobilePage.addInitScript(([storageKey,snapshot])=>localStorage.setItem(storageKey,JSON.stringify(snapshot)),[key,complete]);
    await mobilePage.reload({waitUntil:'networkidle'});await noOverflow(mobilePage);
    assert.equal(await mobilePage.locator('.review').count(),27);
    await mobilePage.waitForTimeout(350);assert.equal(await mobilePage.evaluate(()=>scrollY),0);
    const resultScreenshot=path.join(os.tmpdir(),'ifr-fisica-mobile-result.png');await mobilePage.screenshot({path:resultScreenshot});
    assert.deepEqual(errors,[]);
    console.log('PASS: recorrido completo, bloqueo, persistencia, mezcla de temas y opciones, PDF, escritorio y móvil.');
    console.log(JSON.stringify({pdfPath,desktopIntroScreenshot,desktopQuestionScreenshot,desktopResultScreenshot,introScreenshot,questionScreenshot,resultScreenshot,pdfBytes:bytes.length}));
    await desktop.close();await mobile.close();
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
