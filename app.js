// app.js - ES module
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// ----- Firebase config (kept same as your original) -----
const firebaseConfig = {
    apiKey: "AIzaSyAquYjH9mhBtLvPbFfC_K1xizXNruORXng",
    authDomain: "dairy-2139f.firebaseapp.com",
    projectId: "dairy-2139f",
    storageBucket: "dairy-2139f.appspot.com",
    messagingSenderId: "50166451169",
    appId: "1:50166451169:web:5ea9cffde6db860ff7dd60"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ----- HABITS -----
const HABITS = [
  { id: 'sunlight',         text: 'Got morning sunlight',        shortLabel: 'Sunlight' },
  { id: 'exercise',         text: 'Exercised 20+ min',          shortLabel: 'Exercise' },
  { id: 'mobility',         text: 'Stretching/mobility',         shortLabel: 'Mobility' },
  { id: 'sleepConsistency', text: 'Consistent sleep schedule',   shortLabel: 'Sleep' },
  { id: 'mindfulness',      text: '5+ min mindfulness',        shortLabel: 'Mindfulness' },
  { id: 'reading',          text: 'Read 15+ min',              shortLabel: 'Reading' },
  { id: 'skillDevelopment', text: 'Practiced a skill',           shortLabel: 'Practice' },
  { id: 'noPhoneMorning',   text: 'No phone first hour',       shortLabel: 'No Phone AM' },
  { id: 'deepWork',         text: '90-min deep work',          shortLabel: 'Deep Work' },
  { id: 'setPriorities',    text: 'Set priorities',              shortLabel: 'Priorities' },
  { id: 'dailyReview',      text: 'Daily review/shutdown',       shortLabel: 'Review' },
  { id: 'planNextDay',      text: 'Planned the next day',        shortLabel: 'Plan Day' },
  { id: 'gratitude',        text: 'Wrote 3 gratitudes',          shortLabel: 'Gratitude' },
  { id: 'tidyUp',           text: '10-min tidy-up',              shortLabel: 'Tidy Up' },
  { id: 'noPhoneBed',       text: 'No phone 1hr before bed',   shortLabel: 'No Phone PM' }
];

const diaryCollectionId = 'public-diary';
let debounceTimer;

// ---------- DOM ----------
const dom = {};
function $(id){ return document.getElementById(id); }

function initDom(){
  dom.dateInput = $('diary-date');
  dom.journal = $('main-journal');
  dom.saveIndicator = $('save-indicator');
  dom.habitRibbon = $('habit-ribbon');
  dom.trackerStats = $('tracker-stats');
  dom.miniStats = $('mini-stats');

  dom.tabDaily = $('tab-daily'); dom.tabCalendar = $('tab-calendar'); 
  dom.calendarPane = $('calendar-pane'); dom.calendarGrid = $('calendar-grid'); dom.monthYearLabel = $('month-year-label');
  // REMOVED: stats pane reference
  dom.prevMonthBtn = $('prev-month-btn'); dom.nextMonthBtn = $('next-month-btn');
  dom.optionalSections = document.querySelectorAll('.optional');
  
  dom.mbDaily = $('mb-daily');
  dom.mbCalendar = $('mb-calendar');
  // REMOVED: mobile stats reference
}

// ---------- Helpers ----------
const getTodayStr = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().split('T')[0];
};
const setSaved = (on=true) => {
  dom.saveIndicator.style.opacity = on ? '1' : '0';
  if(on) setTimeout(()=> dom.saveIndicator.style.opacity = '0', 1100);
};
const debounce = (fn, ms=1200) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, ms);
};

// ---------- Template (single textarea) ----------
const JOURNAL_TEMPLATE = `What I ate:
- Breakfast:
- Lunch:
- Dinner:

Top priorities:
1.
2.
3.

Wins / Deep work:
- 

Gratitude:
1.
2.
3.
`;

