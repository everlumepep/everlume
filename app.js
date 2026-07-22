const products = [
  {name:'Tirzepatide',dose:'20mg',price:'$65',category:'weight',desc:'Weight-management research format.'},
  {name:'Tirzepatide',dose:'40mg',price:'$98',category:'weight',desc:'Higher-volume weight-management research format.'},
  {name:'Retatrutide',dose:'10mg',price:'$60',category:'weight',desc:'Metabolic research format.'},
  {name:'Retatrutide',dose:'20mg',price:'$90',category:'weight',desc:'Expanded metabolic research format.'},
  {name:'Klow Blend',dose:'Blend',price:'$115',category:'beauty',desc:'Curated beauty and skin-support research blend.'},
  {name:'GHK-Cu',dose:'50mg / 100mg',price:'$55 / $95',category:'beauty',desc:'Copper peptide research formats.'},
  {name:'NAD+',dose:'100mg',price:'$95',category:'beauty',desc:'Cellular-energy research format.'},
  {name:'Glutathione',dose:'1200mg',price:'$45',category:'beauty',desc:'Antioxidant research format.'},
  {name:'KPV',dose:'—',price:'$30',category:'recovery',desc:'Recovery and repair research format.'},
  {name:'BPC-157',dose:'—',price:'$40',category:'recovery',desc:'Recovery research format.'},
  {name:'TB-500',dose:'—',price:'$20',category:'recovery',desc:'Tissue research format.'},
  {name:'Semax',dose:'—',price:'$20',category:'recovery',desc:'Focus research format.'},
  {name:'NAD+',dose:'—',price:'$40',category:'energy',desc:'Energy research format.'},
  {name:'5-AM',dose:'—',price:'$50',category:'energy',desc:'Metabolic research format.'},
  {name:'MOTS-C',dose:'—',price:'$90',category:'energy',desc:'Mitochondrial research format.'},
  {name:'Tesamorelin',dose:'—',price:'$40',category:'energy',desc:'Metabolic research format.'}
];
const grid = document.getElementById('productGrid');
function renderProducts(filter='all'){
  grid.innerHTML = products.filter(p=>filter==='all'||p.category===filter).map(p=>`<article class="product-card reveal visible"><div class="product-visual"><div class="mini-vial"><span>EL</span><b>${p.name.toUpperCase()}</b><small>${p.dose}</small></div></div><div class="product-copy"><div class="dose">${p.dose}</div><h3>${p.name}</h3><p>${p.desc}</p><div class="product-bottom"><span class="price">${p.price}</span><button class="request-btn" data-product="${p.name} ${p.dose}">Request</button></div></div></article>`).join('');
  bindRequestButtons();
}
function bindRequestButtons(){document.querySelectorAll('.request-btn').forEach(btn=>btn.addEventListener('click',()=>{document.getElementById('productField').value=btn.dataset.product||'';document.getElementById('contact').scrollIntoView({behavior:'smooth'});}));}
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderProducts(btn.dataset.filter);}));
renderProducts();bindRequestButtons();
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav');menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',open)});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
document.getElementById('inquiryForm').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.currentTarget);const subject=encodeURIComponent(`Everlume research inquiry: ${data.get('product')||'General'}`);const body=encodeURIComponent(`Name: ${data.get('name')}\nEmail: ${data.get('email')}\nProduct: ${data.get('product')}\n\nMessage:\n${data.get('message')||''}\n\nI understand the products are for research use only.`);document.getElementById('formStatus').textContent='Your email application will open with the inquiry prepared.';window.location.href=`mailto:support@everlume.net?subject=${subject}&body=${body}`;});
document.getElementById('year').textContent=new Date().getFullYear();
