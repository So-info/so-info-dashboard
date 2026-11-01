'use strict';
const SUPABASE_URL='https://vmenybnuyiwtxazstydk.supabase.co';
const SUPABASE_KEY='sb_publishable_c2fj1vnsKwhxVY2IHI0RuA_J_jefH6G';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);let customers=[],selectedCard=null,busy=false;
function msg(t){$('appMessage').textContent=t}function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function admin(){const {data:{user},error}=await db.auth.getUser();if(error||!user)return null;const {data,error:e}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(e)throw e;if(!data){await db.auth.signOut();throw Error('Ce compte ne figure pas dans les administrateurs autorisés.')}return user}
function show(logged){$('login').hidden=logged;$('dashboard').hidden=!logged;$('logout').hidden=!logged}
async function load(){const {data,error}=await db.from('customers').select('id,first_name,last_name,phone,email,company,address,postcode,city,notes,loyalty_cards(id,points,reward_unlocked)').order('last_name');if(error)throw error;customers=data||[];renderClients();fillLoyalty();fillDocumentCustomers()}
function cardOf(c){return Array.isArray(c?.loyalty_cards)?c.loyalty_cards[0]:c?.loyalty_cards}
function renderClients(){const q=$('clientSearch').value.toLocaleLowerCase('fr').trim();const rows=customers.filter(c=>`${c.first_name} ${c.last_name} ${c.phone||''} ${c.email||''} ${c.company||''}`.toLocaleLowerCase('fr').includes(q));$('clientList').innerHTML=rows.map(c=>`<div class="client-row"><div><strong>${esc(c.first_name)} ${esc(c.last_name)}</strong><small>${esc(c.phone||c.email||c.company||'Coordonnées non renseignées')}</small></div><button data-edit="${c.id}">Ouvrir</button></div>`).join('')||'<p class="muted">Aucun client trouvé.</p>';document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editClient(b.dataset.edit))}
function fillLoyalty(){const sel=$('loyaltyClient'),old=sel.value;sel.innerHTML='<option value="">Sélectionner un client</option>'+customers.filter(c=>cardOf(c)).map(c=>`<option value="${c.id}">${esc(c.first_name)} ${esc(c.last_name)}</option>`).join('');if(customers.some(c=>c.id===old&&cardOf(c)))sel.value=old}
function fillDocumentCustomers(){const sel=$('docCustomer'),old=sel.value;sel.innerHTML='<option value="">Sélectionner un client</option>'+customers.map(c=>`<option value="${c.id}">${esc(c.first_name)} ${esc(c.last_name)}</option>`).join('');if(customers.some(c=>c.id===old))sel.value=old}
function editClient(id){const c=customers.find(x=>x.id===id);$('clientEditor').hidden=false;$('editorTitle').textContent=c?'Modifier la fiche client':'Nouveau client';$('clientId').value=c?.id||'';for(const k of ['firstName','lastName','company','phone','clientEmail','address','postcode','city','notes'])$(k).value=c?.[{firstName:'first_name',lastName:'last_name',clientEmail:'email'}[k]||k]||'';renderClientLoyalty(c);$('clientEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function renderClientLoyalty(c){const box=$('clientLoyaltyBlock');if(!c){box.hidden=true;return}const card=cardOf(c);if(!card){box.hidden=false;box.innerHTML='<div class="client-loyalty-empty"><strong>Carte de fidélité indisponible</strong><p class="muted small">Aucune carte n’est associée à ce client.</p></div>';return}box.hidden=false;const n=Math.max(0,Math.min(10,Number(card.points)||0));$('clientLoyaltyPoints').textContent=n;$('clientLoyaltyStatus').textContent=n>=10?'Récompense disponible !':`Encore ${10-n} passage${10-n>1?'s':''} avant le cadeau`;$('clientStampGrid').innerHTML=Array.from({length:10},(_,i)=>`<span class="client-stamp ${i<n?'is-done':''}">${i<n?'★':'·'}</span>`).join('');$('clientRewardNotice').hidden=n<10;$('clientAddStamp').disabled=n>=10;$('clientRedeem').disabled=n!==10;$('clientAddStamp').onclick=()=>clientStampAction(c.id,'stamp');$('clientRedeem').onclick=()=>clientStampAction(c.id,'redeem');$('clientOpenLoyalty').onclick=()=>{switchView('loyalty');$('loyaltyClient').value=c.id;drawLoyalty(c.id);$('loyaltyClient').scrollIntoView({behavior:'smooth',block:'center'})}}
async function clientStampAction(customerId,action){const c=customers.find(x=>x.id===customerId),card=cardOf(c);if(!card)return;if(action==='redeem'&&!confirm('Confirmer la remise du cadeau et remettre la carte à zéro ?'))return;const button=action==='stamp'?'clientAddStamp':'clientRedeem';$(button).disabled=true;try{const {error}=await db.rpc(action==='stamp'?'add_stamp':'redeem_reward',{p_card_id:card.id});if(error)throw error;await load();editClient(customerId);msg(action==='stamp'?'Tampon ajouté à la carte du client.':'Cadeau remis. Carte remise à zéro.')}catch(e){$(button).disabled=false;msg('Erreur fidélité : '+e.message)}}
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
  const d=activeDocument,p=activePayload||{},c=customers.find(x=>x.id===d.customer_id)||{};
  const settings={businessName:$('settingBusinessName').value||'So Info',email:$('settingEmail').value||'',legalStatus:$('settingLegalStatus').value||'Micro-entreprise',paymentTerms:$('settingPaymentTerms').value||''};
  const isIntake=d.type==='intake';
  const typeLabel={quote:'DEVIS',invoice:'FACTURE',intake:'PRISE EN CHARGE'}[d.type]||'DOCUMENT';
  const items=Array.isArray(p.items)?p.items:[];
  const rows=items.filter(i=>String(i.description||'').trim()||Number(i.price)||Number(i.qty)>1).map(i=>{
    const qty=Number(i.qty)||0,price=Number(i.price)||0,vatRate=Number(i.vat)||0;
    return `<tr><td>${esc(i.description||'Prestation')}</td><td class="num">${qty}</td><td class="num">${money(price)}</td><td class="num">${vatRate}%</td><td class="num">${money(qty*price)}</td></tr>`;
  }).join('');
  const ht0=items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0);
  const discount=Math.min(ht0,Math.max(0,Number(p.discount)||0)),ratio=ht0?discount/ht0:0;
  const vat=items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0)*(1-ratio)*(Number(i.vat)||0)/100,0);
  const address=[c.address,c.postcode,c.city].filter(Boolean).join(', ');
  const intakeBlock=isIntake?`<section class="p-panel p-equipment"><div class="p-label">MATÉRIEL CONFIÉ</div><div class="p-fields">
    <div><small>Type de matériel</small><b>${esc(p.materialType||'À renseigner')}</b></div><div><small>Marque / modèle</small><b>${esc(p.model||'À renseigner')}</b></div>
    <div><small>Numéro de série</small><b>${esc(p.serial||'À renseigner')}</b></div><div><small>Accessoires remis</small><b>${esc(p.accessories||'Aucun indiqué')}</b></div>
    <div class="wide"><small>Panne signalée</small><b>${esc(p.fault||'Non renseignée')}</b></div>
    <div class="wide"><small>État / observations à la réception</small><b>${esc(p.condition||'Non renseigné')}</b></div>
  </div></section>
  <section class="p-panel p-terms"><div class="p-label">CONDITIONS DE PRISE EN CHARGE</div><p>${esc(p.terms||'Matériel confié pour diagnostic. Sauvegarde des données à la charge du client sauf accord écrit contraire.')}</p></section>
  <section class="p-signatures"><div><b>Signature du client</b><small>Précédée de la mention « Lu et approuvé »</small></div><div><b>Réception par SO INFO</b><small>Date et signature</small></div></section>`:'';
  const commercialBlock=!isIntake?`<table class="p-table"><thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">Prix HT</th><th class="num">TVA</th><th class="num">Total HT</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Aucune prestation renseignée.</td></tr>'}</tbody></table>
  <div class="p-total-wrap"><div class="p-total"><div><span>Total HT</span><b>${money(ht0)}</b></div>${discount?`<div><span>Remise</span><b>− ${money(discount)}</b></div>`:''}<div><span>TVA</span><b>${money(vat)}</b></div><div class="p-grand"><span>Total TTC</span><b>${money(ht0-discount+vat)}</b></div></div></div>
  ${p.notes?`<section class="p-panel p-note"><div class="p-label">NOTES</div><p>${esc(p.notes)}</p></section>`:''}
  <section class="p-panel p-terms"><div class="p-label">${d.type==='invoice'?'CONDITIONS DE RÈGLEMENT':'VALIDITÉ & CONDITIONS'}</div><p>${esc(p.terms||settings.paymentTerms||'À régler selon les conditions convenues.')}</p></section>`:'';
  $('documentPrintArea').innerHTML=`<article class="print-sheet ${isIntake?'is-intake':'is-commercial'}">
    <header class="p-header"><div class="p-brand"><span class="p-logo">S</span><div><div class="p-brand-name">SO <em>INFO</em></div><small>Services informatiques & dépannage</small></div></div>
    <div class="p-doc-meta"><small>DOCUMENT ${isIntake?'ATELIER':'COMMERCIAL'}</small><h1>${typeLabel}</h1><strong class="p-number">${esc(d.number)}</strong><span>Date : ${esc(d.document_date||'')}</span>${d.due_date?`<span>Échéance : ${esc(d.due_date)}</span>`:''}${d.type==='quote'&&d.validity?`<span>Valable ${esc(d.validity)} jours</span>`:''}</div></header>
    <section class="p-parties"><div class="p-panel"><div class="p-label">ÉMETTEUR</div><b>${esc(settings.businessName)}</b><span>${esc(settings.legalStatus)}</span><span>${esc(settings.email)}</span></div>
    <div class="p-panel"><div class="p-label">CLIENT</div><b>${esc(`${c.first_name||''} ${c.last_name||''}`.trim()||'Client')}</b>${c.company?`<span>${esc(c.company)}</span>`:''}${address?`<span>${esc(address)}</span>`:''}${c.phone?`<span>${esc(c.phone)}</span>`:''}${c.email?`<span>${esc(c.email)}</span>`:''}</div></section>
    <div class="p-subject"><small>OBJET</small><b>${esc(d.subject||typeLabel)}</b></div>
    ${commercialBlock}${intakeBlock}
    <footer class="p-footer"><div>DÉPANNAGE INFORMATIQUE <i>•</i> MAINTENANCE & OPTIMISATION <i>•</i> CONSEIL</div><b>SO INFO <em>—</em> ${esc(settings.legalStatus)}</b><small>${esc(settings.email)}</small></footer>
  </article>`;
  window.print();
}
$('printDocument').onclick=printDocument;