// ---------- Storage helpers ----------
const saveLocalDraft = (dateStr, data) => {
  try { localStorage.setItem(`draft_${dateStr}`, JSON.stringify(data)); } catch(e){}
};
const loadLocalDraft = (dateStr) => {
  try { const v = localStorage.getItem(`draft_${dateStr}`); return v ? JSON.parse(v) : null; } catch(e){ return null; }
};

// ---------- Render habits ribbon ----------
function renderHabitRibbon(habitStates = {}) {
  dom.habitRibbon.innerHTML = '';
  HABITS.forEach(h => {
    const pill = document.createElement('div');
    pill.className = 'habit-pill' + (habitStates[h.id] ? ' done' : '');
    pill.dataset.id = h.id;
    pill.title = h.text; 
    pill.innerHTML = `<span class="dot"></span><span class="label">${h.shortLabel}</span>`;
    pill.addEventListener('click', () => {
      const newState = !habitStates[h.id];
      habitStates[h.id] = newState;
      pill.classList.toggle('done', newState);
      triggerAutosave();
    });
    dom.habitRibbon.appendChild(pill);
  });
}

// ---------- Firebase helpers ----------
async function saveEntryToFirestore(dateStr, entryData) {
  const entryRef = doc(db, 'diaries', diaryCollectionId, 'entries', dateStr);
  await setDoc(entryRef, entryData);
}

async function loadEntryFromFirestore(dateStr) {
  try {
    const entryRef = doc(db, 'diaries', diaryCollectionId, 'entries', dateStr);
    const snap = await getDoc(entryRef);
    if(snap.exists()) return snap.data();
  } catch(err){ console.error(err); }
  return null;
}

function checkAutoHabits(entryData) {
    if (!entryData) return;
    entryData.habits = entryData.habits || {};

    const filledPriorities = (entryData.priorities || []).filter(p => p && p.trim() !== '').length;
    if (filledPriorities >= 3) {
        entryData.habits.setPriorities = true;
    }

    const filledGratitudes = (entryData.gratitude || []).filter(g => g && g.trim() !== '').length;
    if (filledGratitudes >= 3) {
        entryData.habits.gratitude = true;
    }
}

// ---------- UI loading/saving ----------
async function loadEntry(dateStr) {
  if(!dateStr) return;
  dom.journal.value = 'Loading...';
  const cloud = await loadEntryFromFirestore(dateStr);
  const local = loadLocalDraft(dateStr);
  const data = cloud || local || null;

  if(data) {
    dom.journal.value = data.content || JOURNAL_TEMPLATE;
    renderList('priorities-list', data.priorities || []);
    renderList('gratitude-list', data.gratitude || []);
    
    checkAutoHabits(data); 
    renderHabitRibbon(data.habits || {});

    if ($('deep-work-log')) $('deep-work-log').value = data.deepWork || '';
    if ($('food-log-entry')) $('food-log-entry').value = data.foodLog || '';
  } else {
    dom.journal.value = JOURNAL_TEMPLATE;
    renderList('priorities-list', []);
    renderList('gratitude-list', []);
    renderHabitRibbon({});
    if ($('deep-work-log')) $('deep-work-log').value = '';
    if ($('food-log-entry')) $('food-log-entry').value = '';
  }
  autosize(dom.journal);
}

function renderList(containerId, items = []) {
  const wrap = document.getElementById(containerId);
  if(!wrap) return;
  wrap.innerHTML = '';
  const count = Math.max(3, items.length);
  for(let i=0;i<count;i++){
    const v = items[i] || '';
    const txt = document.createElement('textarea');
    txt.className = 'small-input';
    txt.rows = 1;
    txt.value = v;
    txt.addEventListener('input', () => {
        autosize(txt);
        triggerAutosave();
    });
    wrap.appendChild(txt);
    autosize(txt); 
  }
}

