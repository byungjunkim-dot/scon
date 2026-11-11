import { actualStageDateOf, currentPlanOf, layoutStatusOf, moduleNumber, plannedStageDateOf, today, workflowStagesOf, type ProjectDetail } from '../common/model'
import { stageColorOf } from '../common/stageColors'

const reportDate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : ''
}

/** Explicit sharing projection: never embed notes, inspections, owners or audit history. */
export function reportSnapshot(project: ProjectDetail, colors = project.stageColors) {
  if (layoutStatusOf(project) === 'draft') throw new Error('최종 배치를 확정한 뒤 보고서를 만들 수 있습니다.')
  const asOf = today()
  const stages = workflowStagesOf(project).filter(stage => stage.active).map(stage => ({ id: stage.id, label: stage.label, color: stageColorOf(colors, stage.id) }))
  return {
    name: project.config.name, config: { width: project.config.width, depth: project.config.depth, columns: project.config.columns, rows: project.config.rows, floors: project.config.floors, hasRoof: project.config.hasRoof },
    exportedAt: new Date().toISOString(), updatedAt: project.updatedAt, asOf, stages,
    modules: project.modules.filter(module => module.active).map(module => {
      const plan = currentPlanOf(module)
      return {
        number: moduleNumber(module, project.config), floor: module.floor, x: module.x, y: module.y,
        planned: Object.fromEntries(stages.map(stage => [stage.id, reportDate(plannedStageDateOf(plan, stage.id))])),
        completed: Object.fromEntries(stages.map(stage => {
          const date = reportDate(actualStageDateOf(module, stage.id))
          return [stage.id, date && date <= asOf ? date : '']
        })),
      }
    }),
  }
}

const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

