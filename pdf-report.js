/* Informe PDF con el mismo banco y la misma corrección de la aplicación. */
(function(root){
  'use strict';
  let assetsPromise;
  function loadAssets(){
    if(!assetsPromise)assetsPromise=Promise.all(['assets/fonts/PlusJakartaSans-Regular.ttf','assets/fonts/PlusJakartaSans-Bold.ttf','assets/ifr-shield.jpg'].map(async url=>{
      const response=await fetch(url);if(!response.ok)throw new Error('No se pudo cargar '+url);
      const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
      for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return btoa(binary);
    })).then(([regular,bold,shield])=>({regular,bold,shield})).catch(error=>{assetsPromise=null;throw error;});
    return assetsPromise;
  }
  function build({jsPDF,state,questions,topics,scoring,totals,assets}){
    const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
    doc.addFileToVFS('Jakarta-Regular.ttf',assets.regular);doc.addFont('Jakarta-Regular.ttf','Jakarta','normal');
    doc.addFileToVFS('Jakarta-Bold.ttf',assets.bold);doc.addFont('Jakarta-Bold.ttf','Jakarta','bold');
    doc.setProperties({title:'Evaluación de Física I - '+state.name,author:'Instituto Fernando Ramírez',subject:'Resultado de evaluación'});
    const navy='#1C1E5A',ink='#24263E',muted='#62697D',line='#DFE3EF',green='#157442',red='#B52E40',amber='#94620D';
    const left=16,width=178,bottom=276;let y=16;
    const clean=value=>String(value??'').replace(/−/g,'-').replace(/×/g,' x ').replace(/÷/g,' / ').replace(/√/g,'raíz de ').replace(/½/g,'1/2').replace(/²/g,'^2').replace(/₀/g,'0').replace(/Δ/g,'Delta ').replace(/≈/g,'aprox. ').replace(/[’‘]/g,"'");
    const font=(size=10,bold=false,color=ink)=>{doc.setFont('Jakarta',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);};
    const wrap=(value,maxWidth,size=10,bold=false)=>{font(size,bold);return doc.splitTextToSize(clean(value),maxWidth);};
    const write=(value,x,baseline,size=10,bold=false,color=ink)=>{font(size,bold,color);doc.text(clean(value),x,baseline);};
    const box=(x,top,w,h,fill,stroke=null,radius=3)=>{doc.setFillColor(fill);if(stroke)doc.setDrawColor(stroke);doc.roundedRect(x,top,w,h,radius,radius,stroke?'FD':'F');};
    const page=title=>{doc.addPage();doc.setFillColor(navy);doc.rect(0,0,210,2,'F');write(title,left,15,11,true,navy);doc.setDrawColor(line);doc.line(left,20,194,20);y=26;};
    const number=value=>Number(value).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
    doc.setFillColor('#2CE51E');doc.rect(0,0,210,1.5,'F');
    const image='data:image/jpeg;base64,'+assets.shield;
    const ratio=doc.getImageProperties(image);const shieldWidth=16,shieldHeight=shieldWidth*ratio.height/ratio.width;
    doc.addImage(image,'JPEG',left,12,shieldWidth,shieldHeight);
    write('Instituto Fernando Ramírez',left+21,21,15,true,navy);
    write('Evaluación de Física I',left+21,29,10,false,muted);
    const date=new Date(state.finished);if(!Number.isNaN(date.getTime()))write('Entrega: '+date.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}),left+21,35,8,false,muted);
    y=Math.max(44,16+shieldHeight);
    write('Tu resultado',left,y+8,25,true,navy);y+=17;
    wrap(state.name,width,13,true).forEach(text=>{write(text,left,y+5,13,true);y+=6;});
    write(state.group,left,y+8,10,false,muted);y+=16;
    box(left,y,width,43,navy);
    write(number(totals.grade)+' / 10',left+8,y+23,31,true,'#FFFFFF');
    write(number(totals.percentage)+'%  ·  '+number(totals.points)+' de '+questions.length+' puntos',left+9,y+35,10,false,'#FFFFFF');
    y+=55;write('Resultados por tema',left,y,14,true,navy);y+=8;
    totals.topics.forEach((topic,index)=>{
      const title=wrap(topics[index],125,10,true),height=Math.max(22,12+title.length*5);
      if(y+height>bottom)page('Resultados por tema');
      box(left,y,width,height,index%2?'#FFFFFF':'#F3F5FB');
      write('TEMA '+(index+1),left+6,y+6,7,true,muted);
      title.forEach((part,j)=>write(part,left+6,y+12+j*5,10,true,navy));
      write(number(topic.score)+' / '+topic.total,left+145,y+13,11,true,navy);
      doc.setFillColor('#E0E5EF');doc.roundedRect(left+6,y+height-4,125,1.3,.6,.6,'F');
      if(topic.score){doc.setFillColor('#2CE51E');doc.roundedRect(left+6,y+height-4,125*topic.score/topic.total,1.3,.6,.6,'F');}
      y+=height+3;
    });
    page('Detalle de tus respuestas');
    questions.forEach((q,index)=>{
      const response=state.answers[q.id],score=scoring.grade(q,response),correct=score===1;
      const color=correct?green:score>0?amber:red,background=correct?'#EAF8EF':score>0?'#FFF5DD':'#FFF0F2';
      const title=wrap(topics[q.topic-1],111,10,true),prompt=wrap(q.prompt,width-17,9.5,true);
      const rows=(q.type==='choice'?[{label:'Respuesta',actual:response,expected:q.answer,correct}]:q.parts.map(part=>({label:part.label,actual:String(response?.[part.id]??'')+(part.unit?' '+part.unit:''),expected:String(part.answer)+(part.unit?' '+part.unit:''),correct:scoring.partCorrect(part,response?.[part.id])}))).map(row=>({
        label:wrap(row.label,width-17,8.5,true),actual:wrap('Tu respuesta: '+row.actual,width-17,9),expected:row.correct?[]:wrap('Respuesta correcta: '+row.expected,width-17,9)
      }));
      const explanation=correct?[]:wrap(q.explain,width-17,8.5);
      const header=13+title.length*4.5;
      const height=header+prompt.length*5+7+rows.reduce((sum,row)=>sum+(row.label.length+row.actual.length+row.expected.length)*4.5+5,0)+explanation.length*4.7+(explanation.length?5:0)+11;
      if(y+height>bottom)page('Detalle de tus respuestas');
      box(left,y,width,height,'#FFFFFF',line,3);doc.setFillColor(color);doc.roundedRect(left,y,1.3,height,.6,.6,'F');
      box(left+6,y+5,10,9,background,null,2);write(index+1,left+8.5,y+11,8,true,color);
      title.forEach((lineText,j)=>write(lineText,left+20,y+9+j*4.5,10,true,navy));
      write(correct?'Correcto':score>0?'Parcial':'Incorrecto',left+144,y+10,8,true,color);
      let top=y+header;
      prompt.forEach(lineText=>{write(lineText,left+8,top,9.5,true);top+=5;});top+=4;
      rows.forEach(row=>{
        row.label.forEach(lineText=>{write(lineText,left+8,top,8.5,true,navy);top+=4.5;});
        row.actual.forEach(lineText=>{write(lineText,left+8,top,9);top+=4.5;});
        row.expected.forEach(lineText=>{write(lineText,left+8,top,9,false,color);top+=4.5;});top+=5;
      });
      if(explanation.length){doc.setDrawColor(line);doc.line(left+8,top-2,left+width-8,top-2);top+=2;explanation.forEach(lineText=>{write(lineText,left+8,top,8.5,false,muted);top+=4.7;});}
      write(number(score)+' / 1 punto',left+137,y+height-5,8,true,color);
      y+=height+8;
    });
    const pages=doc.getNumberOfPages();
    for(let index=1;index<=pages;index++){
      doc.setPage(index);doc.setDrawColor(line);doc.line(left,282,194,282);
      write('Evaluación elaborada por el Profesor Morales Mendoza Raul',left,288,7,false,muted);
      font(7,false,muted);doc.text(index+' / '+pages,194,288,{align:'right'});
    }
    return doc;
  }
  root.IFRPDF={loadAssets,build};if(typeof module!=='undefined')module.exports=root.IFRPDF;
})(typeof window!=='undefined'?window:globalThis);
