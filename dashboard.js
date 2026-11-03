'use strict';
const SUPABASE_URL='https://vmenybnuyiwtxazstydk.supabase.co';
const SUPABASE_KEY='sb_publishable_c2fj1vnsKwhxVY2IHI0RuA_J_jefH6G';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const TYPE={quote:'Devis',invoice:'Facture',intake:'Prise en charge'},ICON={quote:'📄',invoice:'🧾',intake:'🖥️'};
const SC={'En cours':'s-cours','En attente':'s-attente','Terminé':'s-termine','Payé':'s-paye','Annulé':'s-annule'};
let customers=[],docs=[],activeDocument=null,activePayload={},docFilter='all',ndType='quote',ready=false,busy=false,tt;
const empty=m=>`<div class="empty">${ready?m:'Chargement…'}</div>`;
const cardOf=c=>c?.loyalty_cards?.[0];
const fullName=c=>c?`${c.first_name||''} ${c.last_name||''}`.trim():'Client non associé';
const initials=c=>((c.first_name||'?')[0]+(c.last_name||'')[0]).toUpperCase();
const norm=s=>String(s||'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function toast(t,bad){const e=$('toast');e.textContent=t;e.className='toast show'+(bad?' bad':'');clearTimeout(tt);tt=setTimeout(()=>e.className='toast',3200)}
function totals(p){const it=Array.isArray(p?.items)?p.items:[];const ht0=it.reduce((s,i)=>s+(+i.qty||0)*(+i.price||0),0),disc=Math.min(ht0,Math.max(0,+p?.discount||0)),r=ht0?disc/ht0:0;const vat=it.reduce((s,i)=>s+(+i.qty||0)*(+i.price||0)*(1-r)*(+i.vat||0)/100,0);return{ht:ht0-disc,vat,ttc:ht0-disc+vat}}
const sum=a=>a.reduce((s,d)=>s+totals(d.payload).ttc,0);

/* ---------- Auth ---------- */
async function admin(){const {data:{user},error}=await db.auth.getUser();if(error||!user)return null;const {data,error:e}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(e)throw e;if(!data){await db.auth.signOut();throw Error('Ce compte ne figure pas dans les administrateurs autorisés.')}return user}
function show(on){$('login').hidden=on;$('dashboard').hidden=!on;$('nav').hidden=!on;$('logout').hidden=!on}
async function init(u){$('adminEmail').textContent=u.email||'';show(true);const v=location.hash.slice(1);switchView(['clients','loyalty','docs','settings'].includes(v)?v:'home');renderAll();try{await Promise.all([load(),loadDocs(),loadSettings()])}catch(e){toast(e.message||String(e),1)}ready=true;renderAll()}
$('loginForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('loginMessage').textContent='Connexion…';try{const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;const u=await admin();if(!u)throw Error('Connexion requise.');$('password').value='';$('loginMessage').textContent='';await init(u)}catch(e){$('loginMessage').textContent=e.message||String(e)}finally{busy=false}};
const logout=async()=>{await db.auth.signOut();ready=false;show(false);toast('Déconnecté.')};$('logout').onclick=logout;$('logout2').onclick=logout;

/* ---------- Données ---------- */
async function load(){
 const [a,b]=await Promise.all([db.from('customers').select('id,first_name,last_name,phone,email,company,address,postcode,city,notes').order('last_name'),db.from('loyalty_cards').select('id,customer_id,points,reward_unlocked')]);
 if(a.error)throw a.error;if(b.error)throw b.error;
 const m=new Map();(b.data||[]).forEach(c=>{if(!m.has(c.customer_id))m.set(c.customer_id,[]);m.get(c.customer_id).push(c)});
 customers=(a.data||[]).map(c=>({...c,loyalty_cards:m.get(c.id)||[]}));
}
async function loadDocs(){const {data,error}=await db.from('management_documents').select('id,type,number,document_date,due_date,customer_id,subject,status,created_at,payload').order('created_at',{ascending:false});if(error)throw error;docs=data||[]}
async function syncCards(){const {data,error}=await db.from('loyalty_cards').select('id,customer_id,points,reward_unlocked');if(error)return;const m=new Map(data.map(c=>[c.customer_id,[c]]));customers.forEach(c=>c.loyalty_cards=m.get(c.id)||[]);renderAll()}

/* ---------- Affichage ---------- */
function docRow(d){const c=customers.find(x=>x.id===d.customer_id),t=totals(d.payload).ttc;return `<button class="row" data-doc="${esc(d.id)}"><span class="dot">${ICON[d.type]||'📄'}</span><span class="grow"><b>${esc(d.number)} · ${TYPE[d.type]||esc(d.type)}</b><small>${esc(fullName(c))} · ${esc(d.subject||'Sans objet')}</small></span><span class="end"><em class="badge ${SC[d.status]||''}">${esc(d.status||'')}</em>${t?`<small>${money(t)}</small>`:''}</span></button>`}
function renderHome(){
 $('today').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
 const gifts=customers.filter(c=>(cardOf(c)?.points||0)>=10),inv=docs.filter(d=>d.type==='invoice'),mo=new Date().toISOString().slice(0,7);
 $('stClients').textContent=ready?customers.length:'–';$('stGifts').textContent=ready?gifts.length:'–';
 $('stDue').textContent=ready?money(sum(inv.filter(d=>!['Payé','Annulé'].includes(d.status)))):'–';
 $('stMonth').textContent=ready?money(sum(inv.filter(d=>d.status==='Payé'&&(d.document_date||'').startsWith(mo)))):'–';
 $('homeGifts').innerHTML=gifts.length?`<div class="gift-banner"><h3>🎁 Cadeaux à remettre</h3>${gifts.map(c=>`<div class="row"><span class="av">${initials(c)}</span><span class="grow"><b>${esc(fullName(c))}</b><small>10 / 10 passages</small></span><button class="stampbtn gift" data-redeem="${cardOf(c).id}">Remettre</button></div>`).join('')}</div>`:'';
 $('homeDocs').innerHTML=docs.slice(0,5).map(docRow).join('')||empty('Aucun document pour le moment.');
}
function renderClients(){
 const q=norm($('clientSearch').value.trim());
 const rows=customers.filter(c=>norm(`${c.first_name||''} ${c.last_name||''} ${c.phone||''} ${c.email||''} ${c.company||''}`).includes(q));
 $('clientList').innerHTML=rows.map(c=>{const card=cardOf(c),n=card?.points||0;return `<div class="row" data-client="${c.id}" role="button" tabindex="0"><span class="av">${esc(initials(c))}</span><span class="grow"><b>${esc(fullName(c))}</b><small>${esc(c.company||c.phone||c.email||'Coordonnées non renseignées')}</small></span>${card?`<span class="pill ${n>=10?'gift':''}">${n>=10?'🎁 Cadeau':n+'/10'}</span>`:''}${c.phone?`<a class="call" data-stop href="tel:${esc(c.phone)}" aria-label="Appeler ${esc(fullName(c))}"><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg></a>`:''}</div>`}).join('')||empty('Aucun client trouvé.');
}
function renderLoyalty(){
 const q=norm($('loyaltySearch').value.trim());
 const rows=customers.filter(c=>cardOf(c)&&norm(fullName(c)+' '+(c.phone||'')).includes(q)).sort((a,b)=>((cardOf(b).points>=10)-(cardOf(a).points>=10)));
 $('loyaltyList').innerHTML=rows.map(c=>{const card=cardOf(c),n=Math.min(10,card.points||0);return `<div class="row"><span class="av">${esc(initials(c))}</span><span class="grow" data-client="${c.id}"><b>${esc(fullName(c))}</b><small>${n>=10?'Cadeau disponible':`${n} / 10 · encore ${10-n}`}</small><div class="prog"><i style="width:${n*10}%"></i></div></span><button class="stampbtn ${n>=10?'gift':''}" ${n>=10?`data-redeem="${card.id}">🎁 Remettre`:`data-stamp="${card.id}">＋1`}</button></div>`}).join('')||(ready&&q?`<div class="empty">Aucun résultat.<br><button class="btn primary sm" style="margin-top:12px" data-act="quickLoyalty">＋ Créer « ${esc($('loyaltySearch').value.trim())} »</button></div>`:empty('Aucun client avec carte.'));
}
function renderDocs(){
 const q=norm($('docSearch').value.trim());
 const rows=docs.filter(d=>(docFilter==='all'||d.type===docFilter)&&norm(`${d.number||''} ${d.subject||''} ${d.status||''} ${fullName(customers.find(c=>c.id===d.customer_id))}`).includes(q));
 $('docList').innerHTML=rows.map(docRow).join('')||empty('Aucun document.');
}
function renderAll(){renderHome();renderClients();renderLoyalty();renderDocs();refreshClientDlg()}
function setFilter(f){docFilter=f;document.querySelectorAll('#docChips .chip').forEach(b=>b.classList.toggle('on',b.dataset.f===f));renderDocs()}
function switchView(n){document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='v-'+n);document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.view===n));history.replaceState(null,'','#'+n);window.scrollTo({top:0})}
['clientSearch','loyaltySearch','docSearch'].forEach(id=>$(id).addEventListener('input',()=>{renderClients();renderLoyalty();renderDocs()}));

