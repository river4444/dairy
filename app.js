// app.js - ES module
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// ----- Firebase config (kept same as your original) -----
const firebaseConfig = {
    apiKey: "AIzaSyAquYjH9mhBtLvPbFfC_K1xizXNruORXng",
    authDomain: "dairy-2139f.firebaseapp.com",
    projectId: "dairy-2139f",
    storageBucket: "dairy-2139f.appspot.com",
    messagingSenderId: "50167451169",
    appId: "1:50167451169:web:5ea9cffde6db860ff7dd60"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ----- HABITS -----
// FIX: Added a specific `shortLabel` to each habit for clarity.
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
  dom.progressBar = $('progress-bar');
  dom.progressLabel = $('progress-label');
  dom.habitRibbon = $('habit-ribbon');
  dom.trackerStats = $('tracker-stats');
  dom.miniStats = $('mini-stats');
  dom.todaySummary = $('today-summary');

  dom.tabDaily = $('tab-daily'); dom.tabCalendar = $('tab-calendar'); dom.tabStats = $('tab-stats');
  dom.calendarPane = $('calendar-pane'); dom.calendarGrid = $('calendar-grid'); dom.monthYearLabel = $('month-year-label');
  dom.statsPane = $('stats-pane');
  dom.prevMonthBtn = $('prev-month-btn'); dom.nextMonthBtn = $('next-month-btn');
  dom.optionalSections = document.querySelectorAll('.optional');
  
  dom.mbDaily = $('mb-daily');
  dom.mbCalendar = $('mb-calendar');
  dom.mbStats = $('mb-stats');
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
    // FIX: Use the new `shortLabel` for the pill text.
    pill.title = h.text; // Keep the full text as a hover tooltip
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

// ---------- Calculate progress percentage ----------
function calculateProgress(entry) {
  let score = 0;
  const total = 5; // Total sections: Main Journal, Priorities, Gratitude, Food, Wins
  if(entry.content && entry.content.trim().length > 10) score++;
  if(Array.isArray(entry.priorities) && entry.priorities.some(p => p.trim())) score++;
  if(Array.isArray(entry.gratitude) && entry.gratitude.some(g => g.trim())) score++;
  if(entry.foodLog && entry.foodLog.trim()) score++;
  if(entry.deepWork && entry.deepWork.trim()) score++; 
  
  return Math.round((score / total) * 100);
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
  updateProgressUI(data || {});
  autosize(dom.journal);
}

function renderList(containerId, items = []) {
  const wrap = document.getElementById(containerId);
  if(!wrap) return;
  wrap.innerHTML = '';
  const count = Math.max(1, items.length > 0 ? items.length : 0);
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
    const entryData = gatherEntry(dateStr);
    saveLocalDraft(dateStr, entryData);
    try {
      await saveEntryToFirestore(dateStr, entryData);
      setSaved(true);
      updateProgressUI(entryData);
    } catch(err){
      console.error('save failed', err);
    }
  }, 900);
}

