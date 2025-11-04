// --- 1. IMPORT ONLY FIRESTORE FUNCTIONS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";


// --- 2. YOUR FIREBASE CONFIGURATION (Stays the same) ---
const firebaseConfig = {
    apiKey: "AIzaSyAquYjH9mhBtLvPbFfC_K1xizXNruORXng",
    authDomain: "dairy-2139f.firebaseapp.com",
    projectId: "dairy-2139f",
    storageBucket: "dairy-2139f.appspot.com",
    messagingSenderId: "50167451169",
    appId: "1:50167451169:web:5ea9cffde6db860ff7dd60"
};


// --- 3. INITIALIZE FIREBASE AND GET REFERENCE TO FIRESTORE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// --- 4. GET DOM ELEMENTS (No more auth button) ---
const appContainer = document.getElementById('app-container');
const dateInput = document.getElementById('diary-date');
const entryTextarea = document.getElementById('diary-entry');
const saveButton = document.getElementById('save-button');
const statusMessage = document.getElementById('status-message');


// --- 5. NO MORE AUTHENTICATION LOGIC! ---


// --- 6. FIRESTORE (DATABASE) LOGIC ---

// We will use a fixed path instead of a user-specific one.
const diaryCollectionId = 'public-diary';

const getTodaysDate = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const todayWithOffset = new Date(today.getTime() - (offset * 60 * 1000));
    return todayWithOffset.toISOString().split('T')[0];
}

dateInput.value = getTodaysDate();

const loadEntryForDate = async (dateStr) => {
    if (!dateStr) return;
    entryTextarea.value = 'Loading...';
    const entryRef = doc(db, 'diaries', diaryCollectionId, 'entries', dateStr);
    
    try {
        const docSnap = await getDoc(entryRef);
        if (docSnap.exists()) {
            entryTextarea.value = docSnap.data().content;
        } else {
            entryTextarea.value = '';
        }
        statusMessage.textContent = '';
    } catch (error) {
        console.error("Error loading entry:", error);
        entryTextarea.value = 'Error loading entry.';
    }
};

const saveEntry = async () => {
    const dateStr = dateInput.value;
    const content = entryTextarea.value;
    const entryRef = doc(db, 'diaries', diaryCollectionId, 'entries', dateStr);
    
    try {
        await setDoc(entryRef, { content: content });
        statusMessage.textContent = 'Saved successfully!';
        setTimeout(() => statusMessage.textContent = '', 3000);
    } catch (error) {
        console.error("Error saving entry: ", error);
        statusMessage.textContent = 'Error saving entry.';
    }
};


// --- 7. EVENT LISTENERS ---
dateInput.addEventListener('change', () => {
    loadEntryForDate(dateInput.value);
});

saveButton.addEventListener('click', saveEntry);

// --- 8. LOAD THE FIRST ENTRY WHEN THE PAGE LOADS ---
loadEntryForDate(dateInput.value);