/* ---------- Fidélité ---------- */
async function stamp(cardId){
 const c=customers.find(x=>cardOf(x)?.id===cardId),card=cardOf(c);if(!card||(card.points||0)>=10)return;
 card.points=(card.points||0)+1;renderAll();
 try{const {error}=await db.rpc('add_stamp',{p_card_id:cardId});if(error)throw error;toast(`＋1 · ${fullName(c)} (${card.points}/10)`);syncCards()}
 catch(e){toast('Erreur fidélité : '+e.message,1);syncCards()}
}
async function redeem(cardId){
 const c=customers.find(x=>cardOf(x)?.id===cardId);if(!confirm(`Confirmer la remise du cadeau à ${fullName(c)} et remettre la carte à zéro ?`))return;
 try{const {error}=await db.rpc('redeem_reward',{p_card_id:cardId});if(error)throw error;toast('Cadeau remis. Carte remise à zéro.');await syncCards()}catch(e){toast('Erreur fidélité : '+e.message,1)}
}
async function loadHistory(cardId){const ul=$('stampHistory');ul.innerHTML='<li>Chargement…</li>';const {data,error}=await db.from('stamp_events').select('action,created_at').eq('card_id',cardId).order('created_at',{ascending:false}).limit(15);ul.innerHTML=error?`<li>${esc(error.message)}</li>`:(data||[]).map(e=>`<li>${new Date(e.created_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})} — ${e.action==='stamp'?'Tampon ajouté':'Cadeau remis'}</li>`).join('')||'<li>Aucun événement.</li>'}
$('histBox').ontoggle=()=>{const card=cardOf(customers.find(x=>x.id===$('clientId').value));if($('histBox').open&&card)loadHistory(card.id)};

