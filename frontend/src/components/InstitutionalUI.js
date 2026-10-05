import './InstitutionalUI.css';

let toastHost;

function getToastHost(){
  if(!toastHost){
    toastHost=document.createElement('div');
    toastHost.className='institutional-toast-host';
    document.body.appendChild(toastHost);
  }
  return toastHost;
}

export function showToast(message,{type='info',title,duration=3600}={}){
  const host=getToastHost();
  const item=document.createElement('div');
  item.className=`institutional-toast ${type}`;
  const icon=type==='success'?'✓':type==='error'?'!':type==='warning'?'!':'i';
  item.innerHTML=`<div class="institutional-toast-icon">${icon}</div><div><strong>${escapeHtml(title||defaultTitle(type))}</strong><p>${escapeHtml(String(message||''))}</p></div><button aria-label="Cerrar">×</button>`;
  item.querySelector('button').onclick=()=>removeToast(item);
  host.appendChild(item);
  requestAnimationFrame(()=>item.classList.add('show'));
  window.setTimeout(()=>removeToast(item),duration);
}

function removeToast(item){
  if(!item?.parentNode)return;
  item.classList.remove('show');
  window.setTimeout(()=>item.remove(),180);
}
function defaultTitle(type){return type==='success'?'Operación completada':type==='error'?'No se pudo completar':type==='warning'?'Atención':'Información';}
function escapeHtml(v){return v.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function createBackdrop(){
  const backdrop=document.createElement('div');
  backdrop.className='institutional-dialog-backdrop';
  document.body.appendChild(backdrop);
  requestAnimationFrame(()=>backdrop.classList.add('show'));
  return backdrop;
}
function closeBackdrop(backdrop){
  backdrop.classList.remove('show');
  window.setTimeout(()=>backdrop.remove(),180);
}

export function confirmDialog({title='Confirmar acción',message,confirmText='Confirmar',cancelText='Cancelar',tone='primary'}={}){
  return new Promise(resolve=>{
    const backdrop=createBackdrop();
    const dialog=document.createElement('div');
    dialog.className='institutional-dialog';
    dialog.innerHTML=`
      <div class="institutional-dialog-head"><div class="institutional-dialog-mark ${tone}">?</div><div><span>SKILLMATCH</span><h3>${escapeHtml(title)}</h3></div></div>
      <p class="institutional-dialog-message">${escapeHtml(String(message||''))}</p>
      <div class="institutional-dialog-actions"><button class="institutional-btn secondary" data-cancel>${escapeHtml(cancelText)}</button><button class="institutional-btn ${tone}" data-confirm>${escapeHtml(confirmText)}</button></div>`;
    backdrop.appendChild(dialog);
    const finish=v=>{closeBackdrop(backdrop);resolve(v)};
    dialog.querySelector('[data-confirm]').onclick=()=>finish(true);
    dialog.querySelector('[data-cancel]').onclick=()=>finish(false);
    backdrop.onclick=e=>{if(e.target===backdrop)finish(false)};
  });
}

export function promptDialog({title='Capturar información',message='',label='Información',value='',placeholder='',confirmText='Guardar',cancelText='Cancelar',multiline=false,options=null,required=false}={}){
  return new Promise(resolve=>{
    const backdrop=createBackdrop();
    const dialog=document.createElement('div');
    dialog.className='institutional-dialog';
    const field=Array.isArray(options)
      ? `<select data-value>${options.map(o=>`<option value="${escapeHtml(String(typeof o==='object'?o.value:o))}" ${String(typeof o==='object'?o.value:o)===String(value)?'selected':''}>${escapeHtml(String(typeof o==='object'?o.label:o))}</option>`).join('')}</select>`
      : multiline
        ? `<textarea data-value placeholder="${escapeHtml(placeholder)}">${escapeHtml(String(value||''))}</textarea>`
        : `<input data-value value="${escapeHtml(String(value||''))}" placeholder="${escapeHtml(placeholder)}"/>`;
    dialog.innerHTML=`
      <div class="institutional-dialog-head"><div class="institutional-dialog-mark primary">✎</div><div><span>SKILLMATCH</span><h3>${escapeHtml(title)}</h3></div></div>
      ${message?`<p class="institutional-dialog-message">${escapeHtml(message)}</p>`:''}
      <label class="institutional-dialog-field"><span>${escapeHtml(label)}</span>${field}<small data-error></small></label>
      <div class="institutional-dialog-actions"><button class="institutional-btn secondary" data-cancel>${escapeHtml(cancelText)}</button><button class="institutional-btn primary" data-confirm>${escapeHtml(confirmText)}</button></div>`;
    backdrop.appendChild(dialog);
    const input=dialog.querySelector('[data-value]');
    window.setTimeout(()=>input?.focus(),30);
    const finish=v=>{closeBackdrop(backdrop);resolve(v)};
    dialog.querySelector('[data-cancel]').onclick=()=>finish(null);
    dialog.querySelector('[data-confirm]').onclick=()=>{
      const v=input.value.trim();
      if(required&&!v){dialog.querySelector('[data-error]').textContent='Este dato es obligatorio.';input.focus();return;}
      finish(v);
    };
    backdrop.onclick=e=>{if(e.target===backdrop)finish(null)};
  });
}
