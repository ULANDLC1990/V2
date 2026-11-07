/* Общие настройки сайта. Адрес и ключ меняются только здесь.
   Ключ anon публичный по задумке: доступ к данным ограничивают политики (RLS) в Supabase. */
export const APP_CONFIG = Object.freeze({
  NAME: 'LCDR HUB',
  SUPABASE_URL: 'https://wtqvaeongxncufvpvvge.supabase.co',
  SUPABASE_KEY: 'sb_publishable_9Jfx167Q8LCF1746d1apwA_eWNb_qNb',
  PNBASE_SYNC_URL: 'https://script.google.com/macros/s/AKfycbwlKKOfqjM4iz_jIHyOgFjR8VMeIn4srzhtyEN5T6ETU1WFd0lnPsC7NehLbkn2oqPz/exec',
  SHEET_ID: '10W03bvKlVFlIUcxsHkzP_v_13gtnYRBmnrrO0ujB1bU',
  ERROR_TABLE: 'client_errors'
});