function gatherEntry() {
  const priorities = Array.from(document.querySelectorAll('#priorities-list textarea')).map(t => t.value);
  const gratitude = Array.from(document.querySelectorAll('#gratitude-list textarea')).map(t => t.value);
  const habits = {};
  document.querySelectorAll('.habit-pill').forEach(p => {
    habits[p.dataset.id] = p.classList.contains('done');
  });

  return {
    content: dom.journal.value,
    foodLog: $('food-log-entry') ? $('food-log-entry').value : '',
    deepWork: $('deep-work-log') ? $('deep-work-log').value : '',
    priorities,
    gratitude,
    habits
  };
}

// ---------- Autosave ----------
function triggerAutosave(){
  setSaved(false);
  debounce(async () => {
    const dateStr = dom.dateInput.value;
    const entryData = gatherEntry();
    
    checkAutoHabits(entryData); 
    
    saveLocalDraft(dateStr, entryData);
    try {
      await saveEntryToFirestore(dateStr, entryData);
      setSaved(true);
      renderHabitRibbon(entryData.habits); 
    } catch(err){
      console.error('save failed', err);
    }
  }, 900);
}

// ---------- Autosize helper ----------
function autosize(el){ if(!el) return; el.style.height='auto'; el.style.height = el.scrollHeight + 'px'; }

