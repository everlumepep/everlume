const products = [
  {name:'Tirzepatide',dose:'20mg',category:'weight',desc:'Material format for controlled metabolic-pathway research.'},
  {name:'Tirzepatide',dose:'40mg',category:'weight',desc:'Alternate-quantity format for laboratory investigation.'},
  {name:'Retatrutide',dose:'10mg',category:'weight',desc:'Material format for metabolic-pathway research.'},
  {name:'Retatrutide',dose:'20mg',category:'weight',desc:'Alternate-quantity format for laboratory investigation.'},
  {name:'Klow Blend',dose:'Blend',category:'beauty',desc:'Multi-component peptide research format.'},
  {name:'GHK-Cu',dose:'50mg / 100mg',category:'beauty',desc:'Copper-peptide research formats.'},
  {name:'NAD+',dose:'100mg',category:'beauty',desc:'Material format for cellular-pathway investigation.'},
  {name:'Glutathione',dose:'1200mg',category:'beauty',desc:'Material format for biochemical research.'},
  {name:'KPV',dose:'—',category:'recovery',desc:'Material format for laboratory tissue-pathway research.'},
  {name:'BPC-157',dose:'—',category:'recovery',desc:'Material format for laboratory tissue-pathway research.'},
  {name:'TB-500',dose:'—',category:'recovery',desc:'Material format for laboratory tissue-pathway research.'},
  {name:'Semax',dose:'—',category:'recovery',desc:'Material format for controlled peptide research.'},
  {name:'NAD+',dose:'—',category:'energy',desc:'Material format for cellular-pathway investigation.'},
  {name:'5-AM',dose:'—',category:'energy',desc:'Material format for metabolic-pathway investigation.'},
  {name:'MOTS-C',dose:'—',category:'energy',desc:'Material format for mitochondrial-pathway research.'},
  {name:'Tesamorelin',dose:'—',category:'energy',desc:'Material format for controlled peptide research.'}
];
const grid = document.getElementById('productGrid');
function renderProducts(filter='all'){
  grid.innerHTML = products.filter(p=>filter==='all'||p.category===filter).map(p=>`<article class="product-card reveal visible"><div class="product-visual"><div class="mini-vial"><span>EL</span><b>${p.name.toUpperCase()}</b><small>${p.dose}</small></div></div><div class="product-copy"><div class="dose">${p.dose}</div><h3>${p.name}</h3><p>${p.desc}</p><div class="product-bottom"><span class="quote-label">Documentation available</span><button class="request-btn" data-product="${p.name} ${p.dose}">Inquire</button></div></div></article>`).join('');
  bindRequestButtons();
}
function bindRequestButtons(){document.querySelectorAll('.request-btn').forEach(btn=>btn.addEventListener('click',()=>{document.getElementById('productField').value=btn.dataset.product||'';document.getElementById('contact').scrollIntoView({behavior:'smooth'});}));}
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderProducts(btn.dataset.filter);}));
renderProducts();
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav');
function setMenu(open){nav.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');}
menu.addEventListener('click',()=>setMenu(!nav.classList.contains('open')));
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){setMenu(false);menu.focus();}});
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if('IntersectionObserver'in window&&!reducedMotion){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));}else{document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));}
document.getElementById('inquiryForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const status=document.getElementById('formStatus');const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Submitting…';status.textContent='';try{const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form)).toString()});if(!response.ok)throw new Error('Submission failed');form.reset();status.textContent='Thank you. Your research inquiry has been received.';}catch(error){status.textContent='We could not submit your inquiry. Please try again shortly.';}finally{button.disabled=false;button.textContent='Submit inquiry';}});
document.getElementById('year').textContent=new Date().getFullYear();