/* ---------- Fiche client ---------- */
function renderClientLoyalty(){
 const c=customers.find(x=>x.id===$('clientId').value),card=cardOf(c),box=$('clientLoyalty');
 if(!card){box.hidden=true;return}
 const n=Math.min(10,card.points||0);box.hidden=false;
 box.innerHTML=`<div class="loy-top"><span class="muted small">Carte de fidélité</span><strong>${n}<small class="muted"> / 10</small></strong></div><div class="stamps">${Array.from({length:10},(_,i)=>`<span class="stamp ${i<n?'on':''}">${i<n?'★':''}</span>`).join('')}</div><div class="row2">${n>=10?`<button class="btn primary" data-redeem="${card.id}">🎁 Remettre le cadeau</button>`:`<button class="btn primary" data-stamp="${card.id}">＋ Ajouter un tampon</button>`}</div>`;
}
function refreshClientDlg(){if($('clientDlg').open&&$('clientId').value)renderClientLoyalty()}
function openClient(id){
 const c=customers.find(x=>x.id===id),map={firstName:'first_name',lastName:'last_name',clientEmail:'email'};
 $('clientTitle').textContent=c?fullName(c):'Nouveau client';$('clientId').value=c?.id||'';
 ['firstName','lastName','company','phone','clientEmail','address','postcode','city','notes'].forEach(k=>$(k).value=c?.[map[k]||k]||'');
 renderClientLoyalty();$('clientDocsBox').hidden=!c;
 if(c)$('clientDocs').innerHTML=docs.filter(d=>d.customer_id===c.id).map(docRow).join('')||'<div class="empty">Aucun document.</div>';
 $('histBox').hidden=!(c&&cardOf(c));$('histBox').open=false;
 if(!$('clientDlg').open)$('clientDlg').showModal();
}
$('clientForm').onsubmit=async e=>{
 e.preventDefault();const id=$('clientId').value,v=k=>$(k).value.trim()||null;
 const row={first_name:$('firstName').value.trim(),last_name:$('lastName').value.trim(),phone:v('phone'),email:v('clientEmail'),company:v('company'),address:v('address'),postcode:v('postcode'),city:v('city'),notes:v('notes')};
 try{
  const r=id?await db.from('customers').update(row).eq('id',id).select('id').single():await db.from('customers').insert(row).select('id').single();
  if(r.error)throw r.error;
  const old=customers.find(c=>c.id===r.data.id);
  if(!old||!cardOf(old)){const {error}=await db.from('loyalty_cards').insert({customer_id:r.data.id});if(error&&!/duplicate|unique/i.test(error.message))throw error}
  await load();renderAll();$('clientDlg').close();toast(id?'Fiche client mise à jour.':'Client et carte fidélité créés.');
 }catch(err){toast('Erreur : '+err.message,1)}
};

