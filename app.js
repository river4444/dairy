// app.js - ES module
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// ... (Firebase config, HABITS, etc. all stay the same) ...
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

const dom = {};
function $(id){ return document.getElementById(id); }

function initDom(){
  dom.dateInput = $('diary-date');
  dom.journal = $('main-journal');
  dom.saveIndicator = $('save-indicator');
  dom.habitRibbon = $('habit-ribbon');
  dom.miniStats = $('mini-stats');
  dom.tabDaily = $('tab-daily'); 
  dom.tabCalendar = $('tab-calendar'); 
  dom.calendarPane = $('calendar-pane'); 
  dom.calendarGrid = $('calendar-grid'); 
  dom.monthYearLabel = $('month-year-label');
  dom.prevMonthBtn = $('prev-month-btn'); 
  dom.nextMonthBtn = $('next-month-btn');
  dom.habitTrackerContainer = $('habit-tracker-container');
  dom.optionalSections = document.querySelectorAll('.optional');
  dom.mbDaily = $('mb-daily');
  dom.mbCalendar = $('mb-calendar');
}

// ... (All other JS functions like getTodayStr, renderHabitRibbon, loadEntry, etc. remain the same) ...

const getTodayStr = () => new Date(new Date().getTime() - new Date().getTimezoneOffset()*60000).toISOString().split('T')[0];
const setSaved = (on=true) => {
  dom.saveIndicator.style.opacity = on ? '1' : '0';
  if(on) setTimeout(()=> dom.saveIndicator.style.opacity = '0', 1100);
};
const debounce = (fn, ms=1200) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, ms);
};
const JOURNAL_TEMPLATE = `What I ate:\n- Breakfast:\n- Lunch:\n- Dinner:\n\nTop priorities:\n1.\n2.\n3.\n\nWins / Deep work:\n- \n\nGratitude:\n1.\n2.\n3.\n`;
const saveLocalDraft = (dateStr, data) => { try { localStorage.setItem(`draft_${dateStr}`, JSON.stringify(data)); } catch(e){} };
const loadLocalDraft = (dateStr) => { try { const v = localStorage.getItem(`draft_${dateStr}`); return v ? JSON.parse(v) : null; } catch(e){ return null; } };

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
async function saveEntryToFirestore(dateStr, entryData) { await setDoc(doc(db, 'diaries', diaryCollectionId, 'entries', dateStr), entryData, { merge: true }); }
async function loadEntryFromFirestore(dateStr) { try { const snap = await getDoc(doc(db, 'diaries', diaryCollectionId, 'entries', dateStr)); if(snap.exists()) return snap.data(); } catch(err){ console.error(err); } return null; }
function checkAutoHabits(entryData) {
    if (!entryData) return;
    entryData.habits = entryData.habits || {};
    const filledPriorities = (entryData.priorities || []).filter(p => p && p.trim() !== '').length;
    if (filledPriorities >= 3) { entryData.habits.setPriorities = true; }
    const filledGratitudes = (entryData.gratitude || []).filter(g => g && g.trim() !== '').length;
    if (filledGratitudes >= 3) { entryData.habits.gratitude = true; }
}
async function loadEntry(dateStr) {
  if(!dateStr) return;
  dom.journal.value = 'Loading...';
  const data = await loadEntryFromFirestore(dateStr) || loadLocalDraft(dateStr) || null;
  if(data) {
    dom.journal.value = data.content || JOURNAL_TEMPLATE;
    renderList('priorities-list', data.priorities || []);
    renderList('gratitude-list', data.gratitude || []);
    checkAutoHabits(data); 
    renderHabitRibbon(data.habits || {});
    const deepWorkEl = $('deep-work-log'), foodLogEl = $('food-log-entry');
    if (deepWorkEl) { deepWorkEl.value = data.deepWork || ''; autosize(deepWorkEl); }
    if (foodLogEl) { foodLogEl.value = data.foodLog || ''; autosize(foodLogEl); }
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
  for(let i=0;i<Math.max(3, items.length);i++){
    const txt = document.createElement('textarea');
    txt.className = 'small-input'; txt.rows = 1; txt.value = items[i] || '';
    txt.addEventListener('input', () => { autosize(txt); triggerAutosave(); });
    wrap.appendChild(txt);
    autosize(txt); 
  }
}
function gatherEntry() {
  const habits = {}; document.querySelectorAll('.habit-pill').forEach(p => { habits[p.dataset.id] = p.classList.contains('done'); });
  return {
    content: dom.journal.value,
    foodLog: $('food-log-entry')?.value || '',
    deepWork: $('deep-work-log')?.value || '',
    priorities: Array.from(document.querySelectorAll('#priorities-list textarea')).map(t => t.value),
    gratitude: Array.from(document.querySelectorAll('#gratitude-list textarea')).map(t => t.value),
    habits
  };
}
function triggerAutosave(){
  setSaved(false);
  debounce(async () => {
    const dateStr = dom.dateInput.value, entryData = gatherEntry();
    checkAutoHabits(entryData); 
    saveLocalDraft(dateStr, entryData);
    try {
      await saveEntryToFirestore(dateStr, entryData);
      setSaved(true);
      renderHabitRibbon(entryData.habits); 
    } catch(err){ console.error('save failed', err); }
  }, 900);
}
function autosize(el){ if(!el) return; el.style.height='auto'; el.style.height = el.scrollHeight + 'px'; }
async function handleHabitGridChange(e) {
    if (e.target.type !== 'checkbox') return;
    const { date: dateStr, habitId } = e.target.dataset;
    e.target.disabled = true;
    try {
        let entryData = await loadEntryFromFirestore(dateStr) || { habits: {} };
        if (!entryData.habits) entryData.habits = {};
        entryData.habits[habitId] = e.target.checked;
        await saveEntryToFirestore(dateStr, { habits: entryData.habits });
    } catch (err) {
        console.error("Failed to update habit from grid:", err);
        e.target.checked = !e.target.checked;
        alert("Failed to save habit.");
    } finally { e.target.disabled = false; }
}
function renderHabitTrackerGrid(year, month, monthlyData = {}) {
    dom.habitTrackerContainer.innerHTML = '';
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = document.createElement('div');
    grid.className = 'habit-tracker-grid';
    grid.style.gridTemplateColumns = `120px repeat(${daysInMonth}, minmax(35px, 1fr))`;
    grid.appendChild(document.createElement('div'));
    for (let d = 1; d <= daysInMonth; d++) {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'habit-header'; dayHeader.textContent = d;
        grid.appendChild(dayHeader);
    }
    HABITS.forEach(habit => {
        const habitLabel = document.createElement('div');
        habitLabel.className = 'habit-label'; habitLabel.textContent = habit.shortLabel; habitLabel.title = habit.text;
        grid.appendChild(habitLabel);
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const cell = document.createElement('div');
            cell.className = 'habit-checkbox-cell';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = monthlyData[dateStr]?.habits?.[habit.id] || false;
            checkbox.dataset.date = dateStr; checkbox.dataset.habitId = habit.id;
            cell.appendChild(checkbox);
            grid.appendChild(cell);
        }
    });
    grid.addEventListener('change', handleHabitGridChange);
    dom.habitTrackerContainer.appendChild(grid);
}
let currentCalendarDate = new Date();
function renderCalendar() {
  dom.calendarGrid.innerHTML = '';
  dom.habitTrackerContainer.innerHTML = 'Loading stats...';
  const todayStr = getTodayStr();
  currentCalendarDate.setDate(1);
  const month = currentCalendarDate.getMonth(), year = currentCalendarDate.getFullYear();
  dom.monthYearLabel.textContent = `${currentCalendarDate.toLocaleString('default',{month:'long'})} ${year}`;
  const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month+1,0).getDate();
  for(let i=0;i<firstDay;i++){ const el = document.createElement('div'); el.className='calendar-day not-current-month'; dom.calendarGrid.appendChild(el); }
  const dayElements = [];
  for(let d=1; d<=daysInMonth; d++){
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      if (`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` === todayStr) { dayDiv.classList.add('today'); }
      dayDiv.textContent = d;
      dom.calendarGrid.appendChild(dayDiv);
      dayElements.push(dayDiv);
  }
  const promises = [];
  for(let d=1; d<=daysInMonth; d++){ const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; promises.push(loadEntryFromFirestore(dateStr).then(data => ({dateStr, data, d}))); }
  Promise.all(promises).then(arr => {
    const monthlyData = {};
    arr.forEach(obj => {
      if (obj.data) { monthlyData[obj.dateStr] = obj.data; }
      const dayDiv = dayElements[obj.d - 1]; 
      if(obj.data?.habits){
        const doneCount = Object.values(obj.data.habits).filter(Boolean).length;
        const pct = Math.round((doneCount / HABITS.length) * 100);
        dayDiv.style.background = `linear-gradient(to top, var(--accent) ${pct}%, var(--level-0) ${pct}%)`;
        if(pct > 50) dayDiv.style.color = '#000';
      }
      dayDiv.addEventListener('click', ()=> { dom.dateInput.value = obj.dateStr; loadEntry(obj.dateStr); showPane('daily'); });
    });
    renderHabitTrackerGrid(year, month, monthlyData);
  });
}
function toggleOptional(key, show) {
  const opt = Array.from(document.querySelectorAll('.optional')).find(o => o.dataset.key === key);
  if(!opt) return;
  const body = opt.querySelector('.optional-body');
  const isHidden = body.classList.contains('hidden');
  if(show === undefined) show = isHidden;
  body.classList.toggle('hidden', !show);
  if (show) { body.querySelectorAll('textarea').forEach(autosize); }
}
function addListRow(containerId, value='') {
  const wrap = document.getElementById(containerId);
  const txt = document.createElement('textarea');
  txt.className = 'small-input'; txt.rows = 1; txt.value = value;
  txt.addEventListener('input', () => { autosize(txt); triggerAutosave(); });
  wrap.appendChild(txt); txt.focus();
}
function showPane(name) {
  dom.tabDaily.classList.toggle('active', name==='daily');
  dom.tabCalendar.classList.toggle('active', name==='calendar');
  dom.calendarPane.classList.toggle('hidden', name!=='calendar');
  document.querySelector('#left-col').classList.toggle('hidden', name==='calendar');
  if (dom.mbDaily) {
      dom.mbDaily.classList.toggle('active', name === 'daily');
      dom.mbCalendar.classList.toggle('active', name === 'calendar');
  }
   if (name !== 'calendar' && dom.habitTrackerContainer) { dom.habitTrackerContainer.innerHTML = ''; }
}

