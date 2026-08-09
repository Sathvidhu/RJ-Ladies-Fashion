// RJ Ladies Fashion - Firebase Integration Config
// Replace the placeholder values below with your Firebase Project Config from Firebase Console

const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase if CDN script is loaded
let db = null;
let isFirebaseActive = false;

if (typeof firebase !== 'undefined') {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        isFirebaseActive = true;
        console.log("Firebase Firestore initialized successfully.");
    } catch (e) {
        console.warn("Firebase initialization skipped (placeholders active). Falling back to LocalStorage.", e);
    }
}