// ---------- Progress UI ----------
function updateProgressUI(entry = {}) {
  const pct = calculateProgress(entry);
  dom.progressBar.style.width = pct + '%';
  dom.progressLabel.textContent = `Today — ${pct}%`;
  const prioritiesCount = (entry.priorities || []).filter(Boolean).length;
  dom.todaySummary.textContent = `${pct}% complete • ${prioritiesCount} priorities`;
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
  dom.tabStats.classList.toggle('active', name==='stats');

  dom.calendarPane.classList.toggle('hidden', name!=='calendar');
  dom.statsPane.classList.toggle('hidden', name!=='stats');
  document.querySelector('#left-col').classList.toggle('hidden', name==='calendar' || name==='stats');

  if (dom.mbDaily) {
      dom.mbDaily.classList.toggle('active', name === 'daily');
      dom.mbCalendar.classList.toggle('active', name === 'calendar');
      dom.mbStats.classList.toggle('active', name === 'stats');
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
  $('expand-wins').addEventListener('click', ()=> toggleOptional('wins', true));
  $('expand-food').addEventListener('click', ()=> toggleOptional('food', true));
  $('expand-priorities').addEventListener('click', ()=> toggleOptional('priorities', true));
  $('expand-gratitude').addEventListener('click', ()=> toggleOptional('gratitude', true));
  $('add-priority').addEventListener('click', ()=> addListRow('priorities-list'));
  $('add-gratitude').addEventListener('click', ()=> addListRow('gratitude-list'));

  dom.tabDaily.addEventListener('click', ()=> showPane('daily'));
  dom.tabCalendar.addEventListener('click', ()=> { showPane('calendar'); renderCalendar(); });
  dom.tabStats.addEventListener('click', ()=> { showPane('stats'); updateMonthlyStatsFromUI(); });

  dom.prevMonthBtn.addEventListener('click', ()=> { currentCalendarDate.setMonth(currentCalendarDate.getMonth()-1); renderCalendar(); });
  dom.nextMonthBtn.addEventListener('click', ()=> { currentCalendarDate.setMonth(currentCalendarDate.getMonth()+1); renderCalendar(); });

  $('open-checklist').addEventListener('click', ()=> { showPane('calendar'); renderCalendar(); });
  $('today-button').addEventListener('click', ()=> { dom.dateInput.value = getTodayStr(); loadEntry(getTodayStr()); showPane('daily'); });
  
  $('view-calendar').addEventListener('click', () => { showPane('calendar'); renderCalendar(); });
  $('reset-habits').addEventListener('click', () => {
      if (confirm('Reset all habits for this day?')) {
          renderHabitRibbon({}); 
          triggerAutosave(); 
      }
  });

  dom.mbDaily.addEventListener('click', () => showPane('daily'));
  dom.mbCalendar.addEventListener('click', () => { showPane('calendar'); renderCalendar(); });
  dom.mbStats.addEventListener('click', () => { showPane('stats'); updateMonthlyStatsFromUI(); });

  setSaved(false);
  renderHabitRibbon({});
}

// ---------- Monthly stats summary (mini) ----------
async function updateMonthlyStatsFromUI() {
  const month = currentCalendarDate.getMonth();
  const year = currentCalendarDate.getFullYear();

  const daysInMonth = new Date(year, month+1, 0).getDate();
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

  const tracker = $('tracker-stats');
  const mini = $('mini-stats');
  if(tracker) tracker.innerHTML = '';
  if(mini) mini.innerHTML = '';

  HABITS.forEach(h => {
    const count = counts[h.id];
    const pct = Math.round((count / daysInMonth) * 100);
    if(tracker) tracker.innerHTML += `
      <div class="tracker-item">
        <div class="tracker-label" style="display:flex;justify-content:space-between">
          <span>${h.text}</span><span style="color:var(--muted)">${count}/${daysInMonth}</span>
        </div>
        <div class="tracker-bar-container">
          <div class="tracker-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent-2));padding-right:8px;color:#fff;font-weight:700;height:18px;border-radius:10px;display:flex;align-items:center;justify-content:flex-end">${pct}%</div>
        </div>
      </div>`;
    // FIX: Use the `shortLabel` in the mini stats for consistency.
    if(mini) mini.innerHTML += `<div class="stat-row"><div>${h.shortLabel}</div><div style="color:var(--muted)">${pct}%</div></div>`;
  });
}

// ---------- Theme toggle persistence ----------
function setupTheme() {
  const toggle = $('theme-toggle');
  const saved = localStorage.getItem('theme');
  if(saved === 'dark') {
    document.documentElement.setAttribute('data-theme','dark');
    toggle.checked = true;
  }
  toggle.addEventListener('change', ()=>{
    if(toggle.checked){ document.documentElement.setAttribute('data-theme','dark'); localStorage.setItem('theme','dark'); }
    else { document.documentElement.setAttribute('data-theme','light'); localStorage.setItem('theme','light'); }
  });
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', ()=>{
  bindUI();
  setupTheme();
});
