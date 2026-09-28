const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {jsPDF}=require('../vendor/jspdf.umd.min.js');
const report=require('../pdf-report.js'),scoring=require('../scoring.js');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'questions.js'),'utf8'),context);
const questions=context.window.QUESTIONS,topics=context.window.TOPICS;
const assets={regular:fs.readFileSync(path.join(root,'assets/fonts/PlusJakartaSans-Regular.ttf')).toString('base64'),bold:fs.readFileSync(path.join(root,'assets/fonts/PlusJakartaSans-Bold.ttf')).toString('base64'),shield:fs.readFileSync(path.join(root,'assets/ifr-shield.jpg')).toString('base64')};
if(process.env.IFR_PDF_GRAPH)assets.graph='data:image/png;base64,'+fs.readFileSync(process.env.IFR_PDF_GRAPH).toString('base64');
const state={name:'Resultado de prueba mixta',group:'Tercer cuatrimestre A',finished:'2026-09-27T12:00:00Z',answers:{}};
questions.forEach((q,index)=>{
  if(q.type==='choice')state.answers[q.id]=index%3?q.answer:q.choices.find(option=>option!==q.answer);
  else{
    const answer=Object.fromEntries(q.parts.map(part=>[part.id,String(part.answer)]));
    if(index%3===0)answer[q.parts[0].id]=q.parts[0].kind==='choice'?q.parts[0].choices.find(choice=>choice!==q.parts[0].answer):'999';
    state.answers[q.id]=answer;
  }
});
const totals={points:0,topics:topics.map(()=>({score:0,total:0}))};
questions.forEach(q=>{const score=scoring.grade(q,state.answers[q.id]);totals.points+=score;totals.topics[q.topic-1].score+=score;totals.topics[q.topic-1].total++;});
totals.grade=totals.points/questions.length*10;totals.percentage=totals.points/questions.length*100;
assert.ok(totals.grade>0&&totals.grade<10);
const printed=[],images=[];
function AuditedPDF(options){
  const doc=new jsPDF(options),text=doc.text.bind(doc),addImage=doc.addImage.bind(doc);
  doc.text=function(value,x,y,options){
    assert.ok(y>=0&&y<=288,'Texto fuera del área imprimible: '+value);
    const lines=Array.isArray(value)?value:[String(value)];
    for(const line of lines){
      const w=doc.getTextWidth(line),right=options?.align==='right'?x:x+w;
      assert.ok(x>=16&&right<=195,'Texto fuera del margen horizontal: '+line);
      printed.push(line);
    }
    return text(value,x,y,options);
  };
  doc.addImage=function(...args){images.push(args[0]);return addImage(...args);};
  return doc;
}
const doc=report.build({jsPDF:AuditedPDF,state,questions,topics,scoring,totals,assets});
assert.ok(doc.getNumberOfPages()>4);
assert.ok(doc.getFontList().Jakarta.includes('normal'));
assert.equal(printed.filter(line=>line.endsWith('/ 1 punto')).length,questions.length,'Cada ejercicio debe tener su puntuación');
assert.ok(printed.some(line=>line==='Parcial')&&printed.some(line=>line==='Incorrecto')&&printed.some(line=>line==='Correcto'));
if(assets.graph)assert.equal(images.filter(image=>image===assets.graph).length,questions.filter(q=>q.image).length,'La gráfica debe aparecer en su ejercicio');
const bytes=Buffer.from(doc.output('arraybuffer'));assert.equal(bytes.subarray(0,4).toString(),'%PDF');
const output=path.join(os.tmpdir(),'ifr-fisica-mixto-qa.pdf');fs.writeFileSync(output,bytes);
console.log('PASS: PDF con respuestas correctas, incorrectas y parciales; márgenes y puntuaciones completos'+(assets.graph?', gráfica incluida':' (gráfica no probada: usa IFR_PDF_GRAPH)')+'; '+doc.getNumberOfPages()+' páginas. '+output);
