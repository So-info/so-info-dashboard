'use strict';
const SUPABASE_URL='https://vmenybnuyiwtxazstydk.supabase.co';
const SUPABASE_KEY='sb_publishable_c2fj1vnsKwhxVY2IHI0RuA_J_jefH6G';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);let customers=[],selectedCard=null,busy=false;
function msg(t){$('appMessage').textContent=t}function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function admin(){const {data:{user},error}=await db.auth.getUser();if(error||!user)return null;const {data,error:e}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(e)throw e;if(!data){await db.auth.signOut();throw Error('Ce compte ne figure pas dans les administrateurs autorisés.')}return user}
function show(logged){$('login').hidden=logged;$('dashboard').hidden=!logged;$('logout').hidden=!logged}
async function load(){const {data,error}=await db.from('customers').select('id,first_name,last_name,phone,email,company,address,postcode,city,notes,loyalty_cards(id,points,reward_unlocked)').order('last_name');if(error)throw error;customers=data||[];renderClients();fillLoyalty();fillDocumentCustomers();$('statClients').textContent=customers.length;$('statCards').textContent=customers.filter(c=>cardOf(c)).length;$('statRewards').textContent=customers.filter(c=>(cardOf(c)?.points||0)>=10).length}
function cardOf(c){return Array.isArray(c?.loyalty_cards)?c.loyalty_cards[0]:c?.loyalty_cards}
function renderClients(){const q=$('clientSearch').value.toLocaleLowerCase('fr').trim();const rows=customers.filter(c=>`${c.first_name} ${c.last_name} ${c.phone||''} ${c.email||''} ${c.company||''}`.toLocaleLowerCase('fr').includes(q));$('clientList').innerHTML=rows.map(c=>`<div class="client-row"><div><strong>${esc(c.first_name)} ${esc(c.last_name)}</strong><small>${esc(c.phone||c.email||c.company||'Coordonnées non renseignées')}</small></div><button data-edit="${c.id}">Ouvrir</button></div>`).join('')||'<p class="muted">Aucun client trouvé.</p>';document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editClient(b.dataset.edit))}
function fillLoyalty(){const sel=$('loyaltyClient'),old=sel.value;sel.innerHTML='<option value="">Sélectionner un client</option>'+customers.filter(c=>cardOf(c)).map(c=>`<option value="${c.id}">${esc(c.first_name)} ${esc(c.last_name)}</option>`).join('');if(customers.some(c=>c.id===old&&cardOf(c)))sel.value=old}
function fillDocumentCustomers(){const sel=$('docCustomer'),old=sel.value;sel.innerHTML='<option value="">Sélectionner un client</option>'+customers.map(c=>`<option value="${c.id}">${esc(c.first_name)} ${esc(c.last_name)}</option>`).join('');if(customers.some(c=>c.id===old))sel.value=old}
function editClient(id){const c=customers.find(x=>x.id===id);$('clientEditor').hidden=false;$('editorTitle').textContent=c?'Modifier la fiche client':'Nouveau client';$('clientId').value=c?.id||'';for(const k of ['firstName','lastName','company','phone','clientEmail','address','postcode','city','notes'])$(k).value=c?.[{firstName:'first_name',lastName:'last_name',clientEmail:'email'}[k]||k]||'';$('clientEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function clearEditor(){$('clientForm').reset();$('clientId').value='';$('clientEditor').hidden=true}
$('loginForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('loginMessage').textContent='Connexion…';try{const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;const u=await admin();if(!u)throw Error('Connexion requise.');$('adminEmail').textContent=u.email||'';$('password').value='';show(true);await load();await loadDocuments();await loadSettings();msg('Connecté.')}catch(e){$('loginMessage').textContent=e.message||String(e)}finally{busy=false}};
$('logout').onclick=async()=>{await db.auth.signOut();show(false);msg('Déconnecté.')};
function switchView(name){document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==`view-${name}`);document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='documents')loadDocuments();if(name==='settings')loadSettings()}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>switchView(b.dataset.go));$('clientSearch').oninput=renderClients;$('newClientBtn').onclick=()=>editClient(null);$('cancelClient').onclick=clearEditor;
$('clientForm').onsubmit=async e=>{e.preventDefault();const id=$('clientId').value;const row={first_name:$('firstName').value.trim(),last_name:$('lastName').value.trim(),phone:$('phone').value.trim()||null,email:$('clientEmail').value.trim()||null,company:$('company').value.trim()||null,address:$('address').value.trim()||null,postcode:$('postcode').value.trim()||null,city:$('city').value.trim()||null,notes:$('notes').value.trim()||null};try{let result;if(id){result=await db.from('customers').update(row).eq('id',id).select('id').single()}else{result=await db.from('customers').insert(row).select('id').single()}if(result.error)throw result.error;const customerId=result.data.id;const card=customers.find(c=>c.id===customerId);if(!card||!cardOf(card)){const {error}=await db.from('loyalty_cards').insert({customer_id:customerId});if(error&&!/duplicate|unique/i.test(error.message))throw error}clearEditor();await load();msg(id?'Fiche client mise à jour.':'Client et carte fidélité créés.')}catch(e){msg('Erreur : '+e.message)}};
$('loyaltyClient').onchange=()=>drawLoyalty($('loyaltyClient').value);
function drawLoyalty(id){const c=customers.find(x=>x.id===id),card=cardOf(c);selectedCard=card||null;$('loyaltyPanel').hidden=!card;if(!card)return;const n=Number(card.points)||0;$('loyaltyName').textContent=`${c.first_name} ${c.last_name}`;$('points').textContent=n;$('loyaltyStatus').textContent=n>=10?'Récompense disponible !':`Encore ${10-n} passage(s) !`;$('stampGrid').innerHTML=Array.from({length:10},(_,i)=>`<div class="stamp ${i<n?'done':''}">${i<n?'★':'☆'}</div>`).join('');$('rewardNotice').hidden=n<10;$('addStamp').disabled=n>=10;$('redeem').disabled=n!==10;loadHistory(card.id)}
async function loadHistory(cardId){$('stampHistory').innerHTML='<li>Chargement…</li>';const {data,error}=await db.from('stamp_events').select('action,created_at').eq('card_id',cardId).order('created_at',{ascending:false}).limit(30);if(error){$('stampHistory').innerHTML=`<li>${esc(error.message)}</li>`;return}$('stampHistory').innerHTML=(data||[]).map(e=>`<li>${new Date(e.created_at).toLocaleString('fr-FR')} — ${e.action==='stamp'?'Tampon ajouté':'Cadeau remis, carte remise à zéro'}</li>`).join('')||'<li>Aucun événement.</li>'}
$('addStamp').onclick=async()=>{if(!selectedCard)return;try{const {error}=await db.rpc('add_stamp',{p_card_id:selectedCard.id});if(error)throw error;const id=$('loyaltyClient').value;await load();$('loyaltyClient').value=id;drawLoyalty(id);msg('Tampon ajouté.')}catch(e){msg('Erreur : '+e.message)}};
$('redeem').onclick=async()=>{if(!selectedCard||!confirm('Confirmer la remise du cadeau et remettre la carte à zéro ?'))return;try{const {error}=await db.rpc('redeem_reward',{p_card_id:selectedCard.id});if(error)throw error;const id=$('loyaltyClient').value;await load();$('loyaltyClient').value=id;drawLoyalty(id);msg('Cadeau remis. Carte remise à zéro.')}catch(e){msg('Erreur : '+e.message)}};
async function loadDocuments(){
  const box=$('documentsList');
  if(!box) return;
  box.innerHTML='<p class="muted">Chargement des documents…</p>';
  try {
    const request=db.from('management_documents')
      .select('id,type,number,document_date,customer_id,subject,status,created_at')
      .order('created_at',{ascending:false});
    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('La requête Supabase met trop de temps à répondre.')),15000));
    const {data,error}=await Promise.race([request,timeout]);
    if(error) throw error;
    const rows=data||[];
    box.innerHTML=rows.map(d=>{
      const c=customers.find(x=>x.id===d.customer_id);
      const typ={quote:'Devis',invoice:'Facture',intake:'Prise en charge'}[d.type]||d.type;
      return `<div class="client-row"><div><strong>${esc(d.number)} · ${typ}</strong><small>${esc(c?c.first_name+' '+c.last_name:'Client non associé')} · ${esc(d.subject||'Sans objet')} · ${esc(d.status||'')}</small></div><div class="actions"><span class="muted small">${esc(d.document_date||'')}</span><button type="button" data-open-document="${esc(d.id)}">Ouvrir</button></div></div>`;
    }).join('')||'<p class="muted">Aucun document enregistré.</p>';
    box.querySelectorAll('[data-open-document]').forEach(b=>b.onclick=()=>openDocument(b.dataset.openDocument));
  } catch(error) {
    console.error('Chargement des documents Supabase :',error);
    box.innerHTML=`<p class="muted">Impossible de charger les documents : ${esc(error.message||String(error))}</p><p class="muted small">Aucune donnée n’a été modifiée. Réessaie avec « Actualiser ».</p>`;
  }
}
$('refreshDocuments').onclick=loadDocuments;
$('createDocument').onclick=async()=>{const type=$('docType').value,customer_id=$('docCustomer').value||null;if(!customer_id){msg('Sélectionne un client avant de créer le document.');return}try{const {data:number,error:nerr}=await db.rpc('next_management_document_number',{p_type:type});if(nerr)throw nerr;const row={id:crypto.randomUUID(),type,number,customer_id,document_date:$('docDate').value||new Date().toISOString().slice(0,10),subject:$('docSubject').value.trim(),status:$('docStatus').value,validity:30,due_date:'',payload:{items:[],discount:0,notes:''},issued:false};const {error}=await db.from('management_documents').insert(row);if(error)throw error;$('docSubject').value='';await loadDocuments();msg(`Document ${number} créé.`);await openDocument(row.id)}catch(e){msg('Création impossible : '+e.message)}};
async function loadSettings(){const {data,error}=await db.from('management_settings').select('settings').eq('id',1).maybeSingle();if(error){msg('Réglages : '+error.message);return}const s=data?.settings||{};$('settingBusinessName').value=s.businessName||'So Info';$('settingEmail').value=s.email||'';$('settingLegalStatus').value=s.legalStatus||'Micro-entreprise';$('settingVatMode').value=s.vatMode||'exempt';$('settingPaymentTerms').value=s.paymentTerms||''}
$('settingsForm').onsubmit=async e=>{e.preventDefault();const settings={businessName:$('settingBusinessName').value.trim(),email:$('settingEmail').value.trim(),legalStatus:$('settingLegalStatus').value.trim(),vatMode:$('settingVatMode').value,paymentTerms:$('settingPaymentTerms').value.trim()};const {error}=await db.from('management_settings').upsert({id:1,settings,updated_at:new Date().toISOString()});if(error)msg('Enregistrement impossible : '+error.message);else msg('Réglages enregistrés dans Supabase.')};
$('docDate').value=new Date().toISOString().slice(0,10);
(async()=>{try{const u=await admin();if(u){$('adminEmail').textContent=u.email||'';show(true);await load();await loadDocuments();await loadSettings()}}catch(e){msg(e.message)}})();