/* ---------- Nouveau document ---------- */
let ndSel=null,ndNewMode=false;
function setSeg(){document.querySelectorAll('#ndSeg button').forEach(b=>b.classList.toggle('on',b.dataset.t===ndType))}
document.querySelectorAll('#ndSeg button').forEach(b=>b.onclick=()=>{ndType=b.dataset.t;setSeg()});
function ndRender(){
 if(ndSel)return;const raw=$('ndSearch').value.trim(),q=norm(raw);
 const rows=customers.filter(c=>norm(`${c.first_name||''} ${c.last_name||''} ${c.phone||''} ${c.company||''}`).includes(q)).slice(0,40);
 $('ndResults').innerHTML=`<button type="button" class="pick-new" data-newc>＋ Nouveau client${raw?` « ${esc(raw)} »`:''}</button>`+rows.map(c=>`<button type="button" class="row" data-pick="${c.id}"><span class="av">${esc(initials(c))}</span><span class="grow"><b>${esc(fullName(c))}</b><small>${esc(c.company||c.phone||'')}</small></span></button>`).join('');
 $('ndResults').hidden=false;
}
function ndChoose(id){const c=customers.find(x=>x.id===id);if(!c)return;ndSel=id;ndNewMode=false;$('ndSearch').value=fullName(c);$('ndSearch').classList.add('chosen');$('ndResults').hidden=true;$('ndNew').hidden=true}
function ndNewClient(){
 const t=$('ndSearch').value.trim(),[f,...r]=t.split(/\s+/),cap=s=>s?s[0].toLocaleUpperCase('fr')+s.slice(1):'';
 $('nFirst').value=cap(f||'');$('nLast').value=cap(r.join(' '));$('nPhone').value='';ndSel=null;ndNewMode=true;
 $('ndResults').hidden=true;$('ndNew').hidden=false;($('nFirst').value?($('nLast').value?$('nPhone'):$('nLast')):$('nFirst')).focus();
}
$('ndSearch').addEventListener('input',()=>{ndSel=null;ndNewMode=false;$('ndNew').hidden=true;$('ndSearch').classList.remove('chosen');ndRender()});
$('ndSearch').addEventListener('focus',()=>{if(ndSel)$('ndSearch').select();else if(!ndNewMode)ndRender()});
function openNewDoc(type,customerId){
 ndType=type||'quote';setSeg();ndSel=null;ndNewMode=false;
 $('ndSearch').value='';$('ndSearch').classList.remove('chosen');$('ndNew').hidden=true;
 if($('clientDlg').open)$('clientDlg').close();$('newDocDlg').showModal();
 if(customerId)ndChoose(customerId);else ndRender();
}
$('ndCreate').onclick=async()=>{
 $('ndCreate').disabled=true;
 try{
  let customer_id=ndSel;
  if(ndNewMode){
   const first=$('nFirst').value.trim(),last=$('nLast').value.trim(),phone=$('nPhone').value.trim();
   if(!first||!last){toast('Renseigne le prénom et le nom du nouveau client.',1);return}
   const digits=s=>String(s||'').replace(/\D/g,''),dup=digits(phone).length>=6&&customers.find(c=>digits(c.phone)===digits(phone));
   if(dup){customer_id=dup.id;toast(`Ce numéro existe déjà : ${fullName(dup)}`)}
   else{
    const r=await db.from('customers').insert({first_name:first,last_name:last,phone:phone||null}).select('id').single();if(r.error)throw r.error;
    const k=await db.from('loyalty_cards').insert({customer_id:r.data.id});if(k.error&&!/duplicate|unique/i.test(k.error.message))throw k.error;
    customer_id=r.data.id;await load();
   }
  }
  if(!customer_id){toast('Choisis un client dans la liste ou crée-en un.',1);return}
  const {data:number,error:ne}=await db.rpc('next_management_document_number',{p_type:ndType});if(ne)throw ne;
  const row={id:crypto.randomUUID(),type:ndType,number,customer_id,document_date:new Date().toISOString().slice(0,10),subject:$('ndSubject').value.trim(),status:'En cours',validity:30,due_date:'',payload:{items:[],discount:0,notes:''},issued:false};
  const {error}=await db.from('management_documents').insert(row);if(error)throw error;
  $('newDocDlg').close();await loadDocs();renderAll();toast(`${number} créé.`);await openDocument(row.id);
 }catch(e){toast('Création impossible : '+e.message,1)}finally{$('ndCreate').disabled=false}
};

