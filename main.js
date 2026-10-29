import { initGlobe } from './globe.js?v=6';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const CATS = {
  biz: { name: 'Business systems', color: '#2B45D4' },
  ai: { name: 'AI and automation', color: '#FFB000' },
  msg: { name: 'Messaging and payments', color: '#9FC4F5' },
  mob: { name: 'Mobile', color: '#0E1A5C' },
  web: { name: 'Web and data', color: '#E9EEF8' },
};

const PROJECTS = [
  { cat: 'biz', name: 'Invostax Pro', what: 'Trading ERP, from first enquiry to balance sheet.',
    body: 'Enquiry, quote, sales order, purchase, receiving, delivery, invoice and ledger on one record, so nothing is delivered without being billed. About 100 reports, post-dated cheques, credit notes with a second approver, and each company walled off from the others. Accounting syncs to Odoo through a queue that retries on failure.',
    facts: ['1,179 commits', '270,000+ records', 'Live in production'] },
  { cat: 'biz', name: 'Invostax GMS', what: 'Garage management with photo approvals.',
    body: 'Replaces paper job cards. The mechanic photographs the worn part and the customer approves with one tap on their phone. Live bay map, labour timers, parts that flow onto the bill, and monthly fleet statements.',
    facts: ['Multi-branch', 'Lite edition'] },
  { cat: 'biz', name: 'Invostax CarWash', what: 'Bays, jobs and bilingual invoices for car washes.',
    body: 'A live board of every bay, a job for each car, invoices in English and Arabic, and a daily report for each washer.',
    facts: ['React, Express, PostgreSQL', '38 backend tests'] },
  { cat: 'biz', name: 'Books Doctor', what: 'A nightly check-up for Odoo books.',
    body: 'Every night it explains, in plain words, the gaps between stock and the ledger: goods received but never billed, and items unreconciled for too long. Works on Odoo 19 and 20.',
    facts: ['Odoo app', '$149'], img: 'img/books-doctor.webp' },
  { cat: 'biz', name: 'Invostax Lite', what: 'Invoicing that chases late payers for you.',
    body: 'Professional invoices in a few minutes, and a polite automatic reminder when a payment is late.', facts: [] },
  { cat: 'ai', name: 'Invostax Converter', what: 'Photos and handwriting into clean spreadsheets.',
    body: 'Reads handwritten pages, screenshots, scanned PDFs and raw chat text. Two recognition engines read every page; wherever they disagree, the cell is shown next to a crop of the original so a person confirms only the risky digits.',
    facts: ['Two OCR engines', 'Desktop app', 'Licence keys'] },
  { cat: 'ai', name: 'Marketing agent', what: 'Writes, renders and posts short product videos.',
    body: 'An AI pipeline that scripts a video, voices it, renders it, sends it to a phone for one-tap approval, then posts it. A second loop finds likely customers and drafts the first message.',
    facts: ['Python', 'Gemini TTS', 'Remotion'] },
  { cat: 'ai', name: 'Odoo AI gateway', what: 'Lets AI agents work inside Odoo safely.',
    body: 'An Odoo add-on plus an MCP connector, so an AI agent can read and act on business data through a controlled door.',
    facts: ['MCP', 'Odoo add-on'] },
  { cat: 'ai', name: 'Job scout', what: 'Finds jobs, scores the fit, drafts the application.',
    body: 'Searches job boards daily, scores each listing against a CV, and drafts a tailored summary and cover letter for the strong matches.',
    facts: ['Python', 'Local dashboard'] },
  { cat: 'ai', name: 'Market agents', what: 'Trading strategies competing in a simulation.',
    body: 'Automated agents that trade in a simulated stock market, where only the steadiest profits are rewarded. A lab for risk, timing and strategy.',
    facts: ['8 strategies', 'Experiment'] },
  { cat: 'msg', name: 'ChatDesk', what: 'Shared WhatsApp inbox that chases payment.',
    body: 'One number, the whole team answering from it, invoices sent from inside the chat, and reminders that go out on their own. Self-hosted, so the data stays with the owner.',
    facts: ['Laravel 13', '139 tests', '$59'], img: 'img/chatdesk.webp', href: 'https://waqasrafiq.github.io/chatdesk/' },
  { cat: 'mob', name: 'Invoice Maker', what: 'Offline invoicing. No account needed.',
    body: 'Its spec came from reading 1,094 store reviews of competing apps and fixing every common complaint. Works fully offline, with free export and backup.',
    facts: ['Android', 'SQLite', '220 tests'] },
  { cat: 'mob', name: "Bit's Brain", what: 'Teaches kids aged 5 to 10 how AI works.',
    body: 'Lessons, mini-games and a friendly robot called Bit explain what AI is and how to use it safely, with levels, streaks and gems to keep them coming back.',
    facts: ['Android', 'Kids 5-10'], img: 'img/bits-brain.webp' },
  { cat: 'web', name: 'Invostax Tools', what: 'Free everyday tools that run in the browser.',
    body: 'QR codes, image compression, password generator, JSON to CSV, text compare, unit converter and a quick invoice. Nothing is uploaded anywhere.', facts: ['10 tools'] },
  { cat: 'web', name: 'Business websites', what: 'Fast bilingual sites for local businesses.',
    body: 'Mobile-first sites with booking on WhatsApp, built to load fast on a phone and read well in English and Arabic.',
    facts: ['Bilingual', 'Mobile-first'], img: 'img/salon.webp', href: 'https://waqasrafiq.github.io/demos/' },
  { cat: 'web', name: 'Smart Analyzer', what: 'Spots what slipped across monthly trackers.',
    body: 'Reads a stack of monthly spreadsheets and produces one report: which sites went live, which went backwards, and which disappeared.',
    facts: ['Excel VBA'] },
].map(p => ({ ...p, color: CATS[p.cat].color }));

