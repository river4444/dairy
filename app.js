// --- 1. IMPORT THE NECESSARY FUNCTIONS FROM FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signInWithPopup, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";


// --- 2. YOUR FIREBASE CONFIGURATION (from your input) ---
const firebaseConfig = {
    apiKey: "AIzaSyAquYjH9mhBtLvPbFfC_K1xizXNruORXng",
    authDomain: "dairy-2139f.firebaseapp.com",
    projectId: "dairy-2139f",
    storageBucket: "dairy-2139f.appspot.com", // Corrected domain
    messagingSenderId: "50167451169",
    appId: "1:50167451169:web:5ea9cffde6db860ff7dd60"
};


// --- 3. INITIALIZE FIREBASE AND GET REFERENCES TO SERVICES ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();


// --- 4. GET DOM ELEMENTS ---
const authButton = document.getElementById('auth-button');
const appContainer = document.getElementById('app-container');
const dateInput = document.getElementById('diary-date');
const entryTextarea = document.getElementById('diary-entry');
const saveButton = document.getElementById('save-button');
const statusMessage = document.getElementById('status-message');

let currentUser = null;


// --- 5. AUTHENTICATION LOGIC (using modular functions) ---

// Listen for authentication state changes
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        authButton.textContent = 'Logout';
        appContainer.classList.remove('hidden');
        loadEntryForDate(dateInput.value);
    } else {
        currentUser = null;
        authButton.textContent = 'Login with Google';
        appContainer.classList.add('hidden');
    }
});

// Handle auth button click
authButton.addEventListener('click', () => {
    if (currentUser) {
        signOut(auth);
    } else {
        signInWithPopup(auth, provider).catch(error => {
            console.error("Authentication Error:", error);
        });
    }
});


// --- 6. FIRESTORE (DATABASE) LOGIC (using modular functions) ---

// Get today's date in YYYY-MM-DD format
const getTodaysDate = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const todayWithOffset = new Date(today.getTime() - (offset * 60 * 1000));
    return todayWithOffset.toISOString().split('T')[0];
}

// Set the date input to today's date initially
dateInput.value = getTodaysDate();

// Function to load an entry from Firestore
const loadEntryForDate = async (dateStr) => {
    if (!currentUser || !dateStr) return;

    entryTextarea.value = 'Loading...';
    // Create a document reference using the new 'doc' function
    const entryRef = doc(db, 'diaries', currentUser.uid, 'entries', dateStr);
    
    try {
        const docSnap = await getDoc(entryRef); // Use getDoc
        if (docSnap.exists()) {
            entryTextarea.value = docSnap.data().content;
        } else {
            entryTextarea.value = ''; // No entry for this date
        }
        statusMessage.textContent = '';
    } catch (error) {
        console.error("Error loading entry:", error);
        entryTextarea.value = 'Error loading entry.';
        statusMessage.textContent = 'Error loading entry.';
    }
};

// Function to save an entry to Firestore
const saveEntry = async () => {
    const dateStr = dateInput.value;
    const content = entryTextarea.value;

    if (!currentUser || !dateStr) {
        statusMessage.textContent = 'You must be logged in to save.';
        return;
    }
    
    // Create a document reference
    const entryRef = doc(db, 'diaries', currentUser.uid, 'entries', dateStr);
    
    try {
        await setDoc(entryRef, { content: content }); // Use setDoc
        statusMessage.textContent = 'Saved successfully!';
        setTimeout(() => statusMessage.textContent = '', 3000);
    } catch (error) {
        console.error("Error saving entry: ", error);
        statusMessage.textContent = 'Error saving entry.';
    }
};


// --- 7. EVENT LISTENERS (this part remains the same) ---

// Load a new entry when the date changes
dateInput.addEventListener('change', () => {
    loadEntryForDate(dateInput.value);
});

// Save the entry when the save button is clicked
saveButton.addEventListener('click', saveEntry);