/* ---------- Éditeur de document ---------- */
function itemRow(i={description:'',qty:1,price:0,vat:0}){
 const d=document.createElement('div');d.className='item';
 d.innerHTML=`<label class="d">Désignation<input class="item-description" maxlength="240" value="${esc(i.description||'')}"></label><button type="button" class="rm" aria-label="Supprimer la ligne">×</button><label>Qté<input class="item-qty" type="number" min="0" step="0.01" inputmode="decimal" value="${+(i.qty??1)}"></label><label>Prix €<input class="item-price" type="number" min="0" step="0.01" inputmode="decimal" value="${+(i.price??0)}"></label><label>TVA %<input class="item-vat" type="number" min="0" max="100" step="0.1" inputmode="decimal" value="${+(i.vat??0)}"></label>`;
 d.querySelectorAll('input').forEach(x=>x.addEventListener('input',calc));d.querySelector('.rm').onclick=()=>{d.remove();calc()};return d;
}
function getItems(){return [...$('documentItems').children].map(r=>({description:r.querySelector('.item-description').value.trim(),qty:Math.max(0,+r.querySelector('.item-qty').value||0),price:Math.max(0,+r.querySelector('.item-price').value||0),vat:Math.max(0,Math.min(100,+r.querySelector('.item-vat').value||0))}))}
function calc(){const t=totals({items:getItems(),discount:$('editDocDiscount').value});$('docTotalHT').textContent=money(t.ht);$('docTotalVAT').textContent=money(t.vat);$('docTotalTTC').textContent=money(t.ttc)}
$('editDocDiscount').addEventListener('input',calc);
$('addDocumentItem').onclick=()=>{const r=itemRow();$('documentItems').appendChild(r);calc();r.querySelector('input').focus()};
const setVal=(id,v)=>{$(id).value=v??''};
async function openDocument(id){
 try{
  const {data,error}=await db.from('management_documents').select('*').eq('id',id).single();if(error)throw error;
  activeDocument=data;activePayload=data.payload&&typeof data.payload==='object'?data.payload:{};
  const c=customers.find(x=>x.id===data.customer_id);
  $('editorDocTitle').textContent=`${data.number} · ${TYPE[data.type]||data.type}${c?' — '+fullName(c):''}`;
  setVal('editDocSubject',data.subject);setVal('editDocDate',data.document_date);setVal('editDocStatus',data.status||'En cours');setVal('editDocValidity',data.validity??30);setVal('editDocDueDate',data.due_date||'');setVal('editDocDiscount',activePayload.discount??0);setVal('editDocNotes',activePayload.notes||'');
  $('documentItems').innerHTML='';const it=Array.isArray(activePayload.items)?activePayload.items:[];(it.length?it:[undefined]).forEach(i=>$('documentItems').appendChild(itemRow(i)));
  $('intakeFields').hidden=data.type!=='intake';
  setVal('intakeMaterial',activePayload.materialType||'');setVal('intakeModel',activePayload.model||'');setVal('intakeSerial',activePayload.serial||'');setVal('intakeAccessories',activePayload.accessories||'');setVal('intakeFault',activePayload.fault||'');setVal('intakeCondition',activePayload.condition||'');
  setVal('intakeTerms',activePayload.terms||'Matériel confié pour diagnostic. Sauvegarde des données à la charge du client sauf accord écrit contraire.');
  calc();if($('clientDlg').open)$('clientDlg').close();if(!$('docDlg').open)$('docDlg').showModal();$('docDlg').querySelector('.sheet').scrollTop=0;
 }catch(e){toast('Ouverture impossible : '+e.message,1)}
}
$('closeDocumentEditor').onclick=()=>$('docDlg').close();
$('docDlg').addEventListener('close',()=>{activeDocument=null});
$('saveDocument').onclick=async()=>{
 if(!activeDocument)return;
 const payload={...activePayload,items:getItems(),discount:Math.max(0,+$('editDocDiscount').value||0),notes:$('editDocNotes').value.trim()};
 if(activeDocument.type==='intake')Object.assign(payload,{materialType:$('intakeMaterial').value.trim(),model:$('intakeModel').value.trim(),serial:$('intakeSerial').value.trim(),accessories:$('intakeAccessories').value.trim(),fault:$('intakeFault').value.trim(),condition:$('intakeCondition').value.trim(),terms:$('intakeTerms').value.trim()});
 const patch={subject:$('editDocSubject').value.trim(),document_date:$('editDocDate').value||null,status:$('editDocStatus').value,validity:Math.max(0,+$('editDocValidity').value||0),due_date:$('editDocDueDate').value||null,payload,updated_at:new Date().toISOString()};
 $('saveDocument').disabled=true;
 try{const {error}=await db.from('management_documents').update(patch).eq('id',activeDocument.id);if(error)throw error;activeDocument={...activeDocument,...patch};activePayload=payload;await loadDocs();renderAll();toast(`${activeDocument.number} enregistré.`)}
 catch(e){toast('Enregistrement impossible : '+e.message,1)}finally{$('saveDocument').disabled=false}
};