// ---- project index ---------------------------------------------------------
const index = document.querySelector('.index');
Object.entries(CATS).forEach(([key, c]) => {
  const g = document.createElement('div');
  g.className = 'group';
  g.innerHTML = `<h3><i style="background:${c.color}"></i>${c.name}</h3><ul></ul>`;
  PROJECTS.forEach((p, k) => {
    if (p.cat !== key) return;
    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><span class="n">${p.name}</span><span class="w">${p.what}</span></button>`;
    li.querySelector('button').addEventListener('click', e => open(k, e.currentTarget));
    g.querySelector('ul').appendChild(li);
  });
  index.appendChild(g);
});

// ---- panel -----------------------------------------------------------------
const panel = document.getElementById('panel');
const $ = s => panel.querySelector(s);
let globe = null, returnFocus = null;
const narrow = () => innerWidth < 760;

function open(k, from) {
  const p = PROJECTS[k];
  returnFocus = from || null;
  $('.cat').textContent = CATS[p.cat].name;
  $('h3').textContent = p.name;
  $('.what').textContent = p.what;
  $('.body').textContent = p.body;
  $('.facts').innerHTML = p.facts.map(f => `<li>${f}</li>`).join('');
  const img = $('img'); img.hidden = !p.img; if (p.img) { img.src = p.img; img.alt = `Screenshot of ${p.name}`; }
  const a = $('.go a'); a.hidden = !p.href; if (p.href) { a.href = p.href; a.textContent = `Visit ${p.name}`; }
  panel.style.setProperty('--c', p.color);
  panel.hidden = false;
  document.body.classList.add('panel-open');
  requestAnimationFrame(() => panel.classList.add('on'));
  // the pulled plate floats beside the panel (above it on phones)
  globe?.open(k, narrow() ? [0, 1.6, 0.8] : [-1.5, 0.1, 0.6]);
  $('.close').focus();
}
function close() {
  panel.classList.remove('on');
  document.body.classList.remove('panel-open');
  setTimeout(() => { panel.hidden = true; }, 350);
  globe?.close();
  returnFocus?.focus();
}
$('.close').addEventListener('click', close);
addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });

// ---- headline letters stretch towards the pointer --------------------------
document.querySelectorAll('.stretch').forEach(h => {
  const parts = h.querySelectorAll('.ln');
  (parts.length ? parts : [h]).forEach(el => {
    el.innerHTML = [...el.textContent].map(ch => ch === ' ' ? ' ' : `<span aria-hidden="true">${ch}</span>`).join('');
  });
});
const letters = [...document.querySelectorAll('.stretch span[aria-hidden]')];
if (!reduced) {
  let px = -1e4, py = -1e4, raf = 0;
  addEventListener('pointermove', e => {
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      letters.forEach(s => {
        const r = s.getBoundingClientRect();
        if (r.bottom < -100 || r.top > innerHeight + 100) return;
        const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
        const f = Math.max(0, 1 - d / 320);
        s.style.fontVariationSettings = `"wdth" ${60 + f * 90}, "wght" ${720 + f * 180}`;
      });
    });
  }, { passive: true });
}

// header turns solid once the night hero has scrolled away
new IntersectionObserver(([e]) => document.body.classList.toggle('past-hero', !e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' })
  .observe(document.querySelector('.hero'));

// ---- globe -----------------------------------------------------------------
try {
  globe = initGlobe(document.querySelector('.gl'), PROJECTS, { reduced, cats: CATS, onOpen: k => open(k) });
  document.querySelector('.gl').classList.add('ready');
  // scrolling away pulls the globe apart; scrolling back reassembles it
  addEventListener('scroll', () => globe.setExplode(Math.min(scrollY / innerHeight, 1)), { passive: true });
} catch { document.querySelector('.gl').remove(); } // no WebGL: the index below still has everything
