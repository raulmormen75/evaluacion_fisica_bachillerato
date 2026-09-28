const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),key='ifr-physics-exam-v1';
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.ttf':'font/ttf'};
const server=http.createServer((request,response)=>{
  const relative=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
const format=value=>Number(value).toFixed(2);
// PDF text extraction replaces accented glyphs even though their visual rendering is correct.
const pdfText=value=>String(value).replace(/−/g,'-').replace(/×/g,' x ').replace(/÷/g,' / ').replace(/√/g,'raíz de ').replace(/½/g,'1/2').replace(/²/g,'^2').replace(/₀/g,'0').replace(/Δ/g,'Delta ').replace(/≈/g,'aprox. ').replace(/[’‘]/g,"'").replace(/[^\x00-\x7F]/g,'�').replace(/\s+/g,'');
(async()=>{
  const port=await new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
  const url=process.env.EXAM_URL||'http://127.0.0.1:'+port+'/';
  const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url,{waitUntil:'networkidle'});
    await page.locator('#name').fill('Prueba mixta de calificación');assert.equal(await page.locator('#group').count(),0);
    await page.getByRole('button',{name:'Iniciar prueba'}).click();
    const ordered=await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key));return state.ids.map(id=>window.QUESTIONS.find(q=>q.id===id));},key);
    const expected=[],topicPoints=[0,0,0],topicTotals=[0,0,0];
    for(const [index,q] of ordered.entries()){
      const rows=[];let points;
      if(q.type==='choice'){
        const correct=index%3===0,actual=correct?q.answer:q.choices.find(option=>option!==q.answer);
        await page.locator('[data-choice]').filter({hasText:actual}).click();
        points=correct?1:0;rows.push({label:'Respuesta',actual,expected:q.answer,correct});
      }else{
        let successes=0;
        for(const [partIndex,part] of q.parts.entries()){
          const correct=index%3===0||(index%3===2&&partIndex>0);
          const actual=correct?String(part.answer):part.kind==='choice'?part.choices.find(option=>option!==part.answer):String(Number(part.answer)+1000);
          const field=page.locator('[data-part="'+part.id+'"]');
          if(part.kind==='choice')await field.selectOption(actual);else await field.fill(actual);
          if(correct)successes++;
          const suffix=part.unit?' '+part.unit:'';
          rows.push({label:part.label,actual:actual+suffix,expected:String(part.answer)+suffix,correct});
        }
        points=successes/q.parts.length;
      }
      const status=points===1?'Correcto':points===0?'Incorrecto':'Parcial';
      expected.push({id:q.id,points,status,rows});topicPoints[q.topic-1]+=points;topicTotals[q.topic-1]++;
      assert.equal(await page.locator('.grade-line').count(),0);
      await page.locator('#next').click();
    }
    await page.getByRole('button',{name:'Entregar y ver resultado'}).click();
    const points=expected.reduce((sum,item)=>sum+item.points,0),grade=points/ordered.length*10,percentage=points/ordered.length*100;
    const statuses=expected.map(item=>item.status);
    for(const status of ['Correcto','Incorrecto','Parcial'])assert.ok(statuses.includes(status));
    assert.equal(await page.locator('.grade-line strong').innerText(),format(grade)+' / 10');
    assert.equal(await page.locator('.grade-line span').innerText(),format(percentage)+'%');
    for(let topic=0;topic<3;topic++)assert.equal(await page.locator('.result-tile strong').nth(topic).innerText(),format(topicPoints[topic])+' / '+topicTotals[topic]);
    assert.equal(await page.locator('.review').count(),20);
    for(const [index,item] of expected.entries()){
      const card=page.locator('.review').nth(index);
      assert.equal(await card.locator('.result-badge').innerText(),item.status,item.id);
      assert.equal(await card.locator('.review-points').innerText(),format(item.points)+' / 1 punto',item.id);
      for(const [rowIndex,row] of item.rows.entries()){
        const displayed=card.locator('.answer-item').nth(rowIndex);
        assert.equal(await displayed.locator('strong').innerText(),row.label);
        assert.equal(await displayed.locator('.answer-columns > div').first().locator('span').last().innerText(),row.actual,item.id);
        assert.equal(await displayed.locator('.answer-fix').count(),row.correct?0:1,item.id);
        assert.equal(await displayed.locator('.answer-columns > div').first().evaluate(el=>getComputedStyle(el).backgroundColor),row.correct?'rgb(234, 248, 239)':'rgb(255, 240, 242)',item.id+' panel color');
        if(!row.correct)assert.equal(await displayed.locator('.answer-fix span').last().innerText(),row.expected,item.id);
      }
    }
    const screenshot=path.join(os.tmpdir(),'ifr-fisica-mixto-pantalla.png');
    await page.locator('article.result-partial').first().scrollIntoViewIfNeeded();await page.screenshot({path:screenshot});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('article.result-partial').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(os.tmpdir(),'ifr-fisica-paneles-movil.png')});
    const downloadPromise=page.waitForEvent('download');await page.locator('#pdf').click();
    const download=await downloadPromise,pdfPath=path.join(os.tmpdir(),'ifr-fisica-mixto-navegador.pdf');await download.saveAs(pdfPath);
    const extracted=JSON.parse(execFileSync('python',['-c','import fitz,json,sys; d=fitz.open(sys.argv[1]); print(json.dumps([p.get_text() for p in d]))',pdfPath],{encoding:'utf8'}));
    const text=extracted.join('\n'),cover=pdfText(extracted[0]);
    assert.ok(cover.includes(pdfText(format(grade)+' / 10')));
    assert.ok(cover.includes(pdfText(format(percentage)+'%')));
    assert.ok(cover.includes(pdfText(format(points)+' de 20 puntos')));
    for(let topic=0;topic<3;topic++)assert.ok(cover.includes(pdfText(format(topicPoints[topic])+' / '+topicTotals[topic])));
    const blocks=[...text.matchAll(/^(Correcto|Parcial|Incorrecto)\n([\s\S]*?)\n(\d+\.\d{2}) \/ 1 punto/gm)];
    assert.equal(blocks.length,20,'PDF must contain all 20 individually scored questions');
    for(const [index,item] of expected.entries()){
      const block=blocks[index];assert.equal(block[1],item.status,item.id);assert.equal(block[3],format(item.points),item.id);
      const body=pdfText(block[2]);
      for(const row of item.rows){
        assert.ok(body.includes(pdfText('Tu respuesta · '+(row.correct?'Correcta':'Incorrecta')+' '+row.actual)),item.id+' PDF actual: '+row.actual);
        if(!row.correct)assert.ok(body.includes(pdfText('Respuesta correcta '+row.expected)),item.id+' PDF expected: '+row.expected);
      }
      assert.equal((block[2].match(/Respuesta correcta/g)||[]).length,item.rows.filter(row=>!row.correct).length,item.id);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: 20 respuestas mixtas; cada estado, punto, respuesta y corrección coinciden en pantalla y PDF; nota y temas calculados sin usar scoring.js.');
    console.log(JSON.stringify({url,grade:format(grade),percentage:format(percentage),points:format(points),statuses:Object.fromEntries(['Correcto','Incorrecto','Parcial'].map(status=>[status,statuses.filter(value=>value===status).length])),pdfPath,pages:extracted.length,screenshot}));
    await context.close();
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
