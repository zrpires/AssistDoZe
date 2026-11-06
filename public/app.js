const $=s=>document.querySelector(s);
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function notify(text){$('#notice').textContent=text;$('#notice').classList.remove('hidden');clearTimeout(window.noticeTimer);window.noticeTimer=setTimeout(()=>$('#notice').classList.add('hidden'),8000);}
const history=[];let health=null;
function accessToken(){try{return sessionStorage.getItem('ai-access')||'';}catch{return '';}}
async function api(path,data){
  let r;try{r=await fetch(path,{...(data?{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken()},body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(55000)});}catch{throw Error('Não foi possível conectar. Confira sua conexão e tente novamente.');}
  let value;try{value=await r.json();}catch{throw Error('Resposta inválida do servidor. Verifique o deploy.');}
  if(!r.ok){if(r.status===401){$('#access').classList.remove('hidden');$('#password').focus();}throw Error(value.error||'Falha na solicitação');}return value;
}
function bubble(text,cls=''){const n=el('div',text,'bubble '+cls);$('#messages').append(n);$('#messages').scrollTop=$('#messages').scrollHeight;}
$('#access-form').onsubmit=event=>{event.preventDefault();try{sessionStorage.setItem('ai-access',$('#password').value);$('#password').value='';notify('Senha salva nesta aba. Envie sua mensagem para verificar o acesso.');}catch{notify('O navegador bloqueou o armazenamento da senha. Habilite o armazenamento desta página.');}};
$('#chat-form').addEventListener('submit',async event=>{event.preventDefault();const message=$('#message').value.trim();if(!message)return;const button=$('#send');button.disabled=true;button.textContent='Respondendo…';bubble(message,'user');$('#message').value='';
try{const result=await api('/api/chat',{message,history:history.slice(-8),context:window.getContext?.()||{}});bubble(result.reply);history.push({role:'user',content:message},{role:'assistant',content:result.reply});if(history.length>8)history.splice(0,history.length-8);$('#mode').textContent=result.mode==='local'?'Assistente local · sem IA generativa':'IA conectada';window.speakReply?.(result.reply);}catch(e){bubble(e.message);$('#message').value=message;}finally{button.disabled=false;button.textContent='Enviar mensagem ↗';}});
async function loadHealth(){try{health=await api('/api/health');$('#mode').textContent=health.mode==='local'?'Assistente local · sem IA generativa':health.aiReady?'IA configurada':'IA aguardando configuração';if(health.authRequired)$('#access').classList.remove('hidden');if(!health.aiReady)notify('O dono do projeto precisa configurar APP_PASSWORD na Vercel.');}catch(e){$('#mode').textContent='Sem conexão';notify(e.message);}}
loadHealth();
import {validateState,parseAmount,emptyState} from './state.js';
let state=emptyState(),writable=true;const storageKey='assistdoze-data-v1';
try{const raw=localStorage.getItem(storageKey);if(raw)state=validateState(JSON.parse(raw));}catch{writable=false;notify('Dados salvos não puderam ser carregados. Exporte o backup bruto antes de substituir os dados.');}
function save(next){try{if(!writable)throw Error('Exporte os dados antigos e use “Substituir dados inválidos” antes de editar.');next=validateState(next);localStorage.setItem(storageKey,JSON.stringify(next));state=next;render();return true;}catch(e){notify(e.message||'Não foi possível salvar. Verifique o armazenamento do navegador.');return false;}}
function render(){
 $('#tasks').replaceChildren();$('#expenses').replaceChildren();const filter=$('#filter').value;
 const visible=state.tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));
 visible.forEach(t=>{const row=el('div',undefined,'item'),label=el('span',t.title,t.done?'done':'');if(t.due)label.append(el('small','Prazo: '+t.due.split('-').reverse().join('/')));const toggle=el('button',t.done?'Reabrir':'Concluir','secondary');toggle.onclick=()=>save({...state,tasks:state.tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x)});const remove=el('button','Excluir','danger');remove.onclick=()=>save({...state,tasks:state.tasks.filter(x=>x.id!==t.id)});row.append(label,toggle,remove);$('#tasks').append(row);});
 state.expenses.forEach(x=>{const row=el('div',undefined,'item'),b=el('button','Excluir','danger');b.onclick=()=>save({...state,expenses:state.expenses.filter(e=>e.id!==x.id)});row.append(el('span',x.title+' · '+money(x.cents)),b);$('#expenses').append(row);});
 if(!visible.length)$('#tasks').append(el('p','Nenhuma tarefa neste filtro.'));
 if(!state.expenses.length)$('#expenses').append(el('p','Seus gastos registrados aparecerão aqui.'));
 $('#pending').textContent=state.tasks.filter(t=>!t.done).length;$('#spent').textContent=money(state.expenses.reduce((sum,e)=>sum+e.cents,0));
}
$('#task-form').onsubmit=e=>{e.preventDefault();const task={id:crypto.randomUUID(),title:$('#title').value.trim(),due:$('#due').value,done:false};if(save({...state,tasks:[task,...state.tasks]}))e.target.reset();};
$('#expense-form').onsubmit=e=>{e.preventDefault();try{const expense={id:crypto.randomUUID(),title:$('#expense-title').value.trim(),cents:parseAmount($('#amount').value),created:new Date().toISOString()};if(save({...state,expenses:[expense,...state.expenses]}))e.target.reset();}catch(e){notify(e.message);}};
$('#filter').onchange=render;
window.getContext=()=>$('#share-context').checked?{tasks:state.tasks.filter(t=>!t.done).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,60),expenses:state.expenses.slice(0,60)}:{};
$('#backup').onclick=()=>{let raw;try{raw=localStorage.getItem(storageKey)||JSON.stringify(state);}catch{raw=JSON.stringify(state);}const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=el('a');a.href=url;a.download='assistdoze-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2000000)throw Error('O backup deve ter até 2 MB.');const next=validateState(JSON.parse(await file.text()));if(!confirm('Substituir as tarefas e despesas deste navegador pelo backup?'))return;const previous=writable;writable=true;if(!save(next))writable=previous;else notify('Backup importado.');}catch(e){notify('Não foi possível importar: '+e.message);}finally{event.target.value='';}};
$('#reset-invalid').onclick=()=>{if(writable)return notify('Seus dados estão válidos. Não há nada para reparar.');if(confirm('Você já exportou o backup bruto? Esta ação substitui os dados inválidos por um painel vazio.')){writable=true;save(emptyState());}};
render();
