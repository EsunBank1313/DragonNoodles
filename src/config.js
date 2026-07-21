// 商業營運設定檔 (Commercial Operation Configuration)
// 請在此填入您的 Google Firebase 專案設定，以啟用真實的手機簡訊驗證服務。

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCajCL1h4a_-Di9cq_3BoC-L3CXQ9Q3jec",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "phone-otp-70514.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "phone-otp-70514",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "phone-otp-70514.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "423828215839",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:423828215839:web:75388170fa4067adc7dd2a"
};