/* ---------- Création rapide fidélité ---------- */
function openQuick(){
 const t=!$('v-loyalty').hidden?$('loyaltySearch').value.trim():'';
 const cap=s=>s?s[0].toLocaleUpperCase('fr')+s.slice(1):'';
 const [f,...r]=t.split(/\s+/);
 $('qFirst').value=cap(f||'');$('qLast').value=cap(r.join(' '));$('qPhone').value='';$('qStamp').checked=true;$('qSubmit').disabled=false;
 $('quickDlg').showModal();(t?($('qLast').value?$('qPhone'):$('qLast')):$('qFirst')).focus();
}
$('quickForm').onsubmit=async e=>{
 e.preventDefault();
 const digits=s=>String(s||'').replace(/\D/g,''),phone=$('qPhone').value.trim();
 const dup=digits(phone).length>=6&&customers.find(c=>digits(c.phone)===digits(phone));
 if(dup){$('quickDlg').close();toast(`Ce numéro existe déjà : ${fullName(dup)}`,1);openClient(dup.id);return}
 $('qSubmit').disabled=true;
 try{
  const r=await db.from('customers').insert({first_name:$('qFirst').value.trim(),last_name:$('qLast').value.trim(),phone:phone||null}).select('id').single();if(r.error)throw r.error;
  const k=await db.from('loyalty_cards').insert({customer_id:r.data.id}).select('id').single();if(k.error)throw k.error;
  let msg='Carte de fidélité créée.';
  if($('qStamp').checked){const s=await db.rpc('add_stamp',{p_card_id:k.data.id});if(s.error)toast('Carte créée, mais le tampon a échoué : '+s.error.message,1);else msg='Carte créée · 1er passage ajouté.'}
  await load();$('loyaltySearch').value='';renderAll();$('quickDlg').close();switchView('loyalty');toast(msg);
 }catch(err){toast('Création impossible : '+err.message,1);$('qSubmit').disabled=false}
};

/* ---------- Réglages ---------- */
async function loadSettings(){const {data,error}=await db.from('management_settings').select('settings').eq('id',1).maybeSingle();if(error){toast('Réglages : '+error.message,1);return}const s=data?.settings||{};setVal('settingBusinessName',s.businessName||'So Info');setVal('settingEmail',s.email||'');setVal('settingLegalStatus',s.legalStatus||'Micro-entreprise');setVal('settingVatMode',s.vatMode||'exempt');setVal('settingPaymentTerms',s.paymentTerms||'')}
$('settingsForm').onsubmit=async e=>{e.preventDefault();const settings={businessName:$('settingBusinessName').value.trim(),email:$('settingEmail').value.trim(),legalStatus:$('settingLegalStatus').value.trim(),vatMode:$('settingVatMode').value,paymentTerms:$('settingPaymentTerms').value.trim()};const {error}=await db.from('management_settings').upsert({id:1,settings,updated_at:new Date().toISOString()});error?toast('Enregistrement impossible : '+error.message,1):toast('Réglages enregistrés.')};

