import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = { /* ... your config ... */ };
const HABITS = [ /* ... your habits ... */ ];
const diaryCollectionId = 'public-diary';
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const main = () => {
    const appContainer = document.getElementById('app-container');
    const calendarContainer = document.getElementById('calendar-container');
    const accessDeniedMessage = document.getElementById('access-denied-message');

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('master') !== 'true') return;

    appContainer.classList.remove('hidden');
    accessDeniedMessage.classList.add('hidden');
    
    // --- DOM Elements ---
    const dateInput = document.getElementById('diary-date');
    // ... (other daily view elements) ...
    const dailyViewBtn = document.getElementById('daily-view-btn');
    const calendarViewBtn = document.getElementById('calendar-view-btn');
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearLabel = document.getElementById('month-year-label');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    // --- STATE ---
    let currentCalendarDate = new Date();

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
        currentCalendarDate.setDate(1); // Start from the 1st of the month
        const month = currentCalendarDate.getMonth();
        const year = currentCalendarDate.getFullYear();

        monthYearLabel.textContent = `${currentCalendarDate.toLocaleString('default', { month: 'long' })} ${year}`;
        
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const monthData = await fetchMonthData(year, month);
        calendarGrid.innerHTML = '';

        // Add blank days for the start of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarGrid.innerHTML += `<div class="calendar-day not-current-month"></div>`;
        }

        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('calendar-day');
            dayDiv.textContent = i;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            if (monthData[dateStr]) {
                const entry = monthData[dateStr];
                const habitsDone = HABITS.filter(h => entry.habits && entry.habits[h.id]).length;
                const completion = habitsDone / HABITS.length;
                
                let level = 0;
                if (completion > 0) level = 1;
                if (completion >= 0.5) level = 2;
                if (completion >= 0.75) level = 3;
                if (completion === 1) level = 4;
                if (level > 0) {
                    dayDiv.classList.add(`level-${level}`);
                }
            }

            dayDiv.addEventListener('click', () => {
                dateInput.value = dateStr;
                loadEntryForDate(dateStr);
                switchToDailyView();
            });

            calendarGrid.appendChild(dayDiv);
        }
    };

    const fetchMonthData = async (year, month) => {
        const promises = [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const entryRef = doc(db, 'diaries', diaryCollectionId, 'entries', dateStr);
            promises.push(getDoc(entryRef));
        }

        const snapshots = await Promise.all(promises);
        const data = {};
        snapshots.forEach(docSnap => {
            if (docSnap.exists()) {
                data[docSnap.id] = docSnap.data();
            }
        });
        return data;
    };

    // --- Existing functions (loadEntryForDate, saveEntry, etc.) ---
    // ... (copy and paste all the other functions from your last working app.js here) ...
    
    // --- INITIALIZE THE APP ---
    // ... (copy and paste the initialize block here) ...

    dailyViewBtn.addEventListener('click', switchToDailyView);
    calendarViewBtn.addEventListener('click', switchToCalendarView);
    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
};

document.addEventListener('DOMContentLoaded', main);
