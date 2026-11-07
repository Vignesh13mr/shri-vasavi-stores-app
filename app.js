const SAMPLE = [
  { name:'Cake box · small', category:'Bakery supplies', price:12, quantity:30, icon:'📦' },
  { name:'Cake box · large', category:'Bakery supplies', price:25, quantity:18, icon:'🎂' },
  { name:'Sweet box · 250 g', category:'Bakery supplies', price:10, quantity:40, icon:'🎁' },
  { name:'Vanilla essence · bottle', category:'Bakery supplies', price:35, quantity:12, icon:'🧴' },
  { name:'Cake candles · pack', category:'Bakery supplies', price:20, quantity:15, icon:'🕯️' },
  { name:'Food colour · bottle', category:'Bakery supplies', price:28, quantity:9, icon:'🎨' },
  { name:'Tea powder · 250 g', category:'Tea and drink powders', price:120, quantity:10, icon:'🍵' },
  { name:'Milk powder · 200 g', category:'Tea and drink powders', price:145, quantity:7, icon:'🥛' },
  { name:'Horlicks · 500 g', category:'Tea and drink powders', price:245, quantity:5, icon:'🥤' },
  { name:'Boost · 500 g', category:'Tea and drink powders', price:235, quantity:4, icon:'🥤' },
  { name:'Toor dal · 1 kg', category:'Groceries', price:165, quantity:8, icon:'🫘' },
  { name:'Moong dal · 1 kg', category:'Groceries', price:145, quantity:6, icon:'🫘' },
  { name:'Chana dal · 1 kg', category:'Groceries', price:110, quantity:7, icon:'🫘' },
  { name:'Mango pickle · jar', category:'Groceries', price:95, quantity:5, icon:'🫙' },
  { name:'Tea cups · pack', category:'Kitchenware', price:50, quantity:12, icon:'🥤' },
  { name:'Drinking glasses · set', category:'Kitchenware', price:180, quantity:4, icon:'🥛' },
  { name:'Bath soap', category:'Personal care', price:35, quantity:7, icon:'🧼' },
  { name:'Toothpaste', category:'Personal care', price:55, quantity:5, icon:'🪥' },
  { name:'Dishwash liquid', category:'Household', price:80, quantity:3, icon:'🧴' },
  { name:'Potato chips', category:'Snacks', price:20, quantity:0, icon:'🥔' }
];
const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n)||0);
const safe = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconFor = category => ({'Bakery supplies':'📦','Tea and drink powders':'🍵',Groceries:'🫘',Kitchenware:'🥤','Personal care':'🧴',Household:'🧹',Snacks:'🍿'})[category]||'🛍️';
const cfg=window.SHOP_CONFIG||{};
const cloud=window.supabase&&cfg.supabaseUrl&&cfg.supabasePublishableKey?window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey):null;
let items=SAMPLE.map((p,i)=>({...p,id:`sample-${i}`}));
let active='All', currentUser=null, isOwner=false, cloudReady=false;
function draw(){
  const q=$('#search').value.trim().toLowerCase();
  const groups=['All',...new Set(items.map(x=>x.category).sort())]; if(!groups.includes(active))active='All';
  $('#filters').innerHTML=groups.map(g=>`<button class="filter ${g===active?'active':''}" data-filter="${safe(g)}">${safe(g)}</button>`).join('');
  const shown=items.filter(x=>(active==='All'||x.category===active)&&`${x.name} ${x.category}`.toLowerCase().includes(q));
  $('#item-count').textContent=`${shown.length} ${shown.length===1?'item':'items'}`; $('#empty').classList.toggle('hidden',shown.length>0);
  $('#products').innerHTML=shown.map(x=>{const badge=x.quantity<1?['Out of stock','out']:x.quantity<5?['Few left','low']:['In stock',''];return `<article class="card"><div class="photo"><span>${safe(x.icon||iconFor(x.category))}</span><span class="pill ${badge[1]}">${badge[0]}</span></div><div class="card-body"><h3>${safe(x.name)}</h3><p class="category">${safe(x.category)}</p><div class="price">${money(x.price)}</div></div></article>`}).join('');
  $('#manage-list').innerHTML=items.map(x=>`<div class="manage-row"><span>${safe(x.name)} · ${money(x.price)} · qty ${Number(x.quantity)}</span><span class="manage-actions"><button data-edit="${safe(x.id)}">Edit</button><button data-remove="${safe(x.id)}">Remove</button></span></div>`).join('')||'<p>No products yet. Add the real inventory below.</p>';
  $('#catalog-note').textContent=cloudReady?'Live catalog · prices and stock sync from the shop database.':cloud?'Connecting to the shop catalog…':'Demo catalog: sample prices and quantities are not current stock.';
}
async function loadCatalog(){
  if(!cloud)return;
  const {data,error}=await cloud.from('shop_products').select('id,name,category,price,quantity,updated_at').order('name');
  if(error)throw error;
  items=(data||[]).map(row=>({...row,icon:iconFor(row.category)}));cloudReady=true;draw();
}
async function checkOwner(){
  if(!cloud||!currentUser){isOwner=false;return;}
  const {data,error}=await cloud.from('shop_owners').select('user_id').eq('user_id',currentUser.id).maybeSingle();
  if(error)throw error;isOwner=Boolean(data);
}
function showManager(){
  $('#manager-login').classList.toggle('hidden',isOwner);
  $('#manager-form').classList.toggle('hidden',!isOwner);
  $('#manager').showModal();
}
$('#filters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(b){active=b.dataset.filter;draw()}});
$('#search').addEventListener('input',draw);
$('#owner-open').addEventListener('click',showManager);
$('#close-manager').addEventListener('click',()=>$('#manager').close());
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('#login-message');msg.textContent='Signing in…';
  if(!cloud){msg.textContent='Cloud connection is not configured.';return;}
  const {data,error}=await cloud.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
  if(error){msg.textContent=error.message;return;}currentUser=data.user;
  try{await checkOwner();if(!isOwner){await cloud.auth.signOut();currentUser=null;msg.textContent='This account is not approved as a shop manager.';return;}$('#manager-login').classList.add('hidden');$('#manager-form').classList.remove('hidden');await loadCatalog();}
  catch(err){msg.textContent=`Could not verify manager access: ${err.message}`;}
});
$('#manager-signout').addEventListener('click',async()=>{await cloud?.auth.signOut();currentUser=null;isOwner=false;$('#manager-form').classList.add('hidden');$('#manager-login').classList.remove('hidden')});
$('#manager-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!isOwner){alert('Sign in with an approved manager account first.');return;}
  const category=$('#category').value;
  const row={name:$('#name').value.trim(),category,price:Number($('#price').value),quantity:Number($('#quantity').value)};
  const id=$('#edit-id').value;
  const result=id?await cloud.from('shop_products').update(row).eq('id',id):await cloud.from('shop_products').insert(row);
  if(result.error){alert(`Could not save item: ${result.error.message}`);return;}
  e.target.reset();$('#edit-id').value='';$('#save-product').textContent='Add product';$('#cancel-edit').hidden=true;await loadCatalog();
});
$('#manage-list').addEventListener('click',async e=>{
  const edit=e.target.closest('[data-edit]');
  if(edit&&isOwner){const item=items.find(x=>String(x.id)===edit.dataset.edit);if(!item)return;$('#edit-id').value=item.id;$('#name').value=item.name;$('#category').value=item.category;$('#price').value=item.price;$('#quantity').value=item.quantity;$('#save-product').textContent='Save changes';$('#cancel-edit').hidden=false;return;}
  const b=e.target.closest('[data-remove]');if(!b||!isOwner)return;
  if(!confirm('Remove this product from the live catalog?'))return;
  const {error}=await cloud.from('shop_products').delete().eq('id',b.dataset.remove);if(error){alert(`Could not remove item: ${error.message}`);return;}await loadCatalog();
});
$('#cancel-edit').addEventListener('click',()=>{$('#manager-form').reset();$('#edit-id').value='';$('#save-product').textContent='Add product';$('#cancel-edit').hidden=true;});
$('#year').textContent=new Date().getFullYear();draw();
if(cloud){cloud.auth.getSession().then(async({data})=>{currentUser=data.session?.user||null;try{await checkOwner();await loadCatalog();if(isOwner)$('#owner-open').textContent='Store manager';}catch(err){$('#catalog-note').textContent=`Could not load the live catalog: ${err.message}`;}});cloud.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;checkOwner().then(()=>{if(!isOwner)$('#manager-form').classList.add('hidden')}).catch(()=>{});});cloud.channel('shop-products-live').on('postgres_changes',{event:'*',schema:'public',table:'shop_products'},()=>loadCatalog().catch(()=>{})).subscribe();}
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