// V1.3 — édition détaillée, sauvegarde et impression des documents.
let activeDocument=null, activePayload={};
const money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
function itemRow(item={description:'',qty:1,price:0,vat:0}){
  const tr=document.createElement('tr');
  tr.innerHTML=`<td><input aria-label="Désignation" class="item-description" maxlength="240" value="${esc(item.description||'')}"></td><td><input aria-label="Quantité" class="item-qty" type="number" min="0" step="0.01" value="${Number(item.qty??1)}"></td><td><input aria-label="Prix unitaire" class="item-price" type="number" min="0" step="0.01" value="${Number(item.price??0)}"></td><td><input aria-label="TVA" class="item-vat" type="number" min="0" max="100" step="0.1" value="${Number(item.vat??0)}"></td><td><button type="button" class="remove-item" aria-label="Supprimer la ligne">×</button></td>`;
  tr.querySelectorAll('input').forEach(i=>i.addEventListener('input',calculateDocumentTotals));
  tr.querySelector('.remove-item').onclick=()=>{tr.remove();calculateDocumentTotals()};
  return tr;
}
function getDocumentItems(){
  return [...$('documentItems').querySelectorAll('tr')].map(tr=>({
    description:tr.querySelector('.item-description').value.trim(),
    qty:Math.max(0,Number(tr.querySelector('.item-qty').value)||0),
    price:Math.max(0,Number(tr.querySelector('.item-price').value)||0),
    vat:Math.max(0,Math.min(100,Number(tr.querySelector('.item-vat').value)||0))
  }));
}
function calculateDocumentTotals(){
  const items=getDocumentItems();
  const discount=Math.max(0,Number($('editDocDiscount').value)||0);
  const ht0=items.reduce((s,i)=>s+i.qty*i.price,0);
  const discountRatio=ht0>0?Math.min(1,discount/ht0):0;
  const ht=Math.max(0,ht0-discount);
  const vat=items.reduce((s,i)=>s+(i.qty*i.price*(1-discountRatio)*i.vat/100),0);
  $('docTotalHT').textContent=money(ht);
  $('docTotalVAT').textContent=money(vat);
  $('docTotalTTC').textContent=money(ht+vat);
}
$('editDocDiscount').addEventListener('input',calculateDocumentTotals);
$('addDocumentItem').onclick=()=>{$('documentItems').appendChild(itemRow());calculateDocumentTotals()};
function setVal(id,v){$(id).value=v??''}
async function openDocument(id){
  try{
    const {data,error}=await db.from('management_documents').select('*').eq('id',id).single();
    if(error)throw error;
    activeDocument=data;activePayload=data.payload&&typeof data.payload==='object'?data.payload:{};
    const client=customers.find(c=>c.id===data.customer_id);
    const typeLabel={quote:'Devis',invoice:'Facture',intake:'Prise en charge'}[data.type]||data.type;
    $('editorDocTitle').textContent=`${data.number} · ${typeLabel}${client?' — '+client.first_name+' '+client.last_name:''}`;
    setVal('editDocSubject',data.subject);setVal('editDocDate',data.document_date);setVal('editDocStatus',data.status||'En cours');
    setVal('editDocValidity',data.validity??30);setVal('editDocDueDate',data.due_date||'');
    setVal('editDocDiscount',activePayload.discount??0);setVal('editDocNotes',activePayload.notes||'');
    $('documentItems').innerHTML='';
    const items=Array.isArray(activePayload.items)?activePayload.items:[];
    (items.length?items:[{description:'',qty:1,price:0,vat:0}]).forEach(i=>$('documentItems').appendChild(itemRow(i)));
    $('intakeFields').hidden=data.type!=='intake';
    setVal('intakeMaterial',activePayload.materialType||'');setVal('intakeModel',activePayload.model||'');
    setVal('intakeSerial',activePayload.serial||'');setVal('intakeAccessories',activePayload.accessories||'');
    setVal('intakeFault',activePayload.fault||'');setVal('intakeCondition',activePayload.condition||'');
    setVal('intakeTerms',activePayload.terms||'Matériel confié pour diagnostic. Sauvegarde des données à la charge du client sauf accord écrit contraire.');
    calculateDocumentTotals();
    $('documentEditor').hidden=false;$('documentEditor').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){msg('Ouverture impossible : '+e.message)}
}
$('closeDocumentEditor').onclick=()=>{$('documentEditor').hidden=true;activeDocument=null};
$('saveDocument').onclick=async()=>{
  if(!activeDocument)return;
  const items=getDocumentItems();
  const payload={...activePayload,items,discount:Math.max(0,Number($('editDocDiscount').value)||0),notes:$('editDocNotes').value.trim()};
  if(activeDocument.type==='intake'){
    Object.assign(payload,{materialType:$('intakeMaterial').value.trim(),model:$('intakeModel').value.trim(),serial:$('intakeSerial').value.trim(),accessories:$('intakeAccessories').value.trim(),fault:$('intakeFault').value.trim(),condition:$('intakeCondition').value.trim(),terms:$('intakeTerms').value.trim()});
  }
  const patch={subject:$('editDocSubject').value.trim(),document_date:$('editDocDate').value||null,status:$('editDocStatus').value,validity:Math.max(0,Number($('editDocValidity').value)||0),due_date:$('editDocDueDate').value||null,payload,updated_at:new Date().toISOString()};
  try{
    const {error}=await db.from('management_documents').update(patch).eq('id',activeDocument.id);
    if(error)throw error;
    activeDocument={...activeDocument,...patch};activePayload=payload;
    await loadDocuments();msg(`Document ${activeDocument.number} enregistré dans Supabase.`);
  }catch(e){msg('Enregistrement impossible : '+e.message)}
};
function printDocument(){
  if(!activeDocument)return;
  const d=activeDocument,p=activePayload,c=customers.find(x=>x.id===d.customer_id)||{};
  const settings=(()=>({businessName:$('settingBusinessName').value||'So Info',email:$('settingEmail').value||'',legalStatus:$('settingLegalStatus').value||'',paymentTerms:$('settingPaymentTerms').value||''}))();
  const typeLabel={quote:'DEVIS',invoice:'FACTURE',intake:'BON DE PRISE EN CHARGE'}[d.type]||'DOCUMENT';
  const rows=(Array.isArray(p.items)?p.items:[]).map(i=>{
    const qty=Number(i.qty)||0,price=Number(i.price)||0,vat=Number(i.vat)||0;
    return `<tr><td>${esc(i.description||'')}</td><td class="num">${qty}</td><td class="num">${money(price)}</td><td class="num">${vat}%</td><td class="num">${money(qty*price)}</td></tr>`;
  }).join('');
  const ht0=(p.items||[]).reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0);
  const discount=Math.min(ht0,Math.max(0,Number(p.discount)||0));
  const ratio=ht0?discount/ht0:0;
  const vat=(p.items||[]).reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0)*(1-ratio)*(Number(i.vat)||0)/100,0);
  const ht=ht0-discount, ttc=ht+vat;
  const clientAddress=[c.address,c.postcode,c.city].filter(Boolean).join(', ');
  $('documentPrintArea').innerHTML=`<article class="print-sheet">
    <header class="print-head">
      <div class="print-brand-block"><div class="print-brand-mark">S</div><div><div class="print-brand">SO <span>INFO</span></div><div class="print-tagline">Services informatiques & dépannage</div></div></div>
      <div class="print-meta"><div class="print-kicker">DOCUMENT COMMERCIAL</div><h1>${typeLabel}</h1><div class="print-number">${esc(d.number)}</div><div class="print-meta-line">Date : ${esc(d.document_date||'')}</div>${d.due_date?`<div class="print-meta-line">Échéance : ${esc(d.due_date)}</div>`:''}${d.validity?`<div class="print-meta-line">Validité : ${esc(d.validity)} jours</div>`:''}</div>
    </header>
    <section class="print-parties">
      <div class="print-party"><div class="print-party-title">ÉMETTEUR</div><div class="print-party-name">${esc(settings.businessName)}</div><div>${esc(settings.legalStatus)}</div><div>${esc(settings.email)}</div></div>
      <div class="print-party"><div class="print-party-title">CLIENT</div><div class="print-party-name">${esc(c.first_name||'')} ${esc(c.last_name||'')}</div>${c.company?`<div>${esc(c.company)}</div>`:''}${clientAddress?`<div>${esc(clientAddress)}</div>`:''}${c.phone?`<div>${esc(c.phone)}</div>`:''}${c.email?`<div>${esc(c.email)}</div>`:''}</div>
    </section>
    <div class="print-subject"><span>OBJET</span><strong>${esc(d.subject||typeLabel)}</strong></div>
    <table class="print-table"><thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">Prix unitaire HT</th><th class="num">TVA</th><th class="num">Total HT</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Aucune ligne de prestation renseignée.</td></tr>'}</tbody></table>
    <div class="print-lower"><div class="print-watermark">S</div><div class="print-totals"><div><span>Total HT</span><strong>${money(ht0)}</strong></div><div><span>Remise</span><strong>− ${money(discount)}</strong></div><div><span>TVA</span><strong>${money(vat)}</strong></div><div class="strong"><span>Total TTC</span><strong>${money(ttc)}</strong></div></div></div>
    ${d.type==='intake'?`<section class="print-extra"><h3>MATÉRIEL CONFIÉ</h3><div class="print-extra-grid"><div><b>Type</b><span>${esc(p.materialType||'—')}</span></div><div><b>Modèle</b><span>${esc(p.model||'—')}</span></div><div><b>Numéro de série</b><span>${esc(p.serial||'—')}</span></div><div><b>Accessoires</b><span>${esc(p.accessories||'—')}</span></div><div><b>Panne signalée</b><span>${esc(p.fault||'—')}</span></div><div><b>État du matériel</b><span>${esc(p.condition||'—')}</span></div></div></section>`:''}
    ${p.notes?`<div class="print-note"><strong>NOTES</strong><p>${esc(p.notes)}</p></div>`:''}
    <div class="print-terms"><strong>CONDITIONS DE RÈGLEMENT</strong><p>${esc(p.terms||settings.paymentTerms)}</p></div>
    <footer class="print-foot"><div class="print-services"><span>Dépannage informatique</span><span>Maintenance & optimisation</span><span>Conseil & accompagnement</span></div><div class="print-foot-brand">SO INFO <i>—</i> ${esc(settings.legalStatus)} <span>${esc(settings.email)}</span></div></footer>
  </article>`;
  window.print();
}
$('printDocument').onclick=printDocument;

