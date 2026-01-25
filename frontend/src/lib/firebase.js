import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  signOut 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBGccmnPzG9dji0kj1AMiBgXge6DSveSRM",
  authDomain: "playtraderz.firebaseapp.com",
  projectId: "playtraderz",
  storageBucket: "playtraderz.firebasestorage.app",
  messagingSenderId: "626403484532",
  appId: "1:626403484532:web:323ebd02aeb8ef727f4221",
  measurementId: "G-4BBB9HC0B6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return { idToken, user: result.user };
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
};

export const signInWithFacebook = async () => {
  try {
    const result = await signInWithPopup(auth, facebookProvider);
    const idToken = await result.user.getIdToken();
    return { idToken, user: result.user };
  } catch (error) {
    console.error('Facebook sign in error:', error);
    throw error;
  }
};

export const signOutFirebase = async () => {
  await signOut(auth);
};

export { auth };