export function buildReportHtml(project: ProjectDetail, colors = project.stageColors, preview = false): string {
  const snapshot = reportSnapshot(project, colors)
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>모듈러 제작 현황</title><style>${REPORT_CSS}</style></head><body${preview ? ' class="preview"' : ''}>
<header><div><p class="eyebrow">MODULAR PRODUCTION REPORT</p><h1 id="project-name"></h1><p id="timestamp" class="muted"></p></div><div class="overall"><span>전체 제작 진행률</span><strong id="overall-progress"></strong><span id="overall-count"></span><progress id="overall-bar" max="100"></progress></div></header>
<main><section class="drawing"><div class="drawing-head"><div><h2 id="floor-title"></h2><p id="floor-summary" class="muted" aria-live="polite"></p></div><div class="zoom"><button id="zoom-out" aria-label="축소">−</button><span id="zoom-label"></span><button id="zoom-in" aria-label="확대">+</button><button id="fit">화면 맞춤</button></div></div><div id="viewport"><div id="board"></div></div><p class="drawing-foot">좌하단 X1 / Y1 기준 · 빈 칸은 미배치 · 모듈을 선택하면 일정을 확인할 수 있습니다.</p></section>
<aside><section><h2>보기 선택</h2><label for="floor">층</label><select id="floor"></select><label for="stage">공정</label><select id="stage"></select><div id="legend" class="legend"></div><div id="selection-summary" class="selection-summary" aria-live="polite"></div><p class="muted">공정을 선택하면 완료된 모듈만 색상으로 표시됩니다.</p></section>
<section id="module-detail"><h2>모듈 상세</h2><p class="muted">배치도에서 모듈을 선택하세요.</p></section>
<details id="color-settings"><summary>공정 색상 설정</summary><p class="muted">색상 또는 HEX 코드를 지정하세요. 변경한 색상은 새 HTML로 저장할 수 있습니다.</p><div id="color-list"></div><button id="save-html" class="wide">색상 반영 HTML 저장</button></details>
<button id="print" class="wide">현재 층 인쇄 / PDF</button><p class="muted footnote">다운로드 시점의 현황입니다. 이후 제작 실적은 자동 갱신되지 않습니다.</p></aside></main>
<script type="application/json" id="report-data">${safeJson(snapshot)}</script><script>${REPORT_SCRIPT}</script></body></html>`
}

export function downloadReportHtml(project: ProjectDetail, colors = project.stageColors) {
  const blob = new Blob([buildReportHtml(project, colors)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.config.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}_제작현황_${today()}.html`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const REPORT_CSS = `
*{box-sizing:border-box}body{margin:0;color:#203047;background:#f4f6f9;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif}button,input,select{font:inherit}button,select,input{border:1px solid #d8e0e9;border-radius:7px;background:#fff;color:inherit}button{padding:7px 11px;cursor:pointer}button:hover{border-color:#8ba0ba}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #99bafa;outline-offset:2px}button:disabled{opacity:.45;cursor:default}header{display:flex;justify-content:space-between;gap:24px;padding:26px 30px;background:white;border-bottom:1px solid #e0e6ef}h1{font-size:25px;margin:3px 0 7px;overflow-wrap:anywhere}h2{font-size:15px;margin:0 0 12px}.eyebrow{font-size:10px;letter-spacing:.14em;color:#8290a5;margin:0}.muted{color:#758397;font-size:12px;margin:8px 0;overflow-wrap:anywhere}.overall{min-width:180px;display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-content:center;font-size:12px}.overall strong{font-size:29px;grid-column:2;grid-row:1/3}.overall progress{grid-column:1/-1;width:100%;height:7px;accent-color:#155DFC}main{display:grid;grid-template-columns:minmax(0,4fr) minmax(240px,1fr);gap:18px;padding:22px}.drawing,aside>section,details{border:1px solid #e0e6ef;border-radius:12px;background:#fff}.drawing{min-width:0;overflow:hidden;align-self:start}.drawing-head{display:flex;justify-content:space-between;gap:15px;align-items:center;padding:18px 20px}.drawing-head h2{margin:0}.zoom{display:flex;gap:5px;align-items:center;white-space:nowrap}.zoom button{padding:5px 10px}.zoom span{font-size:11px;min-width:36px;text-align:center}#viewport{height:calc(100vh - 275px);min-height:420px;overflow:auto;background:#fafbfd;border-top:1px solid #edf0f5;border-bottom:1px solid #edf0f5}#board{position:relative;margin:30px 28px 38px 42px;background-color:white;background-image:linear-gradient(to right,#d9e0e9 1px,transparent 1px),linear-gradient(to bottom,#d9e0e9 1px,transparent 1px);border-right:1px solid #d9e0e9;border-bottom:1px solid #d9e0e9}.axis{position:absolute;font-size:10px;line-height:14px;color:#8391a3;white-space:nowrap;pointer-events:none}.axis-x{top:100%;transform:translate(-50%,8px)}.axis-y{right:100%;transform:translate(-8px,-50%)}.module{position:absolute;display:flex;flex-direction:column;gap:7px;align-items:stretch;text-align:left;border:2px solid #c6d6e8;border-radius:5px;padding:9px;overflow:hidden;transition:background .12s}.module:hover,.module.selected{outline:3px solid #155DFC;outline-offset:-3px;z-index:1}.module-number{font-weight:800;font-size:13px;white-space:nowrap}.module-progress{font-size:12px}.module .bar{display:block;height:4px;min-height:4px;border-radius:5px;background:#20304718;overflow:hidden}.module .bar i{display:block;height:100%;background:currentColor}.module .done-list{display:block;font-size:11px;line-height:1.65;overflow:auto;overflow-wrap:anywhere}.drawing-foot{font-size:11px;color:#8491a1;margin:12px 20px}aside{display:flex;flex-direction:column;gap:13px;min-width:0}aside>section,details{padding:18px}aside label{display:block;font-size:12px;font-weight:650;margin:13px 0 5px}select{width:100%;padding:8px}.legend{display:flex;align-items:center;gap:7px;font-size:12px;margin-top:16px}.swatch{display:inline-block;flex-shrink:0;width:12px;height:12px;border:1px solid #20304725;border-radius:3px}.selection-summary{font-size:20px;font-weight:750;margin-top:9px}.detail-title{font-size:19px;font-weight:800;margin-bottom:5px}.schedule{width:100%;border-collapse:collapse;font-size:10px;margin-top:12px}.schedule th,.schedule td{text-align:left;padding:7px 3px;border-top:1px solid #edf0f5}.schedule th{font-weight:650;color:#7e8b9e}.schedule td:first-child{max-width:85px;overflow-wrap:anywhere}.late{color:#c53636;font-weight:700}summary{font-size:12px;font-weight:700;cursor:pointer}.color-row{display:grid;grid-template-columns:1fr 30px 80px;gap:6px;align-items:center;margin:12px 0;font-size:11px}.color-row span{overflow-wrap:anywhere}.color-row input[type=color]{padding:1px;width:30px;height:29px}.color-row input[type=text]{min-width:0;width:80px;padding:5px;font:11px monospace}.wide{width:100%;font-size:12px}.footnote{padding:0 4px}.empty{position:absolute;left:15px;top:15px;background:white;padding:9px;border:1px solid #dfe5ed;color:#758397}.invalid{border-color:#d33838!important}
.preview #color-settings{display:none}
.schedule-scroll{max-height:300px;overflow:auto}.schedule th{position:sticky;top:0;background:white}
@media(max-width:900px){header{padding:20px;flex-wrap:wrap}main{grid-template-columns:minmax(0,1fr);padding:12px}.drawing-head{flex-wrap:wrap}aside{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}#viewport{height:60vh;min-height:350px}}@media(max-width:520px){aside{display:flex}.overall{width:100%}.module{padding:5px;gap:4px}}
@page{size:A4 landscape;margin:12mm}
@media print{body{background:white}header{padding:0 0 15px}main{display:block;padding:10px 0}.drawing{border:0;overflow:visible}.drawing-head{padding:10px 0}.zoom,aside,#color-settings{display:none}#viewport{height:auto!important;min-height:0;overflow:visible;border:0}#board{margin:20px 16px 30px 28px}.module{break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}.drawing-foot{margin-left:0}}
`

const REPORT_SCRIPT = String.raw`
(function(){
  'use strict';
  var data = JSON.parse(document.getElementById('report-data').textContent);
  var stages = data.stages, config = data.config;
  var selectedFloor = 1, selectedStage = '', selectedNumber = '', zoom = 1;
  var $ = function(id){ return document.getElementById(id); };
  function el(tag, text, cls){ var item = document.createElement(tag); if(text !== undefined) item.textContent = String(text); if(cls) item.className = cls; return item; }
  function done(module){ return stages.filter(function(s){ return Boolean(module.completed[s.id]); }); }
  function percent(module){ return stages.length ? Math.round(done(module).length / stages.length * 100) : 0; }
  function foreground(hex){ var c = [1,3,5].map(function(i){ var n=parseInt(hex.slice(i,i+2),16)/255; return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4); }); return c[0]*.2126+c[1]*.7152+c[2]*.0722>.179?'#142033':'#ffffff'; }
  function floorModules(){ return data.modules.filter(function(m){return m.floor===selectedFloor;}); }
  function timestamp(value){ var d=new Date(value); return isNaN(d.getTime())?'—':new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d); }
  document.title = data.name + ' · 제작 현황';
  $('project-name').textContent = data.name;
  $('timestamp').textContent = '현황 저장 '+timestamp(data.updatedAt)+' · HTML 생성 '+timestamp(data.exportedAt)+' (한국 기준)';
  var count = data.modules.reduce(function(sum,m){return sum+done(m).length;},0), total=data.modules.length*stages.length, overall=total?Math.round(count/total*100):0;
  $('overall-progress').textContent=overall+'%'; $('overall-count').textContent=data.modules.length+'개 모듈 · '+count+' / '+total+' 공정 완료'; $('overall-bar').value=overall;
  var totalFloors = config.hasRoof ? (config.floors + 1) : config.floors;
  for(var f=1;f<=totalFloors;f++){var isR=config.hasRoof&&f===totalFloors;var option=el('option',(isR?'RF (지붕층)':f+'층')+' · '+data.modules.filter(function(m){return m.floor===f;}).length+'개');option.value=f;$('floor').append(option);}
  var overview=el('option','전체 공정 / 진행률');overview.value='';$('stage').append(overview);
  stages.forEach(function(s){var option=el('option',s.label);option.value=s.id;$('stage').append(option);});
  function renderDetail(){
    var panel=$('module-detail');panel.replaceChildren();panel.append(el('h2','모듈 상세'));
    var module=data.modules.find(function(m){return m.number===selectedNumber;});
    if(!module){panel.append(el('p','배치도에서 모듈을 선택하세요.','muted'));return;}
    panel.append(el('div',module.number,'detail-title'),el('p',percent(module)+'% · '+done(module).length+' / '+stages.length+' 공정 완료','muted'));
    var table=el('table',undefined,'schedule'), head=el('thead'), hr=el('tr');['공정','계획','완료'].forEach(function(t){hr.append(el('th',t));});head.append(hr);table.append(head);
    var body=el('tbody'); stages.forEach(function(s){var row=el('tr'), planned=module.planned[s.id], actual=module.completed[s.id];row.append(el('td',s.label),el('td',planned||'—'),el('td',actual||'—'));if(planned && (actual||data.asOf)>planned){row.className='late';var delay=Math.round((Date.parse((actual||data.asOf)+'T00:00:00Z')-Date.parse(planned+'T00:00:00Z'))/86400000);row.title=delay+'일 지연';}body.append(row);});table.append(body);var scroll=el('div',undefined,'schedule-scroll');scroll.append(table);panel.append(scroll);
  }
  function render(){
    var modules=floorModules(), stage=stages.find(function(s){return s.id===selectedStage;}), completed=stage?modules.filter(function(m){return Boolean(m.completed[stage.id]);}).length:modules.filter(function(m){return percent(m)===100;}).length;
    var isRFloor = config.hasRoof && selectedFloor === totalFloors;
    $('floor-title').textContent=(isRFloor ? '지붕층 (RF)' : selectedFloor+'층')+' 모듈 배치도';
    var floorTotal=modules.length*stages.length, floorDone=modules.reduce(function(sum,m){return sum+done(m).length;},0);
    $('floor-summary').textContent=modules.length+'개 모듈 · 층 진행률 '+(floorTotal?Math.round(floorDone/floorTotal*100):0)+'% · '+config.width+' × '+config.depth+' m / 모듈';
    var legend=$('legend');legend.replaceChildren();var dot=el('span',undefined,'swatch');dot.style.background=stage?stage.color:'#dce7f7';legend.append(dot,el('span',stage?stage.label+' 완료':'전체 공정 진행률'));
    $('selection-summary').textContent=completed+' / '+modules.length+'개 '+(stage?'완료':'전체 공정 완료');
    var board=$('board');board.replaceChildren();var cw=140*zoom,ch=cw*config.depth/config.width;board.style.width=config.columns*cw+'px';board.style.height=config.rows*ch+'px';board.style.backgroundSize=cw+'px '+ch+'px';
    $('zoom-label').textContent=Math.round(zoom*100)+'%';$('zoom-out').disabled=zoom<=.2;$('zoom-in').disabled=zoom>=2.5;
    for(var x=0;x<=config.columns;x++){var ax=el('span','X'+(x+1),'axis axis-x');ax.style.left=x*cw+'px';board.append(ax);}
    for(var y=0;y<=config.rows;y++){var ay=el('span','Y'+(y+1),'axis axis-y');ay.style.top=(config.rows-y)*ch+'px';board.append(ay);}
    modules.forEach(function(m){
      var finished=done(m), latest=finished[finished.length-1], isDone=stage&&Boolean(m.completed[stage.id]);
      var cell=el('button',undefined,'module'+(selectedNumber===m.number?' selected':''));cell.dataset.module=m.number;cell.dataset.completed=stage?String(Boolean(isDone)):String(finished.length);cell.setAttribute('aria-label',m.number+' · '+percent(m)+'%'+(stage?' · '+stage.label+(isDone?' 완료':' 미완료'):''));cell.setAttribute('aria-pressed',String(selectedNumber===m.number));
      cell.style.left=m.x*cw+2+'px';cell.style.top=(config.rows-1-m.y)*ch+2+'px';cell.style.width=Math.max(1,cw-4)+'px';cell.style.height=Math.max(1,ch-4)+'px';cell.style.padding=Math.max(0,Math.min(9,(Math.min(cw,ch)-4)/8))+'px';
      cell.style.background=stage?(isDone?stage.color:'#eef1f5'):(latest?latest.color+'18':'#f3f5f8');cell.style.color=stage&&isDone?foreground(stage.color):'#27384f';cell.style.borderColor=stage&&isDone?stage.color:'#ccd6e3';
      cell.append(el('span',m.number,'module-number'),el('span',percent(m)+'%','module-progress'));
      var bar=el('span',undefined,'bar'),fill=el('i');fill.style.width=percent(m)+'%';bar.append(fill);cell.append(bar);
      var text=stage?(isDone?stage.label+' 완료\n'+m.completed[stage.id]:'미완료'):(finished.length?finished.map(function(s){return s.label;}).join(' · '):'완료 공정 없음');
      var list=el('span',text,'done-list');list.style.whiteSpace='pre-line';cell.append(list);cell.title=m.number+' · '+percent(m)+'%\n'+text;
      cell.onclick=function(){selectedNumber=m.number;renderDetail();board.querySelectorAll('.module').forEach(function(item){item.classList.toggle('selected',item.dataset.module===selectedNumber);item.setAttribute('aria-pressed',String(item.dataset.module===selectedNumber));});};board.append(cell);
    });
    if(!modules.length)board.append(el('div','이 층에는 배치된 모듈이 없습니다.','empty'));
    renderDetail();
  }
  $('floor').onchange=function(){selectedFloor=Number(this.value);selectedNumber='';$('viewport').scrollTop=0;$('viewport').scrollLeft=0;render();};
  $('stage').onchange=function(){selectedStage=this.value;render();};
  $('zoom-in').onclick=function(){zoom=Math.min(2.5,Math.round((zoom+.1)*100)/100);render();};
  $('zoom-out').onclick=function(){zoom=Math.max(.2,Math.round((zoom-.1)*100)/100);render();};
  function fitToViewport(){zoom=Math.max(.2,Math.min(2.5,($('viewport').clientWidth-85)/(config.columns*140),($('viewport').clientHeight-85)/(config.rows*140*config.depth/config.width)));render();}
  $('fit').onclick=fitToViewport;
  $('print').onclick=function(){window.print();};
  var screenZoom=zoom;
  window.addEventListener('beforeprint',function(){screenZoom=zoom;zoom=Math.min(1,960/(config.columns*140),610/(config.rows*140*config.depth/config.width));render();});
  window.addEventListener('afterprint',function(){zoom=screenZoom;render();});
  stages.forEach(function(stage){
    var row=el('label',undefined,'color-row'),name=el('span',stage.label),picker=el('input'),code=el('input');picker.type='color';picker.value=stage.color;picker.setAttribute('aria-label',stage.label+' 색상');code.type='text';code.value=stage.color;code.maxLength=7;code.setAttribute('aria-label',stage.label+' HEX');
    picker.oninput=function(){stage.color=this.value.toUpperCase();code.value=stage.color;code.classList.remove('invalid');code.setCustomValidity('');render();};
    code.oninput=function(){var valid=/^#[0-9a-fA-F]{6}$/.test(this.value);code.classList.toggle('invalid',!valid);code.setCustomValidity(valid?'':'#RRGGBB 형식으로 입력하세요.');if(valid){stage.color=this.value.toUpperCase();picker.value=stage.color;render();}};
    row.append(name,picker,code);$('color-list').append(row);
  });
  $('save-html').onclick=function(){
    var invalid=$('color-list').querySelector('input:invalid');if(invalid){invalid.reportValidity();return;}
    var copy=document.documentElement.cloneNode(true);copy.querySelector('#report-data').textContent=JSON.stringify(data).replace(/[<>&\u2028\u2029]/g,function(char){return String.fromCharCode(92)+'u'+char.charCodeAt(0).toString(16).padStart(4,'0');});
    /* Remove rendered controls: startup always recreates them from the embedded snapshot. */
    ['floor','stage','color-list','board'].forEach(function(id){copy.querySelector('#'+id).replaceChildren();});
    var blob=new Blob(['<!doctype html>\n'+copy.outerHTML],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=data.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'_제작현황_'+data.asOf+'.html';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  };
  fitToViewport();
})();
`
