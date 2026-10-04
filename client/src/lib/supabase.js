import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* "Remember me": the customer's login is kept in localStorage (stays after the
   browser closes) or sessionStorage (cleared when the browser closes). The
   sign-in library reads and writes through this adapter, so token refreshes
   stay in the chosen place and a page reload never loses the login. */
const REMEMBER_KEY = 'lata-remember-login';
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

export const setRememberLogin = (remember) =>
  safe(() => localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'));
const remembered = () => safe(() => localStorage.getItem(REMEMBER_KEY)) !== '0';

const authStorage = {
  getItem: (k) => safe(() => sessionStorage.getItem(k)) ?? safe(() => localStorage.getItem(k)),
  setItem: (k, v) => {
    const [keep, drop] = remembered() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    safe(() => keep.setItem(k, v));
    safe(() => drop.removeItem(k));
  },
  removeItem: (k) => { safe(() => localStorage.removeItem(k)); safe(() => sessionStorage.removeItem(k)); },
};

export const supabase = createClient(url, key, {
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
