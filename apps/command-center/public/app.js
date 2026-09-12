const api = window.LEO_OS_API ?? 'http://localhost:4000';
const $ = (id) => document.getElementById(id);
async function load(){
  try { const h=await fetch(`${api}/health`); $('health').textContent=h.ok?'API: online':'API: unavailable'; } catch { $('health').textContent='API: unavailable'; }
  try {
    const r=await fetch(`${api}/v1/objectives`); if(!r.ok) throw new Error('auth');
    const items=(await r.json()).data ?? [];
    const counts={total:items.length,active:items.filter(x=>['RUNNING','PLANNING','READY'].includes(x.status)).length,completed:items.filter(x=>x.status==='COMPLETED').length,blocked:items.filter(x=>['BLOCKED','FAILED'].includes(x.status)).length};
    $('cards').innerHTML=Object.entries({Objectives:counts.total,Active:counts.active,Completed:counts.completed,'Needs attention':counts.blocked}).map(([k,v])=>`<article class="card"><div class="label">${k}</div><div class="value">${v}</div></article>`).join('');
    $('objectives').innerHTML=items.length?items.map(x=>`<div class="row"><div><strong>${escapeHtml(x.title)}</strong><div class="muted">${escapeHtml(x.description ?? '')}</div></div><div class="status">${x.status}</div></div>`).join(''):'<p class="muted">No objectives yet.</p>';
  } catch { $('objectives').innerHTML='<p class="muted">Live objectives require an authenticated LEO OS session and organization context.</p>'; }
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('refresh').onclick=load; load();