/* ---------- Clics ---------- */
document.addEventListener('click',e=>{
 const t=e.target;if(t.closest('[data-stop]'))return;let el;
 if(el=t.closest('[data-pick]'))return ndChoose(el.dataset.pick);
 if(t.closest('[data-newc]'))return ndNewClient();
 if(el=t.closest('[data-stamp]'))return stamp(el.dataset.stamp);
 if(el=t.closest('[data-redeem]'))return redeem(el.dataset.redeem);
 if(el=t.closest('[data-doc]'))return openDocument(el.dataset.doc);
 if(el=t.closest('[data-client]'))return openClient(el.dataset.client);
 if(el=t.closest('[data-newdoc]'))return openNewDoc(el.dataset.newdoc);
 if(el=t.closest('[data-cdoc]'))return openNewDoc(el.dataset.cdoc,$('clientId').value);
 if(el=t.closest('[data-act]')){const a=el.dataset.act;if(a==='newClient')openClient(null);else if(a==='quickLoyalty')openQuick();else{switchView('loyalty');$('loyaltySearch').focus()}return}
 if(el=t.closest('[data-view]')){switchView(el.dataset.view);if(el.dataset.filter)setFilter(el.dataset.filter);return}
 if(el=t.closest('[data-close]'))return el.closest('dialog').close();
 if(el=t.closest('[data-f]'))setFilter(el.dataset.f);
 if(t.closest('.brand')){e.preventDefault();switchView('home')}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-client]'))e.target.click()});
$('printDocument').onclick=()=>printDocument();

/* ---------- Démarrage ---------- */
(async()=>{try{const u=await admin();if(u)await init(u)}catch(e){toast(e.message,1)}})();

/* ---------- Impression (code d'origine conservé) ---------- */
function printDocument(){
  if(!activeDocument)return;
  const d=activeDocument,p=activePayload||{},c=customers.find(x=>x.id===d.customer_id)||{};
  const S={name:$('settingBusinessName').value||'So Info',email:$('settingEmail').value||'',legal:$('settingLegalStatus').value||'',terms:$('settingPaymentTerms').value||'',vat:$('settingVatMode').value};
  const fd=s=>/^\d{4}-\d{2}-\d{2}/.test(s||'')?s.slice(0,10).split('-').reverse().join('/'):(s||'');
  const intake=d.type==='intake',label={quote:'Devis',invoice:'Facture',intake:'Prise en charge'}[d.type]||'Document';
  const items=(Array.isArray(p.items)?p.items:[]).filter(i=>String(i.description||'').trim()||+i.price||+i.qty>1);
  const ht0=items.reduce((s,i)=>s+(+i.qty||0)*(+i.price||0),0),disc=Math.min(ht0,Math.max(0,+p.discount||0)),t=totals({items:p.items,discount:p.discount});
  const addr1=c.address||'',addr2=[c.postcode,c.city].filter(Boolean).join(' ');
  const meta=[['Date',fd(d.document_date)]];
  if(d.type==='quote'&&d.validity){const x=new Date(d.document_date);if(!isNaN(x)){x.setDate(x.getDate()+(+d.validity));meta.push(['Valable jusqu’au',fd(x.toISOString())])}}
  if(d.type==='invoice'&&d.due_date)meta.push(['Échéance',fd(d.due_date)]);
  const rows=items.map(i=>{const q=+i.qty||0,pr=+i.price||0;return `<tr><td>${esc(i.description||'Prestation')}</td><td class="n">${q}</td><td class="n">${money(pr)}</td><td class="n">${+i.vat||0} %</td><td class="n"><b>${money(q*pr)}</b></td></tr>`}).join('')||'<tr><td colspan="5">Aucune prestation renseignée.</td></tr>';
  const vatNote=S.vat==='exempt'&&t.vat===0?'TVA non applicable, article 293 B du CGI.':'';
  const commercial=`<table class="pd-table"><thead><tr><th style="width:46%">Désignation</th><th class="n" style="width:9%">Qté</th><th class="n" style="width:16%">Prix unit. HT</th><th class="n" style="width:9%">TVA</th><th class="n" style="width:20%">Total HT</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="pd-tot"><div><span>Sous-total HT</span><b>${money(ht0)}</b></div>${disc?`<div><span>Remise</span><b>− ${money(disc)}</b></div>`:''}${vatNote?'':`<div><span>TVA</span><b>${money(t.vat)}</b></div>`}<div class="pd-grand"><span>${vatNote?'Total à payer':'Total TTC'}</span><b>${money(t.ttc)}</b></div></div>
  ${vatNote?`<div class="pd-vatnote">${vatNote}</div>`:''}
  ${p.notes?`<section class="pd-sec"><div class="pd-label">Notes</div><p>${esc(p.notes)}</p></section>`:''}
  <section class="pd-sec"><div class="pd-label">${d.type==='invoice'?'Conditions de règlement':'Conditions'}</div><p>${esc(p.terms||S.terms||'À régler selon les conditions convenues.')}</p></section>
  ${d.type==='quote'?`<div class="pd-sign"><div><b>Bon pour accord</b><small>Date, signature et mention « Lu et approuvé »</small></div><div><b>SO INFO</b><small>Cachet et signature</small></div></div>`:''}`;
  const f=(l,v,w)=>`<div${w?' class="wide"':''}><small>${l}</small><b>${esc(v)}</b></div>`;
  const intakeBlock=`<section class="pd-sec"><div class="pd-label">Matériel confié</div><div class="pd-grid">${f('Type de matériel',p.materialType||'—')}${f('Marque / modèle',p.model||'—')}${f('Numéro de série',p.serial||'—')}${f('Accessoires remis',p.accessories||'Aucun')}${f('Panne signalée',p.fault||'Non renseignée',1)}${f('État à la réception',p.condition||'Non renseigné',1)}</div></section>
  <section class="pd-sec"><div class="pd-label">Conditions de prise en charge</div><p>${esc(p.terms||'Matériel confié pour diagnostic. Sauvegarde des données à la charge du client sauf accord écrit contraire.')}</p></section>
  <div class="pd-sign"><div><b>Signature du client</b><small>Précédée de la mention « Lu et approuvé »</small></div><div><b>Réception par SO INFO</b><small>Date et signature</small></div></div>`;
  document.getElementById('so-info-print-root')?.remove();
  const root=document.createElement('div');root.id='so-info-print-root';document.body.appendChild(root);document.body.classList.add('so-info-printing');
  root.innerHTML=`<article class="pd"><div class="pd-main">
  <header class="pd-head"><div class="pd-brand"><span class="pd-logo">S</span><div><div class="pd-name">SO <em>INFO</em></div><div class="pd-tag">Services informatiques &amp; dépannage</div></div></div>
  <div class="pd-meta"><div class="pd-type">${label}</div><div class="pd-num">N° ${esc(d.number)}</div><dl>${meta.map(m=>`<dt>${m[0]}</dt><dd>${esc(m[1])}</dd>`).join('')}</dl>${d.type==='invoice'&&d.status==='Payé'?'<div class="pd-paid">ACQUITTÉE</div>':''}</div></header>
  <div class="pd-bar"></div>
  <section class="pd-parties"><div class="pd-box"><div class="pd-label">Émetteur</div><b>${esc(S.name)}</b>${S.legal?`<span>${esc(S.legal)}</span>`:''}${S.email?`<span>${esc(S.email)}</span>`:''}</div>
  <div class="pd-box"><div class="pd-label">Client</div><b>${esc(fullName(c)==='Client non associé'?'Client':fullName(c))}</b>${c.company?`<span>${esc(c.company)}</span>`:''}${addr1?`<span>${esc(addr1)}</span>`:''}${addr2?`<span>${esc(addr2)}</span>`:''}${c.phone?`<span>${esc(c.phone)}</span>`:''}${c.email?`<span>${esc(c.email)}</span>`:''}</div></section>
  <div class="pd-subject"><small>Objet</small><b>${esc(d.subject||label)}</b></div>
  ${intake?intakeBlock:commercial}</div>
  <footer class="pd-foot"><b>${esc(S.name)}</b>${S.legal?' · '+esc(S.legal):''}${S.email?' · '+esc(S.email):''}<br>Dépannage informatique · Maintenance &amp; optimisation · Conseil</footer></article>`;
  window.onafterprint=()=>{document.getElementById('so-info-print-root')?.remove();document.body.classList.remove('so-info-printing');window.onafterprint=null};
  window.print();
}