// ---------- Calendar rendering ----------
let currentCalendarDate = new Date();
function renderCalendar() {
  dom.calendarGrid.innerHTML = '';
  const todayStr = getTodayStr();
  currentCalendarDate.setDate(1);
  const month = currentCalendarDate.getMonth();
  const year = currentCalendarDate.getFullYear();
  dom.monthYearLabel.textContent = `${currentCalendarDate.toLocaleString('default',{month:'long'})} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1,0).getDate();

  for(let i=0;i<firstDay;i++){ const el = document.createElement('div'); el.className='calendar-day not-current-month'; dom.calendarGrid.appendChild(el); }
  
  const dayElements = [];
  for(let d=1; d<=daysInMonth; d++){
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      if (`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` === todayStr) {
          dayDiv.classList.add('today');
      }
      dayDiv.textContent = d;
      dom.calendarGrid.appendChild(dayDiv);
      dayElements.push(dayDiv);
  }

  const promises = [];
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    promises.push(loadEntryFromFirestore(dateStr).then(data => ({dateStr, data, d})));
  }
  
  Promise.all(promises).then(arr => {
    arr.forEach(obj => {
      const dayDiv = dayElements[obj.d - 1]; 
      if(obj.data && obj.data.habits){
        const doneCount = Object.values(obj.data.habits).filter(Boolean).length;
        const pct = Math.round((doneCount / HABITS.length) * 100);
        dayDiv.style.background = `linear-gradient(to top, var(--accent) ${pct}%, var(--level-0) ${pct}%)`;
        if(pct > 50) dayDiv.style.color = '#fff';
      }
      dayDiv.addEventListener('click', ()=> {
        dom.dateInput.value = obj.dateStr;
        loadEntry(obj.dateStr);
        showPane('daily');
      });
    });
  });
}

// ---------- Small UI helpers ----------
function toggleOptional(key, show) {
  const opt = Array.from(dom.optionalSections).find(o => o.dataset.key === key);
  if(!opt) return;
  const body = opt.querySelector('.optional-body');
  const toggle = opt.querySelector('.optional-toggle');
  const isHidden = body.classList.contains('hidden');
  if(show === undefined) show = isHidden;
  body.classList.toggle('hidden', !show);
  toggle.querySelector('.chev').textContent = show ? '▴' : '▾';
  if (show) {
      body.querySelectorAll('textarea').forEach(autosize);
  }
}

function addListRow(containerId, value='') {
  const wrap = document.getElementById(containerId);
  const txt = document.createElement('textarea');
  txt.className = 'small-input';
  txt.rows = 1; txt.value = value;
  txt.addEventListener('input', () => {
      autosize(txt);
      triggerAutosave();
  });
  wrap.appendChild(txt);
  txt.focus();
}

// ---------- Top tabs + panes ----------
function showPane(name) {
  dom.tabDaily.classList.toggle('active', name==='daily');
  dom.tabCalendar.classList.toggle('active', name==='calendar');
  // REMOVED: stats logic

  dom.calendarPane.classList.toggle('hidden', name!=='calendar');
  document.querySelector('#left-col').classList.toggle('hidden', name==='calendar');

  if (dom.mbDaily) {
      dom.mbDaily.classList.toggle('active', name === 'daily');
      dom.mbCalendar.classList.toggle('active', name === 'calendar');
      // REMOVED: mobile stats logic
  }
}

// ---------- initialization ----------
function bindUI() {
  initDom();

  const urlParams = new URLSearchParams(window.location.search);
  if(urlParams.get('master') !== 'true') {
    document.querySelector('#access-denied-message').classList.remove('hidden');
    document.querySelector('#app-root').classList.add('hidden');
    return;
  }

  dom.dateInput.value = getTodayStr();
  loadEntry(dom.dateInput.value);

  dom.dateInput.addEventListener('change', ()=>loadEntry(dom.dateInput.value));
  dom.journal.addEventListener('input', ()=>{ autosize(dom.journal); triggerAutosave(); });
  
  document.querySelectorAll('.optional-toggle').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const key = btn.closest('.optional').dataset.key;
      toggleOptional(key);
    });
  });
  document.querySelectorAll('.small-input').forEach(el => {
      el.addEventListener('input', triggerAutosave);
  });
  
  $('add-priority').addEventListener('click', ()=> addListRow('priorities-list'));
  $('add-gratitude').addEventListener('click', ()=> addListRow('gratitude-list'));

  dom.tabDaily.addEventListener('click', ()=> showPane('daily'));
  dom.tabCalendar.addEventListener('click', ()=> { showPane('calendar'); renderCalendar(); });
  // REMOVED: stats tab listener

  dom.prevMonthBtn.addEventListener('click', ()=> { currentCalendarDate.setMonth(currentCalendarDate.getMonth()-1); renderCalendar(); });
  dom.nextMonthBtn.addEventListener('click', ()=> { currentCalendarDate.setMonth(currentCalendarDate.getMonth()+1); renderCalendar(); });

  dom.mbDaily.addEventListener('click', () => showPane('daily'));
  dom.mbCalendar.addEventListener('click', () => { showPane('calendar'); renderCalendar(); });
  // REMOVED: mobile stats listener

  setSaved(false);
  renderHabitRibbon({});
  updateMonthlyStatsFromUI(); 
}

// ---------- Monthly stats summary (mini) ----------
async function updateMonthlyStatsFromUI() {
  const month = currentCalendarDate.getMonth();
  const year = currentCalendarDate.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const today = new Date();
  let daysSoFar;
  if (year === today.getFullYear() && month === today.getMonth()) {
    daysSoFar = today.getDate();
  } else {
    daysSoFar = daysInMonth;
  }
  if (daysSoFar === 0) daysSoFar = 1;

  const counts = {}; HABITS.forEach(h => counts[h.id] = 0);

  const promises = [];
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    promises.push(loadEntryFromFirestore(dateStr).then(data=> ({dateStr, data})));
  }
  const results = await Promise.all(promises);
  results.forEach(r => {
    if(r.data && r.data.habits){
      HABITS.forEach(h => { if(r.data.habits[h.id]) counts[h.id]++; });
    }
  });

  const mini = $('mini-stats');
  if(mini) mini.innerHTML = '';

  HABITS.forEach(h => {
    const count = counts[h.id];
    if(mini) mini.innerHTML += `<div class="stat-row"><div>${h.shortLabel}</div><div style="color:var(--muted)">${count}/${daysSoFar}</div></div>`;
  });
}

// ---------- Theme toggle persistence ----------
// FIX: Rewritten to work with a button instead of a checkbox.
function setupTheme() {
  const toggle = $('theme-toggle');
  
  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      toggle.textContent = '☀️';
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      toggle.textContent = '🌙';
    }
  };

  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);

  toggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  });
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', ()=>{
  bindUI();
  setupTheme();
});
