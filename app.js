import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAquYjH9mhBtLvPbFfC_K1xizXNruORXng",
    authDomain: "dairy-2139f.firebaseapp.com",
    projectId: "dairy-2139f",
    storageBucket: "dairy-2139f.appspot.com",
    messagingSenderId: "50167451169",
    appId: "1:50167451169:web:5ea9cffde6db860ff7dd60"
};

// MODIFIED: Reorganized and expanded the habits list for better flow
const HABITS = [
    // --- Health & Body ---
    { id: 'sunlight', text: 'Got morning sunlight' },
    { id: 'exercise', text: 'Exercised for 20+ minutes' },
    { id: 'mobility', text: '5+ minutes of stretching/mobility' },
    { id: 'sleepConsistency', text: 'Consistent Wake-up/Bedtime (±30m)' },
    // --- Mind & Growth ---
    { id: 'mindfulness', text: '5+ Minutes of Mindfulness' },
    { id: 'reading', text: 'Read for 15+ minutes' },
    { id: 'skillDevelopment', text: 'Practiced a skill for 20+ minutes' },
    { id: 'noPhoneMorning', text: 'No Phone for the First Hour' },
    // --- Productivity & Planning ---
    { id: 'deepWork', text: 'Completed one 90-min Deep Work session' },
    { id: 'setPriorities', text: 'Set Top 1-3 Priorities' },
    { id: 'dailyReview', text: 'Completed a daily review/shutdown' },
    { id: 'planNextDay', text: 'Planned the next day' },
    // --- Evening Routine ---
    { id: 'gratitude', text: 'Wrote 3 Gratitude Items' },
    { id: 'tidyUp', text: '10-Minute Evening Tidy-Up' },
    { id: 'noPhoneBed', text: 'No phone 1 hour before bed' }
];
const diaryCollectionId = 'public-diary';
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const main = () => {
    // --- MASTER VIEW CHECK ---
    const appContainer = document.getElementById('app-container');
    const calendarContainer = document.getElementById('calendar-container');
    const accessDeniedMessage = document.getElementById('access-denied-message');
    const viewSwitcher = document.getElementById('view-switcher');

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('master') !== 'true') return;
    viewSwitcher.classList.remove('hidden');
    accessDeniedMessage.classList.add('hidden');
    
    // --- DOM ELEMENTS ---
    const dateInput = document.getElementById('diary-date');
    const entryTextarea = document.getElementById('diary-entry');
    const foodLogTextarea = document.getElementById('food-log-entry');
    const deepWorkTextarea = document.getElementById('deep-work-log'); // NEW
    const skillPracticeTextarea = document.getElementById('skill-practice-log'); // NEW
    const checklistContainer = document.getElementById('checklist-container');
    const themeToggle = document.getElementById('theme-toggle');
    const trackerStatsContainer = document.getElementById('tracker-stats');
    const monthlyStatsMonthLabel = document.getElementById('monthly-stats-month-label');
    const priorityInputs = document.querySelectorAll('#priority-1, #priority-2, #priority-3');
    const gratitudeInputs = document.querySelectorAll('#gratitude-1, #gratitude-2, #gratitude-3');
    const dailyViewBtn = document.getElementById('daily-view-btn');
    const calendarViewBtn = document.getElementById('calendar-view-btn');
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearLabel = document.getElementById('month-year-label');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    // --- STATE ---
    let currentCalendarDate = new Date();
    let debounceTimeout;

    // --- VIEW SWITCHING LOGIC ---
    const switchToDailyView = () => {
        appContainer.classList.remove('hidden');
        calendarContainer.classList.add('hidden');
        dailyViewBtn.classList.add('active');
        calendarViewBtn.classList.remove('active');
    };
    const switchToCalendarView = () => {
        appContainer.classList.add('hidden');
        calendarContainer.classList.remove('hidden');
        dailyViewBtn.classList.remove('active');
        calendarViewBtn.classList.add('active');
        renderCalendar();
    };

    // --- CALENDAR LOGIC ---
    const renderCalendar = async () => {
        calendarGrid.innerHTML = 'Loading...';
        currentCalendarDate.setDate(1);
        const month = currentCalendarDate.getMonth();
        const year = currentCalendarDate.getFullYear();

        monthYearLabel.textContent = `${currentCalendarDate.toLocaleString('default', { month: 'long' })} ${year}`;
        
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthData = await fetchMonthData(year, month);
        calendarGrid.innerHTML = '';

        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarGrid.innerHTML += `<div class="calendar-day not-current-month"></div>`;
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('calendar-day');
            dayDiv.textContent = i;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            if (monthData[dateStr]) {
                const entry = monthData[dateStr];
                const habitsDone = HABITS.filter(h => entry.habits && entry.habits[h.id]).length;
                const completion = HABITS.length > 0 ? habitsDone / HABITS.length : 0;
                const completionPercent = completion * 100;
                dayDiv.style.background = `linear-gradient(to top, var(--accent-color) ${completionPercent}%, var(--level-0) ${completionPercent}%)`;
                if (completion > 0.5) {
                    dayDiv.style.color = 'white';
                }
            }

            dayDiv.addEventListener('click', () => {
                dateInput.value = dateStr;
                switchToDailyView();
                loadEntryForDate(dateStr);
            });
            calendarGrid.appendChild(dayDiv);
        }
    };

    const fetchMonthData = async (year, month) => {
        const promises = [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            promises.push(getDoc(doc(db, 'diaries', diaryCollectionId, 'entries', dateStr)));
        }
        const snapshots = await Promise.all(promises);
        const data = {};
        snapshots.forEach(docSnap => {
            if (docSnap.exists()) data[docSnap.id] = docSnap.data();
        });
        return data;
    };

    const triggerAutosave = () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => saveEntry(), 1500);
    };

    const saveEntry = async () => {
        const dateStr = dateInput.value;
        const habitsToSave = {};
        HABITS.forEach(habit => {
            const checkbox = document.getElementById(`habit-${habit.id}`);
            if (checkbox) habitsToSave[habit.id] = checkbox.checked;
        });

        const entryData = {
            content: entryTextarea.value,
            foodLog: foodLogTextarea.value,
            deepWork: deepWorkTextarea.value, // NEW
            skillPractice: skillPracticeTextarea.value, // NEW
            habits: habitsToSave,
            priorities: Array.from(priorityInputs).map(input => input.value),
            gratitude: Array.from(gratitudeInputs).map(input => input.value)
        };
        
        const entryRef = doc(db, 'diaries', diaryCollectionId, 'entries', dateStr);
        try {
            await setDoc(entryRef, entryData);
            console.log(`Autosaved for ${dateStr}`);
            const [year, month] = dateStr.split('-').map(Number);
            updateMonthlyStats(year, month - 1);
        } catch (error) {
            console.error("Error autosaving entry: ", error);
        }
    };

    const loadEntryForDate = async (dateStr) => {
        if (!dateStr) return;
        // Clear all fields
        entryTextarea.value = 'Loading...';
        foodLogTextarea.value = '';
        deepWorkTextarea.value = ''; // NEW
        skillPracticeTextarea.value = ''; // NEW
        priorityInputs.forEach(input => input.value = '');
        gratitudeInputs.forEach(input => input.value = '');

        const entryRef = doc(db, 'diaries', diaryCollectionId, 'entries', dateStr);
        try {
            const docSnap = await getDoc(entryRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                entryTextarea.value = data.content || '';
                foodLogTextarea.value = data.foodLog || '';
                deepWorkTextarea.value = data.deepWork || ''; // NEW
                skillPracticeTextarea.value = data.skillPractice || ''; // NEW
                const habitsData = data.habits || {};
                HABITS.forEach(habit => {
                    const checkbox = document.getElementById(`habit-${habit.id}`);
                    if (checkbox) checkbox.checked = habitsData[habit.id] || false;
                });
                const prioritiesData = data.priorities || [];
                priorityInputs.forEach((input, index) => input.value = prioritiesData[index] || '');
                const gratitudeData = data.gratitude || [];
                gratitudeInputs.forEach((input, index) => input.value = gratitudeData[index] || '');
            } else {
                // If no data, ensure fields are empty
                entryTextarea.value = '';
                HABITS.forEach(habit => {
                    const checkbox = document.getElementById(`habit-${habit.id}`);
                    if (checkbox) checkbox.checked = false;
                });
            }
        } catch (error) {
            console.error("Error loading entry:", error);
        } finally {
            document.querySelectorAll('textarea').forEach(textarea => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            });
            const [year, month] = dateStr.split('-').map(Number);
            updateMonthlyStats(year, month - 1);
        }
    };

    const renderChecklist = () => {
        checklistContainer.innerHTML = '';
        HABITS.forEach(habit => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'habit-item';
            itemDiv.innerHTML = `<label><input type="checkbox" id="habit-${habit.id}" class="autosave-trigger"><span>${habit.text}</span></label>`;
            checklistContainer.appendChild(itemDiv);
        });
        document.querySelectorAll('.autosave-trigger').forEach(el => el.addEventListener('change', triggerAutosave));
    };
    
    const getTodaysDate = () => {
        const today = new Date();
        const offset = today.getTimezoneOffset();
        return new Date(today.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
    };

    const updateMonthlyStats = async (year, month) => {
        trackerStatsContainer.innerHTML = 'Calculating...';
        const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
        monthlyStatsMonthLabel.textContent = monthName;

        const habitCounts = {};
        HABITS.forEach(h => habitCounts[h.id] = 0);

        const monthData = await fetchMonthData(year, month);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (const dateStr in monthData) {
            const entry = monthData[dateStr];
            if (entry.habits) {
                HABITS.forEach(habit => {
                    if (entry.habits[habit.id]) {
                        habitCounts[habit.id]++;
                    }
                });
            }
        }
        
        trackerStatsContainer.innerHTML = '';
        HABITS.forEach(habit => {
            const count = habitCounts[habit.id];
            const percentage = Math.round((count / daysInMonth) * 100);
            trackerStatsContainer.innerHTML += `
                <div class="tracker-item">
                    <div class="tracker-label">
                        <span>${habit.text}</span>
                        <span>${count}/${daysInMonth} days</span>
                    </div>
                    <div class="tracker-bar-container">
                        <div class="tracker-bar" style="width: ${percentage}%;">
                            ${percentage}%
                        </div>
                    </div>
                </div>`;
        });
    };

    const setupThemeToggle = () => {
        const currentTheme = localStorage.getItem('theme');
        if (currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.checked = true;
        }
        themeToggle.addEventListener('change', () => {
            if (themeToggle.checked) {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            }
        });
    };

    const setupCollapsibles = () => {
        const headers = document.querySelectorAll('.collapsible-header');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('active');
                const content = header.nextElementSibling;
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                } else {
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            });
        });
    };
    
    const setupAutoResizeTextareas = () => {
        document.querySelectorAll('textarea').forEach(textarea => {
            const resize = () => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            };
            textarea.addEventListener('input', resize);
            setTimeout(resize, 0); 
        });
    };
    
    // --- INITIALIZE THE APP ---
    switchToDailyView();
    dateInput.value = getTodaysDate();
    renderChecklist();
    setupThemeToggle();
    setupCollapsibles();
    setupAutoResizeTextareas();
    loadEntryForDate(dateInput.value);
    
    // --- Event Listeners ---
    dailyViewBtn.addEventListener('click', switchToDailyView);
    calendarViewBtn.addEventListener('click', switchToCalendarView);
    prevMonthBtn.addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); });
    nextMonthBtn.addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); });
    dateInput.addEventListener('change', () => loadEntryForDate(dateInput.value));
    entryTextarea.addEventListener('input', triggerAutosave);
    foodLogTextarea.addEventListener('input', triggerAutosave);
    deepWorkTextarea.addEventListener('input', triggerAutosave); // NEW
    skillPracticeTextarea.addEventListener('input', triggerAutosave); // NEW
    priorityInputs.forEach(input => input.addEventListener('input', triggerAutosave));
    gratitudeInputs.forEach(input => input.addEventListener('input', triggerAutosave));
};

document.addEventListener('DOMContentLoaded', main);
