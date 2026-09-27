const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactLayout = window.matchMedia('(max-width: 680px)');
const header = document.querySelector('[data-header]');
const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
const mobileCall = document.querySelector('.mobile-call');
const intro = document.querySelector('.intro');
const introPhoto = document.querySelector('[data-parallax]');
const site = window.K3_SITE ?? {};

let scrollQueued = false;
function updateScrollEffects() {
  header?.classList.toggle('is-scrolled', window.scrollY > 18);
  mobileCall?.classList.toggle('is-visible', window.scrollY > 560);
  if (intro && introPhoto) {
    const rect = intro.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
    const travel = compactLayout.matches ? 18 : 34;
    const offset = reducedMotion.matches ? 0 : progress * travel;
    introPhoto.style.setProperty('--photo-shift', offset.toFixed(1) + 'px');
  }
  scrollQueued = false;
}
function queueScrollUpdate() {
  if (!scrollQueued) {
    scrollQueued = true;
    requestAnimationFrame(updateScrollEffects);
  }
}
updateScrollEffects();
window.addEventListener('scroll', queueScrollUpdate, { passive: true });
window.addEventListener('resize', queueScrollUpdate, { passive: true });
reducedMotion.addEventListener('change', queueScrollUpdate);

function setMenu(open, returnFocus = false) {
  toggle?.setAttribute('aria-expanded', String(open));
  toggle?.querySelector('.sr-only')?.replaceChildren(open ? 'Zatvori meni' : 'Otvori meni');
  nav?.classList.toggle('is-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  if (returnFocus) toggle?.focus();
}
toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') setMenu(false, true);
});
window.matchMedia('(min-width: 941px)').addEventListener('change', event => {
  if (event.matches) setMenu(false);
});

const navLinks = [...document.querySelectorAll('.main-nav a:not([data-products-nav])')];
if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => {
        const active = link.getAttribute('href') === '#' + entry.target.id;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-20% 0px -60%', threshold: 0 });
  document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));
}

// Only the photographs change; the copy and calls to action stay steady.
const carousel = document.querySelector('[data-carousel]');
const slides = [...document.querySelectorAll('.hero-media')];
const slideButtons = [...document.querySelectorAll('[data-slide]')];
const pauseButton = document.querySelector('[data-slide-pause]');
let currentSlide = 0;
let slideTimer;
let requestedSlide = 0;
let userPaused = reducedMotion.matches;
let carouselVisible = true;
let carouselFocused = false;
let carouselHovered = false;

function scheduleSlide() {
  clearTimeout(slideTimer);
  if (userPaused || document.hidden || !carouselVisible || carouselFocused || carouselHovered || slides.length < 2) return;
  slideTimer = setTimeout(() => showSlide((currentSlide + 1) % slides.length), 6000);
}
function updatePauseButton() {
  pauseButton?.setAttribute('aria-pressed', String(userPaused));
  pauseButton?.setAttribute('aria-label', userPaused ? 'Pokreni smenu fotografija' : 'Pauziraj smenu fotografija');
  const icon = pauseButton?.querySelector('[data-pause-icon]');
  if (icon) icon.textContent = userPaused ? '▷' : 'Ⅱ';
}
async function showSlide(index) {
  clearTimeout(slideTimer);
  const request = ++requestedSlide;
  const next = slides[index];
  if (!next) return;
  if (next.dataset.src) {
    next.src = next.dataset.src;
    delete next.dataset.src;
  }
  try { await next.decode(); } catch { scheduleSlide(); return; }
  if (request !== requestedSlide) return;
  slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
  slideButtons.forEach((button, i) => {
    button.classList.toggle('is-active', i === index);
    button.setAttribute('aria-pressed', String(i === index));
  });
  currentSlide = index;
  scheduleSlide();
}
slideButtons.forEach(button => button.addEventListener('click', () => showSlide(Number(button.dataset.slide))));
pauseButton?.addEventListener('click', () => {
  userPaused = !userPaused;
  updatePauseButton();
  scheduleSlide();
});
document.querySelector('.hero-controls')?.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { carouselHovered = true; scheduleSlide(); } });
document.querySelector('.hero-controls')?.addEventListener('pointerleave', () => { carouselHovered = false; scheduleSlide(); });
carousel?.addEventListener('focusin', () => { carouselFocused = true; scheduleSlide(); });
carousel?.addEventListener('focusout', event => { carouselFocused = carousel.contains(event.relatedTarget); scheduleSlide(); });
document.addEventListener('visibilitychange', scheduleSlide);
reducedMotion.addEventListener('change', () => { userPaused = reducedMotion.matches; updatePauseButton(); scheduleSlide(); });
if (carousel && 'IntersectionObserver' in window) {
  new IntersectionObserver(entries => { carouselVisible = entries[0].isIntersecting; scheduleSlide(); }, { threshold: .1 }).observe(carousel);
}
updatePauseButton();
scheduleSlide();

// Business numbers stay hidden until the owner supplies confirmed values.
const numberFormat = new Intl.NumberFormat('sr-Latn-RS');
document.querySelectorAll('[data-metric]').forEach(element => {
  const metric = site.metrics?.[element.dataset.metric];
  if (!metric || !Number.isFinite(metric.value) || metric.value < 0) return;
  const render = value => { element.textContent = numberFormat.format(value) + (metric.suffix ?? ''); };
  element.hidden = false;
  element.setAttribute('aria-label', metric.value + (metric.suffix ?? '') + ' ' + (metric.label ?? ''));
  if (metric.label) element.nextElementSibling.textContent = metric.label;
  render(metric.value);
  const animate = () => {
    if (reducedMotion.matches) return;
    const start = performance.now();
    const tick = now => {
      if (reducedMotion.matches) { render(metric.value); return; }
      const progress = Math.min(1, (now - start) / 1500);
      render(Math.round(metric.value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      animate();
    }, { threshold: .5 });
    observer.observe(element);
  }
});

// Set productsPage to '/proizvodi/' when that page is ready.
if (site.productsPage) {
  document.querySelectorAll('[data-products-nav]').forEach(link => { link.href = site.productsPage; });
  document.querySelectorAll('[data-product-category]').forEach(link => {
    link.href = site.productsPage + '#' + link.dataset.productCategory;
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.setAttribute('aria-label', link.querySelector('h3').textContent + ' — proizvodi');
  });
}

const form = document.querySelector('[data-inquiry-form]');
const formStatus = document.querySelector('[data-form-status]');
form?.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const body = 'Ime i prezime: ' + String(data.get('name')).trim() + '\nKontakt: ' + String(data.get('contact')).trim() + '\n\nProjekat:\n' + String(data.get('message')).trim();
  const href = 'mailto:milos.knezevic90@gmail.com?subject=' + encodeURIComponent('Upit za K3Welding') + '&body=' + encodeURIComponent(body);
  formStatus.textContent = 'Poruka je pripremljena za vašu email aplikaciju. Pošaljite je iz aplikacije; ako se ne otvori, pišite nam direktno na milos.knezevic90@gmail.com.';
  window.location.href = href;
});
document.querySelector('[data-year]').textContent = new Date().getFullYear();