function initializeAppLogic() {
  initDom();
  dom.dateInput.value = getTodayStr();
  loadEntry(dom.dateInput.value);
  dom.dateInput.addEventListener('change', ()=>loadEntry(dom.dateInput.value));
  dom.journal.addEventListener('input', ()=>{ autosize(dom.journal); triggerAutosave(); });
  document.querySelectorAll('.optional-toggle').forEach(btn=>{ btn.addEventListener('click', e=>{ const key = btn.closest('.optional').dataset.key; toggleOptional(key); }); });
  document.querySelectorAll('.small-input').forEach(el => { el.addEventListener('input', () => { autosize(el); triggerAutosave(); }); autosize(el); });
  $('add-priority').addEventListener('click', ()=> addListRow('priorities-list'));
  $('add-gratitude').addEventListener('click', ()=> addListRow('gratitude-list'));
  dom.tabDaily.addEventListener('click', ()=> showPane('daily'));
  dom.tabCalendar.addEventListener('click', ()=> { showPane('calendar'); renderCalendar(); });
  dom.prevMonthBtn.addEventListener('click', ()=> { currentCalendarDate.setMonth(currentCalendarDate.getMonth()-1); renderCalendar(); });
  dom.nextMonthBtn.addEventListener('click', ()=> { currentCalendarDate.setMonth(currentCalendarDate.getMonth()+1); renderCalendar(); });
  dom.mbDaily.addEventListener('click', () => showPane('daily'));
  dom.mbCalendar.addEventListener('click', () => { showPane('calendar'); renderCalendar(); });
  setSaved(false);
  renderHabitRibbon({});
  updateMonthlyStatsFromUI(); 
  // setupTheme() call is removed
}

