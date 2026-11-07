/* Общий клиент Supabase. Библиотека supabase-js подключается в index.html обычным <script>
   (глобальный window.supabase), модули берут клиент отсюда. */
import { APP_CONFIG } from './config.js';

let client = null;

// Библиотека загружена (нет интернета или CDN недоступен: false)
export const hasSupabase = () => !!window.supabase;

// Один общий клиент на весь сайт
export function sb() {
  if (!client) {
    if (!window.supabase) throw new Error('supabase not loaded');
    client = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_KEY);
  }
  return client;
}

// Отдельный клиент со своими настройками (вкладка Photo: без сессии, свой storageKey)
export function createIsolatedClient(options) {
  if (!window.supabase) throw new Error('supabase not loaded');
  return window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_KEY, options);
}
