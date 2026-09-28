/* La interfaz, las pruebas y el PDF comparten estas reglas. */
(function(root){
  'use strict';
  const nonempty=value=>String(value??'').trim().length>0;
  function number(value){
    const text=String(value??'').trim().replace(/[−–]/g,'-').replace(',','.');
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return null;
    const result=Number(text);
    return Number.isFinite(result)?result:null;
  }
  function partCorrect(part,value){
    if(part.kind==='choice')return value===part.answer;
    const result=number(value);
    const tolerance=part.decimals===undefined?1e-9:0.5*10**(-part.decimals)+1e-9;
    return result!==null&&Math.abs(result-part.answer)<tolerance;
  }
  function grade(q,value){
    if(q.type==='choice')return value===q.answer?1:0;
    if(q.type==='parts')return q.parts.reduce((sum,part)=>sum+(partCorrect(part,value?.[part.id])?1:0),0)/q.parts.length;
    return 0;
  }
  function complete(q,value){
    if(q.type==='choice')return nonempty(value);
    if(q.type==='parts')return q.parts.every(part=>nonempty(value?.[part.id]));
    return false;
  }
  function answerText(q,value){
    if(q.type==='choice')return nonempty(value)?String(value):'Sin respuesta';
    return q.parts.map(part=>part.label+': '+(nonempty(value?.[part.id])?value[part.id]:'Sin respuesta')+(part.unit?' '+part.unit:'')).join('; ');
  }
  function expected(q){
    if(q.type==='choice')return q.answer;
    return q.parts.map(part=>part.label+': '+part.answer+(part.unit?' '+part.unit:'')).join('; ');
  }
  root.ExamScoring={number,partCorrect,grade,complete,answerText,expected};
  if(typeof module!=='undefined')module.exports=root.ExamScoring;
})(typeof window!=='undefined'?window:globalThis);