async function updateMonthlyStatsFromUI() {
  const month = currentCalendarDate.getMonth(), year = currentCalendarDate.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  let daysSoFar = (year === today.getFullYear() && month === today.getMonth()) ? today.getDate() : daysInMonth;
  if (daysSoFar === 0) daysSoFar = 1;
  const counts = {}; HABITS.forEach(h => counts[h.id] = 0);
  const promises = [];
  for(let d=1; d<=daysInMonth; d++){ const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; promises.push(loadEntryFromFirestore(dateStr).then(data=> ({data}))); }
  const results = await Promise.all(promises);
  results.forEach(r => { if(r.data?.habits){ HABITS.forEach(h => { if(r.data.habits[h.id]) counts[h.id]++; }); } });
  const mini = $('mini-stats');
  if(mini) mini.innerHTML = '';
  HABITS.forEach(h => { if(mini) mini.innerHTML += `<div class="stat-row"><div>${h.shortLabel}</div><div style="color:var(--muted)">${count}/${daysSoFar}</div></div>`; });
}

// THEME TOGGLE FUNCTION IS ENTIRELY REMOVED
// function setupTheme() { ... }

document.addEventListener('DOMContentLoaded', ()=>{
    const loginOverlay = $('login-overlay'), loginBox = $('login-box'), passwordInput = $('password-input'), loginButton = $('login-button'), appRoot = $('app-root'), siteHeader = document.querySelector('.site-header');
    const attemptLogin = () => {
        if (passwordInput.value === 'Swag2') {
            loginOverlay.style.display = 'none';
            appRoot.classList.remove('hidden');
            siteHeader.classList.remove('hidden');
            initializeAppLogic();
        } else {
            loginBox.classList.add('error-shake');
            passwordInput.value = '';
            setTimeout(() => { loginBox.classList.remove('error-shake'); }, 500);
        }
    };
    loginButton.addEventListener('click', attemptLogin);
    passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { attemptLogin(); } });
    siteHeader.classList.add('hidden');
});
