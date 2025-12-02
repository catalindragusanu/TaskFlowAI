import { Task, EmailContact, PlanTemplate, DailyPlan, UserProfile } from "../types";
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc 
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  OAuthProvider, 
  signOut 
} from "firebase/auth";

// ==========================================
// LOCAL STORAGE IMPLEMENTATION (FALLBACK)
// ==========================================
const KEYS = {
  TASKS: 'tf_tasks',
  CONTACTS: 'tf_contacts',
  TEMPLATES: 'tf_templates',
  PLANS: 'tf_daily_plans',
  USERS: 'tf_users',
  CURRENT_USER: 'tf_current_user_profile' // New key for persisting the guest profile
};

const getLocal = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`Error parsing ${key} from local storage`, e);
    return [];
  }
};

const setLocal = (key: string, data: any[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving ${key} to local storage`, e);
  }
};

// ==========================================
// FIREBASE IMPLEMENTATION (REAL)
// ==========================================
let firestore: any;
let auth: any;

const isReal = isFirebaseConfigured();

if (isReal) {
  try {
    const app = initializeApp(firebaseConfig);
    firestore = getFirestore(app);
    auth = getAuth(app);
    console.log("🔥 Firebase initialized successfully");
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

const useFirestore = (userId?: string) => {
    return isReal && firestore && userId && userId !== 'guest-user';
};

// ==========================================
// UNIFIED DATABASE SERVICE
// ==========================================
export const db = {
  isRealMode: isReal,

  // --- AUTH / USER ---
  // Gets the current local user or default guest
  getCurrentUser: (): UserProfile => {
    try {
      const stored = localStorage.getItem(KEYS.CURRENT_USER);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    
    // Default Guest
    const guest: UserProfile = {
      id: 'guest-user',
      name: 'Guest User',
      email: 'guest@taskflow.ai',
      joinedAt: new Date().toISOString()
    };
    // Persist default guest immediately so changes stick later
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(guest));
    return guest;
  },

  updateUserProfile: async (user: UserProfile) => {
    // Always update local storage first for speed/offline support
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));

    if (useFirestore(user.id)) {
       try {
         if (firestore) await setDoc(doc(firestore, "users", user.id), user, { merge: true });
       } catch (e) {}
    }
    return user;
  },

  registerUser: async (user: UserProfile): Promise<UserProfile> => {
     if (isReal && auth) {
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password || 'password');
        const newUserProfile = { ...user, id: userCredential.user.uid, password: '' };
        try {
            if (firestore) await setDoc(doc(firestore, "users", newUserProfile.id), newUserProfile);
        } catch (e) { console.warn("Could not save user profile to firestore", e); }
        return newUserProfile;
     }

     // Local Simulation
     const users = getLocal<UserProfile>(KEYS.USERS);
     if (users.find(u => u.email === user.email)) {
        throw new Error("User already exists");
     }
     const newUser = { ...user, id: `user_${Date.now()}` };
     users.push(newUser);
     setLocal(KEYS.USERS, users);
     localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(newUser)); // Auto login
     return newUser;
  },

  loginUser: async (email: string, pass: string): Promise<UserProfile> => {
      if (isReal && auth) {
          const userCredential = await signInWithEmailAndPassword(auth, email, pass);
          return {
              id: userCredential.user.uid,
              name: userCredential.user.displayName || email.split('@')[0],
              email: userCredential.user.email || email,
              joinedAt: new Date().toISOString() 
          };
      }

      // Local 
      const users = getLocal<UserProfile>(KEYS.USERS);
      // Backdoor for demo
      if (email === "demo@example.com" && pass === "password") {
         const demoUser = { id: "guest-user", name: "Guest User", email: "demo@example.com", joinedAt: new Date().toISOString() };
         localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(demoUser));
         return demoUser;
      }

      const user = users.find(u => u.email === email && u.password === pass);
      if (!user) throw new Error("Invalid credentials");
      
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      return user;
  },

  resetPassword: async (email: string): Promise<void> => {
      if (isReal && auth) {
          await sendPasswordResetEmail(auth, email);
          return;
      }
      return;
  },

  socialLogin: async (providerName: 'google' | 'apple' | 'github'): Promise<UserProfile> => {
      if (isReal && auth) {
          let provider;
          if (providerName === 'google') provider = new GoogleAuthProvider();
          else if (providerName === 'github') provider = new GithubAuthProvider();
          else if (providerName === 'apple') provider = new OAuthProvider('apple.com');
          
          if (provider) {
             const result = await signInWithPopup(auth, provider);
             const profile = {
                 id: result.user.uid,
                 name: result.user.displayName || 'User',
                 email: result.user.email || '',
                 joinedAt: new Date().toISOString()
             };
             try {
                if (firestore) await setDoc(doc(firestore, "users", profile.id), profile, { merge: true });
             } catch(e) {}
             return profile;
          }
      }
      
      // Simulation
      const profile = {
          id: `social_${providerName}_${Date.now()}`,
          name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} User`,
          email: `user@${providerName}.com`,
          joinedAt: new Date().toISOString()
      };
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));
      return profile;
  },

  logout: async () => {
    if (isReal && auth) {
        await signOut(auth);
    }
    localStorage.removeItem(KEYS.CURRENT_USER);
  },

  // --- TASKS ---
  getTasks: async (userId: string): Promise<Task[]> => {
    if (useFirestore(userId)) {
      try {
        const q = query(collection(firestore, "tasks"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      } catch (e) {
        // Fallback to local if firestore fails
        return getLocal<Task>(KEYS.TASKS).filter(t => t.userId === userId);
      }
    } else {
      return getLocal<Task>(KEYS.TASKS).filter(t => t.userId === userId);
    }
  },

  addTask: async (task: Task) => {
    if (useFirestore(task.userId)) {
      try {
        await setDoc(doc(firestore, "tasks", task.id), task);
        return;
      } catch (e) {}
    }
    const tasks = getLocal<Task>(KEYS.TASKS);
    tasks.unshift(task);
    setLocal(KEYS.TASKS, tasks);
  },

  updateTask: async (updatedTask: Task) => {
    if (useFirestore(updatedTask.userId)) {
      try {
        const taskRef = doc(firestore, "tasks", updatedTask.id);
        const { id, ...data } = updatedTask; 
        await updateDoc(taskRef, data as any);
        return;
      } catch (e) {}
    }
    const tasks = getLocal<Task>(KEYS.TASKS);
    const index = tasks.findIndex(t => t.id === updatedTask.id);
    if (index !== -1) {
      tasks[index] = updatedTask;
      setLocal(KEYS.TASKS, tasks);
    }
  },

  deleteTask: async (taskId: string) => {
    if (isReal && firestore) {
      try {
        await deleteDoc(doc(firestore, "tasks", taskId));
        return;
      } catch (e) {}
    }
    const tasks = getLocal<Task>(KEYS.TASKS);
    const filtered = tasks.filter(t => t.id !== taskId);
    setLocal(KEYS.TASKS, filtered);
  },

  clearCompletedTasks: async (userId: string) => {
    if (useFirestore(userId)) {
      try {
        const q = query(
          collection(firestore, "tasks"), 
          where("userId", "==", userId),
          where("status", "==", "COMPLETED")
        );
        const querySnapshot = await getDocs(q);
        const promises = querySnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(promises);
        return;
      } catch (e) {}
    }
    const tasks = getLocal<Task>(KEYS.TASKS);
    const filtered = tasks.filter(t => !(t.userId === userId && t.status === 'COMPLETED'));
    setLocal(KEYS.TASKS, filtered);
  },

  // --- CONTACTS ---
  getContacts: async (userId: string): Promise<EmailContact[]> => {
    if (useFirestore(userId)) {
      try {
        const q = query(collection(firestore, "contacts"), where("userId", "==", userId));
        const s = await getDocs(q);
        return s.docs.map(d => ({ id: d.id, ...d.data() } as EmailContact));
      } catch(e) {
        return getLocal<EmailContact>(KEYS.CONTACTS).filter(c => c.userId === userId);
      }
    } else {
      return getLocal<EmailContact>(KEYS.CONTACTS).filter(c => c.userId === userId);
    }
  },

  addContact: async (contact: EmailContact) => {
    if (useFirestore(contact.userId)) {
      try {
        await setDoc(doc(firestore, "contacts", contact.id), contact);
        return;
      } catch(e) {}
    }
    const contacts = getLocal<EmailContact>(KEYS.CONTACTS);
    contacts.push(contact);
    setLocal(KEYS.CONTACTS, contacts);
  },

  updateContact: async (contact: EmailContact) => {
    if (useFirestore(contact.userId)) {
      try {
        const { id, ...data } = contact;
        await updateDoc(doc(firestore, "contacts", id), data as any);
        return;
      } catch(e) {}
    }
    const contacts = getLocal<EmailContact>(KEYS.CONTACTS);
    const index = contacts.findIndex(c => c.id === contact.id);
    if (index !== -1) {
      contacts[index] = contact;
      setLocal(KEYS.CONTACTS, contacts);
    }
  },

  deleteContact: async (id: string) => {
    if (isReal && firestore) {
      try {
        await deleteDoc(doc(firestore, "contacts", id));
        return;
      } catch(e) {}
    }
    const contacts = getLocal<EmailContact>(KEYS.CONTACTS);
    const filtered = contacts.filter(c => c.id !== id);
    setLocal(KEYS.CONTACTS, filtered);
  },

  // --- TEMPLATES ---
  getCustomTemplates: async (userId: string): Promise<PlanTemplate[]> => {
    if (useFirestore(userId)) {
      try {
        const q = query(collection(firestore, "templates"), where("userId", "==", userId));
        const s = await getDocs(q);
        return s.docs.map(d => ({ id: d.id, ...d.data() } as PlanTemplate));
      } catch(e) {
        return getLocal<PlanTemplate>(KEYS.TEMPLATES).filter(t => t.userId === userId);
      }
    } else {
      return getLocal<PlanTemplate>(KEYS.TEMPLATES).filter(t => t.userId === userId);
    }
  },

  addTemplate: async (template: PlanTemplate) => {
    if (template.userId && useFirestore(template.userId)) {
      try {
        await setDoc(doc(firestore, "templates", template.id), template);
        return;
      } catch(e) {}
    }
    const templates = getLocal<PlanTemplate>(KEYS.TEMPLATES);
    templates.push(template);
    setLocal(KEYS.TEMPLATES, templates);
  },

  deleteTemplate: async (id: string) => {
    if (isReal && firestore) {
      try {
        await deleteDoc(doc(firestore, "templates", id));
        return;
      } catch(e) {}
    }
    const templates = getLocal<PlanTemplate>(KEYS.TEMPLATES);
    const filtered = templates.filter(t => t.id !== id);
    setLocal(KEYS.TEMPLATES, filtered);
  },

  // --- DAILY PLANS ---
  getDailyPlan: async (userId: string, date: string): Promise<DailyPlan | null> => {
    if (useFirestore(userId)) {
      try {
        const q = query(
          collection(firestore, "daily_plans"), 
          where("userId", "==", userId),
          where("date", "==", date)
        );
        const s = await getDocs(q);
        if (s.empty) return null;
        return { ...s.docs[0].data() } as DailyPlan;
      } catch(e) {
        const plans = getLocal<DailyPlan>(KEYS.PLANS);
        return plans.find(p => p.userId === userId && p.date === date) || null;
      }
    } else {
      const plans = getLocal<DailyPlan>(KEYS.PLANS);
      return plans.find(p => p.userId === userId && p.date === date) || null;
    }
  },

  saveDailyPlan: async (plan: DailyPlan) => {
    if (useFirestore(plan.userId)) {
      try {
        const docId = `${plan.userId}_${plan.date}`;
        await setDoc(doc(firestore, "daily_plans", docId), plan);
        return;
      } catch(e) {}
    }
    const plans = getLocal<DailyPlan>(KEYS.PLANS);
    const index = plans.findIndex(p => p.userId === plan.userId && p.date === plan.date);
    if (index !== -1) {
      plans[index] = plan;
    } else {
      plans.push(plan);
    }
    setLocal(KEYS.PLANS, plans);
  }
};