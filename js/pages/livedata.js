/* Статистика по днях (Statistic per day): LCDR Live Data, версія для сайту.
   Язык берётся из общего i18n.js. Все 10 мов сайту.
   Контейнер: <section id="livePage">. Дані завантажуються при першому відкритті сторінки (show()).
   Источник данных: Google Таблицы (читаются без ключа API через core/sheets.js):
     - журналы станций FI 1 и FI 2 (рабочая таблица);
     - вкладка 123 таблицы с запчастями: поиск по номеру части (Panel_pn);
     - вкладка pn (Alt+3): последняя строка.
   Supabase здесь нужен только для скачивания фото по двойному клику на серийном номере. */
import { APP_CONFIG } from '../core/config.js';
import { sb } from '../core/supabase.js';
import { rows as sheetRows } from '../core/sheets.js';
import { fromSerial } from '../core/diagonals.js';
import { esc as escHtml } from '../core/util.js';
import { createTranslator, onLangChange } from '../i18n.js';

// Таблицы: рабочая (журналы станций), с запчастями (вкладка 123) и со вкладкой pn (Alt+3)
const SHEET_ID = APP_CONFIG.SHEET_ID;
const SHEET_PARTS_ID = '1Ets--Hho-SK_x6J9Xy3oVA7ILtYKx4gscBOwy6t4PTs';
const SHEET_PN_ID = '1UWu4bcuHg6NHhK8ZvjDlQAIue6R1FLBlmAlBhHBj-D8';
const SHEET_PN_GID = 1460654843;

/* ===== Переклади (10 мов, як на сайті) ===== */
const I18N = {
  en: {
    titleHint: 'Click on the date to copy SN. Double-click to show the table full screen',
    searchPh: 'Enter SN / part number (Enter)', bulkPh: 'Paste SN numbers, one per line. Ctrl+Enter = search',
    modeSingle: 'Single', modeBulk: 'Bulk', bulkRun: 'SEARCH',
    diagTitle: 'FI Station Diagonals',
    sum: 'SUM', total: 'TOTAL', name: 'NAME',
    copyNone: 'No data', copyOk: '✓ Copied: {n}', copyErr: 'Copy error',
    noInfo: 'No info!', notFound: 'NOT FOUND', notFoundCount: 'NOT FOUND — [{n}]',
    close: 'CLOSE', modalNoData: 'No data for this employee today.',
    hSerial: 'Serial', hType: 'Type', hStatus: 'Status', hOc: 'OC', hComment: 'Comment',
    hDate: 'Date', hFinal: 'Final', hInfo: 'Info', hRepairer: 'Repairer', unknown: 'UNKNOWN',
    phOk: 'Downloaded: {n}', phNone: 'No photo for {n}', phErr: 'Photo download error', phHint: 'Double-click to download the photo',
    loadErr: 'Failed to load data',
    pnLoading: 'Loading data (pn)...', pnEmpty: 'No data in the pn sheet!', pnCopyHint: 'Click to copy the whole row',
    bulkCopyHint: 'Click to copy the serial numbers of this worker'
  },
  uk: {
    titleHint: 'Натисніть на дату, щоб скопіювати SN. Подвійний клік — таблиця на весь екран',
    searchPh: 'Введіть SN / PN деталі (Enter)', bulkPh: 'Вставте SN, кожен з нового рядка. Ctrl+Enter = пошук',
    modeSingle: 'Один', modeBulk: 'Список', bulkRun: 'ПОШУК',
    diagTitle: 'Діагоналі станцій FI',
    sum: 'СУМА', total: 'РАЗОМ', name: 'ПРАЦІВНИК',
    copyNone: 'Немає даних', copyOk: '✓ Скопійовано: {n}', copyErr: 'Помилка копіювання',
    noInfo: 'Немає інформації!', notFound: 'НЕ ЗНАЙДЕНО', notFoundCount: 'НЕ ЗНАЙДЕНО — [{n}]',
    close: 'ЗАКРИТИ', modalNoData: 'На сьогодні даних по цьому працівнику немає.',
    hSerial: 'Serial', hType: 'Тип', hStatus: 'Статус', hOc: 'OC', hComment: 'Коментар',
    hDate: 'Дата', hFinal: 'Фінальна', hInfo: 'Інфо', hRepairer: 'Ремонтник', unknown: 'НЕВІДОМО',
    phOk: 'Завантажено: {n}', phNone: 'Немає фото для {n}', phErr: 'Помилка завантаження фото', phHint: 'Двічі клікніть, щоб завантажити фото',
    loadErr: 'Не вдалося завантажити дані',
    pnLoading: 'Завантаження даних (pn)...', pnEmpty: 'На аркуші pn немає даних!', pnCopyHint: 'Натисніть, щоб скопіювати весь рядок',
    bulkCopyHint: 'Натисніть, щоб скопіювати серійні номери цього працівника'
  },
  ru: {
    titleHint: 'Нажмите на дату, чтобы скопировать SN. Двойной клик — таблица на весь экран',
    searchPh: 'Введите SN / PN детали (Enter)', bulkPh: 'Вставьте SN, каждый с новой строки. Ctrl+Enter = поиск',
    modeSingle: 'Один', modeBulk: 'Список', bulkRun: 'ПОИСК',
    diagTitle: 'Диагонали станций FI',
    sum: 'СУММА', total: 'ИТОГО', name: 'СОТРУДНИК',
    copyNone: 'Нет данных', copyOk: '✓ Скопировано: {n}', copyErr: 'Ошибка копирования',
    noInfo: 'Нет информации!', notFound: 'НЕ НАЙДЕНО', notFoundCount: 'НЕ НАЙДЕНО — [{n}]',
    close: 'ЗАКРЫТЬ', modalNoData: 'На сегодня данных по этому сотруднику нет.',
    hSerial: 'Serial', hType: 'Тип', hStatus: 'Статус', hOc: 'OC', hComment: 'Комментарий',
    hDate: 'Дата', hFinal: 'Финальная', hInfo: 'Инфо', hRepairer: 'Ремонтник', unknown: 'НЕИЗВЕСТНО',
    phOk: 'Скачано: {n}', phNone: 'Нет фото для {n}', phErr: 'Ошибка скачивания фото', phHint: 'Двойной клик — скачать фото',
    loadErr: 'Не удалось загрузить данные',
    pnLoading: 'Загрузка данных (pn)...', pnEmpty: 'На листе pn нет данных!', pnCopyHint: 'Нажмите, чтобы скопировать всю строку',
    bulkCopyHint: 'Нажмите, чтобы скопировать серийные номера этого работника'
  },
  pl: {
    titleHint: 'Kliknij datę, aby skopiować SN. Podwójne kliknięcie — pełny ekran',
    searchPh: 'Podaj SN / PN części (Enter)', bulkPh: 'Wklej numery SN, każdy w nowej linii. Ctrl+Enter = szukaj',
    modeSingle: 'Pojedynczy', modeBulk: 'Zbiorczy', bulkRun: 'SZUKAJ',
    diagTitle: 'Przekątne stanowisk FI',
    sum: 'SUMA', total: 'RAZEM', name: 'PRACOWNIK',
    copyNone: 'Brak danych', copyOk: '✓ Skopiowano: {n}', copyErr: 'Błąd kopiowania',
    noInfo: 'Brak info!', notFound: 'NIE ZNALEZIONO', notFoundCount: 'NIE ZNALEZIONO — [{n}]',
    close: 'ZAMKNIJ', modalNoData: 'Brak danych dla wybranego pracownika na dzisiaj.',
    hSerial: 'Serial', hType: 'Typ', hStatus: 'Status', hOc: 'OC', hComment: 'Komentarz',
    hDate: 'Data', hFinal: 'Finalna', hInfo: 'Info', hRepairer: 'Naprawiający', unknown: 'NIEZNANY',
    phOk: 'Pobrano: {n}', phNone: 'Brak zdjęcia dla {n}', phErr: 'Błąd pobierania zdjęcia', phHint: 'Kliknij dwukrotnie, aby pobrać zdjęcie',
    loadErr: 'Nie udało się wczytać danych',
    pnLoading: 'Pobieranie danych (pn)...', pnEmpty: 'Brak danych na arkuszu pn!', pnCopyHint: 'Kliknij, aby skopiować cały wiersz',
    bulkCopyHint: 'Kliknij, aby skopiować numery seryjne tego pracownika'
  },
  de: {
    titleHint: 'Auf das Datum klicken, um SN zu kopieren. Doppelklick = Vollbild',
    searchPh: 'SN / Teilenummer eingeben (Enter)', bulkPh: 'SN-Nummern einfügen, eine pro Zeile. Strg+Enter = suchen',
    modeSingle: 'Einzeln', modeBulk: 'Liste', bulkRun: 'SUCHEN',
    diagTitle: 'FI-Stationsdiagonalen',
    sum: 'SUMME', total: 'GESAMT', name: 'NAME',
    copyNone: 'Keine Daten', copyOk: '✓ Kopiert: {n}', copyErr: 'Kopierfehler',
    noInfo: 'Keine Info!', notFound: 'NICHT GEFUNDEN', notFoundCount: 'NICHT GEFUNDEN — [{n}]',
    close: 'SCHLIESSEN', modalNoData: 'Heute keine Daten für diesen Mitarbeiter.',
    hSerial: 'Serial', hType: 'Typ', hStatus: 'Status', hOc: 'OC', hComment: 'Kommentar',
    hDate: 'Datum', hFinal: 'Final', hInfo: 'Info', hRepairer: 'Reparateur', unknown: 'UNBEKANNT',
    phOk: 'Heruntergeladen: {n}', phNone: 'Kein Foto für {n}', phErr: 'Fehler beim Foto-Download', phHint: 'Doppelklick zum Herunterladen des Fotos',
    loadErr: 'Daten konnten nicht geladen werden',
    pnLoading: 'Daten werden geladen (pn)...', pnEmpty: 'Keine Daten im Blatt pn!', pnCopyHint: 'Klicken, um die ganze Zeile zu kopieren',
    bulkCopyHint: 'Klicken, um die Seriennummern dieses Mitarbeiters zu kopieren'
  },
  fr: {
    titleHint: 'Cliquez sur la date pour copier le SN. Double-clic = plein écran',
    searchPh: 'Saisissez SN / référence (Entrée)', bulkPh: 'Collez les SN, un par ligne. Ctrl+Entrée = rechercher',
    modeSingle: 'Unitaire', modeBulk: 'Liste', bulkRun: 'RECHERCHER',
    diagTitle: 'Diagonales des stations FI',
    sum: 'SOMME', total: 'TOTAL', name: 'NOM',
    copyNone: 'Aucune donnée', copyOk: '✓ Copié : {n}', copyErr: 'Erreur de copie',
    noInfo: 'Aucune info !', notFound: 'INTROUVABLE', notFoundCount: 'INTROUVABLE — [{n}]',
    close: 'FERMER', modalNoData: "Aucune donnée pour cet employé aujourd'hui.",
    hSerial: 'Serial', hType: 'Type', hStatus: 'Statut', hOc: 'OC', hComment: 'Commentaire',
    hDate: 'Date', hFinal: 'Finale', hInfo: 'Info', hRepairer: 'Réparateur', unknown: 'INCONNU',
    phOk: 'Téléchargé : {n}', phNone: 'Aucune photo pour {n}', phErr: 'Erreur de téléchargement de la photo', phHint: 'Double-clic pour télécharger la photo',
    loadErr: 'Échec du chargement des données',
    pnLoading: 'Chargement des données (pn)...', pnEmpty: 'Aucune donnée dans la feuille pn !', pnCopyHint: 'Cliquez pour copier toute la ligne',
    bulkCopyHint: 'Cliquez pour copier les numéros de série de cet employé'
  },
  es: {
    titleHint: 'Haga clic en la fecha para copiar el SN. Doble clic = pantalla completa',
    searchPh: 'Introduzca SN / referencia (Intro)', bulkPh: 'Pegue los SN, uno por línea. Ctrl+Intro = buscar',
    modeSingle: 'Individual', modeBulk: 'Lista', bulkRun: 'BUSCAR',
    diagTitle: 'Diagonales de estaciones FI',
    sum: 'SUMA', total: 'TOTAL', name: 'NOMBRE',
    copyNone: 'Sin datos', copyOk: '✓ Copiados: {n}', copyErr: 'Error al copiar',
    noInfo: '¡Sin información!', notFound: 'NO ENCONTRADO', notFoundCount: 'NO ENCONTRADO — [{n}]',
    close: 'CERRAR', modalNoData: 'No hay datos de este empleado para hoy.',
    hSerial: 'Serial', hType: 'Tipo', hStatus: 'Estado', hOc: 'OC', hComment: 'Comentario',
    hDate: 'Fecha', hFinal: 'Final', hInfo: 'Info', hRepairer: 'Reparador', unknown: 'DESCONOCIDO',
    phOk: 'Descargado: {n}', phNone: 'No hay foto de {n}', phErr: 'Error al descargar la foto', phHint: 'Doble clic para descargar la foto',
    loadErr: 'No se pudieron cargar los datos',
    pnLoading: 'Cargando datos (pn)...', pnEmpty: '¡No hay datos en la hoja pn!', pnCopyHint: 'Haga clic para copiar toda la fila',
    bulkCopyHint: 'Haga clic para copiar los números de serie de este empleado'
  },
  it: {
    titleHint: "Clicca sulla data per copiare l'SN. Doppio clic = schermo intero",
    searchPh: 'Inserisci SN / codice parte (Invio)', bulkPh: 'Incolla gli SN, uno per riga. Ctrl+Invio = cerca',
    modeSingle: 'Singolo', modeBulk: 'Elenco', bulkRun: 'CERCA',
    diagTitle: 'Diagonali stazioni FI',
    sum: 'SOMMA', total: 'TOTALE', name: 'NOME',
    copyNone: 'Nessun dato', copyOk: '✓ Copiati: {n}', copyErr: 'Errore di copia',
    noInfo: 'Nessuna info!', notFound: 'NON TROVATO', notFoundCount: 'NON TROVATO — [{n}]',
    close: 'CHIUDI', modalNoData: 'Nessun dato per questo dipendente oggi.',
    hSerial: 'Serial', hType: 'Tipo', hStatus: 'Stato', hOc: 'OC', hComment: 'Commento',
    hDate: 'Data', hFinal: 'Finale', hInfo: 'Info', hRepairer: 'Riparatore', unknown: 'SCONOSCIUTO',
    phOk: 'Scaricato: {n}', phNone: 'Nessuna foto per {n}', phErr: 'Errore di download della foto', phHint: 'Doppio clic per scaricare la foto',
    loadErr: 'Impossibile caricare i dati',
    pnLoading: 'Caricamento dati (pn)...', pnEmpty: 'Nessun dato nel foglio pn!', pnCopyHint: "Clicca per copiare l'intera riga",
    bulkCopyHint: 'Clicca per copiare i numeri di serie di questo operatore'
  },
  pt: {
    titleHint: 'Clique na data para copiar o SN. Duplo clique = tela cheia',
    searchPh: 'Digite SN / referência (Enter)', bulkPh: 'Cole os SN, um por linha. Ctrl+Enter = pesquisar',
    modeSingle: 'Individual', modeBulk: 'Lista', bulkRun: 'PESQUISAR',
    diagTitle: 'Diagonais das estações FI',
    sum: 'SOMA', total: 'TOTAL', name: 'NOME',
    copyNone: 'Sem dados', copyOk: '✓ Copiados: {n}', copyErr: 'Erro ao copiar',
    noInfo: 'Sem informações!', notFound: 'NÃO ENCONTRADO', notFoundCount: 'NÃO ENCONTRADO — [{n}]',
    close: 'FECHAR', modalNoData: 'Não há dados deste funcionário para hoje.',
    hSerial: 'Serial', hType: 'Tipo', hStatus: 'Status', hOc: 'OC', hComment: 'Comentário',
    hDate: 'Data', hFinal: 'Final', hInfo: 'Info', hRepairer: 'Reparador', unknown: 'DESCONHECIDO',
    phOk: 'Baixado: {n}', phNone: 'Sem foto para {n}', phErr: 'Erro ao baixar a foto', phHint: 'Clique duas vezes para baixar a foto',
    loadErr: 'Falha ao carregar os dados',
    pnLoading: 'Carregando dados (pn)...', pnEmpty: 'Sem dados na planilha pn!', pnCopyHint: 'Clique para copiar a linha inteira',
    bulkCopyHint: 'Clique para copiar os números de série deste funcionário'
  },
  tr: {
    titleHint: 'SN kopyalamak için tarihe tıklayın. Çift tıklama = tam ekran',
    searchPh: 'SN / parça numarası girin (Enter)', bulkPh: 'SN numaralarını yapıştırın, her satıra bir tane. Ctrl+Enter = ara',
    modeSingle: 'Tekli', modeBulk: 'Toplu', bulkRun: 'ARA',
    diagTitle: 'FI İstasyon köşegenleri',
    sum: 'TOPLAM', total: 'TOPLAM', name: 'AD',
    copyNone: 'Veri yok', copyOk: '✓ Kopyalandı: {n}', copyErr: 'Kopyalama hatası',
    noInfo: 'Bilgi yok!', notFound: 'BULUNAMADI', notFoundCount: 'BULUNAMADI — [{n}]',
    close: 'KAPAT', modalNoData: 'Bugün bu çalışan için veri yok.',
    hSerial: 'Serial', hType: 'Tip', hStatus: 'Durum', hOc: 'OC', hComment: 'Yorum',
    hDate: 'Tarih', hFinal: 'Final', hInfo: 'Bilgi', hRepairer: 'Onarımcı', unknown: 'BİLİNMİYOR',
    phOk: 'İndirildi: {n}', phNone: '{n} için fotoğraf yok', phErr: 'Fotoğraf indirme hatası', phHint: 'Fotoğrafı indirmek için çift tıklayın',
    loadErr: 'Veriler yüklenemedi',
    pnLoading: 'Veriler yükleniyor (pn)...', pnEmpty: 'pn sayfasında veri yok!', pnCopyHint: 'Tüm satırı kopyalamak için tıklayın',
    bulkCopyHint: 'Bu çalışanın seri numaralarını kopyalamak için tıklayın'
  }
};
const t = createTranslator(I18N);

const CSS = `
#livePage {
  position: relative; display: block; box-sizing: border-box;
  min-height: 100%; padding: 24px 0 30px; overflow: auto;
  background: #000; color: #fff;
  font-family: "Segoe UI", Tahoma, Arial, sans-serif; font-size: 14px;
}

/* ----- Блоки ----- */
#livePage .lv-wrap { width: 95%; max-width: 1200px; margin: 0 auto 24px; transition: all 0.3s ease; }
#livePage .lv-wrap:first-child { margin-top: 0; }
#livePage .lv-card {
  background: #0e0e0e; border: 1px solid #1f2937; border-radius: 10px;
  overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
}
#livePage .lv-block-title {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 12px 18px; background: #111827; color: #fff;
  font-size: 15px; font-weight: 700; border-bottom: 1px solid #1f2937;
}
#livePage #table-title { cursor: pointer; user-select: none; color: #4d94ff; font-size: 15px; font-weight: 700; }
#livePage #table-title:hover { color: #fff; }

#livePage .lv-toggle {
  background: #374151; color: #F3F4F6; border: none; border-radius: 6px;
  padding: 4px 10px; font-size: 12px; cursor: pointer; margin: 0 0 10px auto; display: block;
}
#livePage .lv-toggle:hover { background: #4B5563; }

/* ----- Пошук ----- */
#livePage .lv-search-row { display: flex; gap: 10px; align-items: stretch; max-width: 720px; margin: 0 auto; }
#livePage #search, #livePage #bulk-input {
  flex: 1; min-width: 0; padding: 12px 14px; font-size: 15px;
  background: #111827; color: #fff; border: 1px solid #374151; border-radius: 8px;
  outline: none; box-sizing: border-box; font-family: inherit; transition: border-color 0.2s;
}
#livePage #search:focus, #livePage #bulk-input:focus { border-color: #2563EB; }
#livePage #bulk-input { min-height: 90px; resize: vertical; font-family: Consolas, 'Courier New', monospace; }
#livePage .mode-switch { display: flex; flex-shrink: 0; border: 1px solid #374151; border-radius: 8px; overflow: hidden; }
#livePage .mode-switch button {
  background: #111827; color: #9CA3AF; border: none; padding: 0 14px;
  cursor: pointer; font-weight: 600; font-size: 13px; font-family: inherit; transition: all 0.2s;
}
#livePage .mode-switch button.active { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; }
#livePage .bulk-actions { display: flex; justify-content: center; max-width: 720px; margin: 10px auto 0; }
#livePage #bulk-run {
  background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; border: none;
  padding: 10px 26px; cursor: pointer; font-weight: 600; border-radius: 8px; font-family: inherit;
  box-shadow: 0 0 8px rgba(124,58,237,0.35);
}
#livePage #bulk-run:hover { filter: brightness(1.15); }

#livePage #search-result { margin-top: 16px; }
#livePage .lv-msg { color: #9CA3AF; text-align: center; }

/* ----- Таблицы ----- */
#livePage table { width: 100%; border-collapse: collapse; background: #0e0e0e; }
#livePage th, #livePage td {
  padding: 10px 12px; text-align: center; border-bottom: 1px solid #1f2937; color: #E5E7EB; font-size: 14px;
}
#livePage th {
  background: #111827; color: #9CA3AF; font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
}
#livePage tbody tr:hover { background: rgba(255,255,255,0.03); }
#livePage td.ld-name { cursor: pointer; text-align: left; color: #fff; font-weight: 600; }
#livePage td.ld-name:hover { color: #4d94ff; }
#livePage .total-row td { font-weight: 700; background: #111827; color: #4d94ff; }
#livePage .sum-col { color: #4d94ff; font-weight: 700; }

#livePage #search-result table { border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; margin-top: 4px; }
#livePage .latest-record td { background: rgba(37,99,235,0.2); font-weight: 700; color: #fff; }

#livePage .lv-table-wrap { overflow-x: auto; }
#livePage .lv-block-title { cursor: pointer; user-select: none; }
#livePage .lv-card.collapsed .lv-table-wrap { display: none; }

/* ----- Групи пакетного пошуку ----- */
#livePage details.bulk-group { margin-bottom: 10px; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; }
#livePage details.bulk-group summary {
  padding: 10px 14px; cursor: pointer; background: #111827; color: #fff; font-weight: 600;
}
#livePage details.bulk-missing summary { color: #F87171; }
#livePage .bulk-missing-list { padding: 10px 14px; color: #F87171; word-break: break-word; }

/* ----- Результат пакетного поиска: таблица, клик по работнику открывает окно ----- */
#livePage .bulk-table .bulk-th-name { text-align: left; }
#livePage .bulk-table .bulk-row { cursor: pointer; }
#livePage .bulk-table td.bulk-name { cursor: pointer; text-align: left; color: #fff; font-weight: 600; }
#livePage .bulk-table .bulk-row:hover td.bulk-name { color: #4d94ff; }
#livePage .bulk-table .bulk-missing-row td.bulk-name { color: #F87171; }
#livePage .bulk-table tfoot td:first-child { text-align: left; }
#livePage #modal th.bulk-copy { cursor: pointer; color: #4d94ff; }
#livePage #modal th.bulk-copy:hover { color: #fff; }

/* ----- Модальное окно ----- */
#livePage #modal {
  display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8);
  justify-content: center; align-items: center; z-index: 10000;
}
#livePage #modal.show { display: flex; }
#livePage #modal-content {
  background: #111827; color: #fff; padding: 20px; border: 1px solid #374151; border-radius: 12px;
  max-height: 85%; overflow: auto; width: 90%; max-width: 1000px; box-shadow: 0 10px 25px rgba(0,0,0,0.6);
}
#livePage #modal-close {
  background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; border: none;
  padding: 8px 18px; cursor: pointer; font-weight: 600; margin-bottom: 14px; border-radius: 8px; font-family: inherit;
}

/* ----- Полноэкранный режим ----- */
#livePage .lv-wrap.fullscreen-mode {
  position: fixed !important; top: 0 !important; left: 0 !important;
  width: 100vw !important; height: 100vh !important; max-width: none !important; margin: 0 !important;
  z-index: 9999 !important; background: rgba(0,0,0,0.96); padding: 2vh 2vw; box-sizing: border-box;
  display: flex; flex-direction: column; justify-content: center;
}
#livePage .fullscreen-mode .lv-card { height: 96vh; display: flex; flex-direction: column; }
#livePage .fullscreen-mode .lv-table-wrap { flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; }
#livePage .fullscreen-mode table { flex-grow: 1; height: 100%; }
#livePage .fullscreen-mode th, #livePage .fullscreen-mode td { font-size: min(1.2vw, 2.5vh); padding: 0.3vh 1vw; height: 1%; }

/* ----- Серийный номер: двойной клик скачивает фото ----- */
#livePage td.lv-sn { cursor: pointer; font-family: Consolas, 'Courier New', monospace; }
#livePage td.lv-sn:hover { color: #4d94ff; }
.lv-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: #111827; color: #F9FAFB; border: 1px solid #374151; padding: 10px 18px;
  border-radius: 8px; font-size: 13px; font-weight: 600; z-index: 10001;
  opacity: 0; pointer-events: none; transition: opacity .2s;
}
.lv-toast.show { opacity: 1; }

@media (max-width: 1080px) {
  #livePage .lv-wrap { width: 100%; }
}
`;

const MARKUP = `
<div class="lv-wrap" id="search-wrap">
  <div class="lv-search-row">
    <input type="text" id="search" data-lv-ph="searchPh" autocomplete="off">
    <textarea id="bulk-input" data-lv-ph="bulkPh" style="display:none"></textarea>
    <div class="mode-switch" id="mode-switch">
      <button type="button" data-mode="single" class="active" data-lv="modeSingle"></button>
      <button type="button" data-mode="bulk" data-lv="modeBulk"></button>
    </div>
  </div>
  <div class="bulk-actions" id="bulk-actions" style="display:none">
    <button type="button" id="bulk-run" data-lv="bulkRun"></button>
  </div>
  <div id="search-result"></div>
</div>

<div class="lv-wrap" id="overview-wrap">
  <div class="lv-card" id="overview-block">
    <div class="lv-block-title" id="overview-title">
      <span id="table-title" data-lv-title="titleHint">--.--.----</span>
    </div>
    <div class="lv-table-wrap">
      <table id="combined-table">
        <thead>
          <tr>
            <th></th><th>NDF</th><th>OK</th><th>WAITING</th><th>SCRAP TTL</th><th class="sum-col" data-lv="sum"></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
</div>

<div class="lv-wrap" id="diag-wrap">
  <div class="lv-card" id="diag-block">
    <div class="lv-block-title"><span data-lv="diagTitle"></span></div>
    <div class="lv-table-wrap">
      <table id="diag-table">
        <thead></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
</div>

<div id="modal">
  <div id="modal-content">
    <button type="button" id="modal-close" data-lv="close"></button>
    <div id="modal-body"></div>
  </div>
</div>
`;

const $ = (id) => document.getElementById(id);

let started = false;
let combinedDataCache = [];
let lastFiltered = [];
let lastDateStr = '';
let bulkMode = false;
let resultMode = null;        // 'single' | 'bulk' | 'pn' | null
let titleBusy = false;
let titleTimer = null;
let clickTimer = null;
let bulkGroups = {};          // последний результат пакетного поиска: работник -> записи
let bulkNotFound = [];        // серийники, которых нет в данных
let bulkModalList = null;     // записи работника, показанные сейчас в окне (для копирования по клику на Serial)

function applyText() {
  document.querySelectorAll('#livePage [data-lv]').forEach(el => { el.textContent = t(el.dataset.lv); });
  document.querySelectorAll('#livePage [data-lv-ph]').forEach(el => { el.placeholder = t(el.dataset.lvPh); });
  document.querySelectorAll('#livePage [data-lv-title]').forEach(el => { el.title = t(el.dataset.lvTitle); });
}

function isVisible() {
  const r = $('livePage');
  return !!r && r.style.display !== 'none';
}

function getUserCustomClass(name) {
  switch (name) {
    case 'KOVALCHYK Y.': return 'king-user';
    case 'KUKU O.': return 'owl-user';
    case 'BŁASZKOWSKA M.': return 'pl-user';
    case 'POKALCHUK A.': return 'flower-user';
    case 'NIKOLAIEV D.': return 'boxer-user';
    case 'YAROSHENKO L.': return 'heart-user';
    case 'ZAHUBYPALETS K.': return 'cat-user';
    case 'ULANOVYCH R.': return 'stepan-user';
    default: return '';
  }
}

// Сьогоднішня дата у форматі 18.10.2026
function todayStr() {
  const d = new Date();
  return [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('.');
}

// Чтение вкладки Google Таблицы без ключа API (core/sheets.js). При сбое возвращает null
async function getData(sheetName, spreadsheetId) {
  try {
    return await sheetRows(sheetName, spreadsheetId);
  } catch (e) {
    console.error(`Fetch error ${sheetName}:`, e);
    return null;
  }
}

// Загружает журналы обеих станций и вкладку 123 (запчасти) в общий кэш
async function fetchAndCacheData() {
  try {
    const [s1, s2, s4] = await Promise.all([
      getData('FI Station KOVALCHYK Y.', SHEET_ID),
      getData('FI Station 2 ULANOVYCH.R', SHEET_ID),
      getData('123', SHEET_PARTS_ID)
    ]);
    if (!s1 && !s2 && !s4) return false;

    const mapR = (r, insp) => ({
      date: r[0] || '',
      serial: (r[2] || '').trim(),
      type: (r[3] || '').trim().toUpperCase(),
      status: r[4] || '',
      name: r[5] || '',
      nameG: r[6] || '',
      ocAfterRepair: r[9] || '',
      comment: r[10] || '',
      inspector: insp
    });

    combinedDataCache = [
      ...(s1 ? s1.slice(1) : []).map(r => mapR(r, 'KOVALCHYK Y.')),
      ...(s2 ? s2.slice(1) : []).map(r => mapR(r, 'ULANOVYCH.R')),
      ...(s4 ? s4.slice(1) : []).map(r => mapR(r, '123'))
    ];
    return true;
  } catch (e) {
    console.error('Buffer update failed:', e);
    return false;
  }
}

function parseDatePart(val) {
  if (!val) return null;
  const first = val.split(' ')[0].trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) return new Date(first);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(first)) {
    const [d, m, y] = first.split('.');
    return new Date(`${y}-${m}-${d}`);
  }
  const parsed = Date.parse(first);
  return isNaN(parsed) ? null : new Date(parsed);
}

function getLastDate(data) {
  const dates = data.map(r => parseDatePart(r.date)).filter(d => d instanceof Date && !isNaN(d));
  return dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
}

function toggleBlock(blockId) {
  $(blockId).classList.toggle('collapsed');
}

function closeModal() {
  $('modal').classList.remove('show');
}

// Таблица записей работника для окна. copyable = true: клик по надписи Serial копирует серийные номера
function workerTable(records, copyable) {
  const copyAttr = copyable ? ` class="bulk-copy" title="${escHtml(t('bulkCopyHint'))}"` : '';
  let html = `<table><thead><tr>
      <th${copyAttr}>${escHtml(t('hSerial'))}</th><th>${escHtml(t('hType'))}</th><th>${escHtml(t('hStatus'))}</th>
      <th>${escHtml(t('hOc'))}</th><th>${escHtml(t('hComment'))}</th>
    </tr></thead><tbody>`;
  records.forEach(r => {
    html += `<tr><td class="lv-sn" data-sn="${escHtml(r.serial || '')}" title="${escHtml(t('phHint'))}">${escHtml(r.serial || '--')}</td><td>${escHtml(r.type || '--')}</td><td>${escHtml(r.status || '--')}</td><td>${escHtml(r.ocAfterRepair || '--')}</td><td>${escHtml(r.comment || '--')}</td></tr>`;
  });
  return html + '</tbody></table>';
}

function openModal(name) {
  bulkModalList = null;
  const records = combinedDataCache.filter(r => r.name === name && (r.date || '').split(' ')[0] === lastDateStr);
  const body = $('modal-body');

  if (!records.length) {
    body.innerHTML = `<p class="lv-msg">${escHtml(t('modalNoData'))}</p>`;
  } else {
    body.innerHTML = workerTable(records, false);
  }
  $('modal').classList.add('show');
}

// Окно для результата пакетного поиска: то же окно, но только найденные серийники этого работника
function openBulkModal(key) {
  const body = $('modal-body');
  if (key === 'missing') {
    bulkModalList = null;
    body.innerHTML = `<div class="bulk-missing-list">${escHtml(bulkNotFound.join(', '))}</div>`;
  } else {
    const list = bulkGroups[String(key).replace(/^w:/, '')] || [];
    bulkModalList = list;
    body.innerHTML = list.length ? workerTable(list, true) : `<p class="lv-msg">${escHtml(t('modalNoData'))}</p>`;
  }
  $('modal').classList.add('show');
}

function displayCombinedStats(filtered) {
  const stats = {};
  let tNDF = 0, tOK = 0, tWAIT = 0, tTTL = 0, gTotal = 0;

  filtered.forEach(r => {
    const n = r.name || t('unknown');
    if (!stats[n]) stats[n] = { NDF: 0, OK: 0, WAITING: 0, 'SCRAP TTL': 0, total: 0 };
    if (r.status === 'NDF') { stats[n].NDF++; tNDF++; }
    if (r.status === 'OK') { stats[n].OK++; tOK++; }
    if (r.status === 'WAITING') { stats[n].WAITING++; tWAIT++; }
    if (r.status === 'SCRAP TTL') { stats[n]['SCRAP TTL']++; tTTL++; }
    stats[n].total++; gTotal++;
  });

  const tbody = document.querySelector('#combined-table tbody');
  tbody.innerHTML = '';

  Object.entries(stats)
    .sort((a, b) => a[1].OK - b[1].OK)
    .forEach(([name, data]) => {
      const row = document.createElement('tr');
      row.innerHTML =
        `<td class="ld-name ${getUserCustomClass(name)}" data-name="${escHtml(name)}">${escHtml(name)}</td>` +
        `<td>${data.NDF}</td><td>${data.OK}</td><td>${data.WAITING}</td><td>${data['SCRAP TTL']}</td>` +
        `<td class="sum-col">${data.total}</td>`;
      tbody.appendChild(row);
    });

  const tr = document.createElement('tr');
  tr.className = 'total-row';
  tr.innerHTML = `<td>${escHtml(t('total'))}</td><td>${tNDF}</td><td>${tOK}</td><td>${tWAIT}</td><td>${tTTL}</td><td class="sum-col">${gTotal}</td>`;
  tbody.appendChild(tr);
}

function displayDiagonalStats(filtered) {
  const diagStats = {};
  filtered.forEach(({ name, serial, status }) => {
    if (status !== 'OK' && status !== 'NDF') return;
    const diag = fromSerial(serial);
    if (!diag) return;
    const nm = name || t('unknown');
    if (!diagStats[nm]) diagStats[nm] = {};
    diagStats[nm][diag] = (diagStats[nm][diag] || 0) + 1;
  });

  const tbody = document.querySelector('#diag-table tbody');
  const thead = document.querySelector('#diag-table thead');
  const allDiagonals = [...new Set(Object.values(diagStats).flatMap(o => Object.keys(o)))].map(Number).sort((a, b) => a - b);

  thead.innerHTML = `<tr><th>${escHtml(t('name'))}</th>${allDiagonals.map(d => `<th>${d}</th>`).join('')}<th class="sum-col">${escHtml(t('sum'))}</th></tr>`;
  tbody.innerHTML = '';

  Object.entries(diagStats).sort().forEach(([name, diags]) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td class="${getUserCustomClass(name)}" style="cursor:default; text-align:left; color:#fff; font-weight:600;">${escHtml(name)}</td>` +
      allDiagonals.map(d => `<td>${diags[d] || 0}</td>`).join('') +
      `<td class="sum-col">${Object.values(diags).reduce((a, b) => a + b, 0)}</td>`;
    tbody.appendChild(row);
  });
}

async function updateStats() {
  if (await fetchAndCacheData()) {
    lastDateStr = getLastDate(combinedDataCache).toISOString().split('T')[0];
    lastFiltered = combinedDataCache.filter(r => (r.date || '').split(' ')[0] === lastDateStr);
    displayCombinedStats(lastFiltered);
    displayDiagonalStats(lastFiltered);
  }
}

// Заголовок таблицы показывает сегодняшнюю дату
function refreshTitleDate() {
  if (!titleBusy) $('table-title').textContent = todayStr();
}

// Клик по дате: копирует SN оператора KOVALCHYK за последний день
function copySecret() {
  const title = $('table-title');

  const records = combinedDataCache.filter(r => {
    const recordDate = parseDatePart(r.date);
    const isSameDay = recordDate && recordDate.toISOString().split('T')[0] === lastDateStr;
    return r.inspector === 'KOVALCHYK Y.' &&
           isSameDay &&
           ['OK', 'NDF', 'SCRAP TTL'].includes(r.status) &&
           r.type !== 'MNT';
  });

  const base = todayStr();
  titleBusy = true;
  clearTimeout(titleTimer);

  if (!records.length) {
    title.textContent = t('copyNone');
  } else {
    navigator.clipboard.writeText(records.map(r => r.serial).join('\n'))
      .then(() => { title.textContent = t('copyOk', { n: records.length }); })
      .catch(() => { title.textContent = t('copyErr'); });
  }

  titleTimer = setTimeout(() => {
    titleBusy = false;
    title.textContent = base;
  }, 1500);
}

// Одинарный клик по дате — копирование, двойной — полный экран
function onTitleClick() {
  clearTimeout(clickTimer);
  clickTimer = setTimeout(copySecret, 220);
}

function onTitleDblClick() {
  clearTimeout(clickTimer);
  toggleFullscreen();
}

// Переключатель поиска: Single / Bulk
function setMode(mode) {
  bulkMode = mode === 'bulk';
  document.querySelectorAll('#mode-switch button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  $('search').style.display = bulkMode ? 'none' : 'block';
  $('bulk-input').style.display = bulkMode ? 'block' : 'none';
  $('bulk-actions').style.display = bulkMode ? 'flex' : 'none';
  $('search-result').innerHTML = '';
  resultMode = null;
  (bulkMode ? $('bulk-input') : $('search')).focus();
}

/* ----- Скачивание фото по двойному клику на серийном номере (бакет photos в Supabase) ----- */

let toastTimer = null;
function lvToast(msg) {
  let el = document.getElementById('lvToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lvToast';
    el.className = 'lv-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// Файлы в бакете называются ФАМИЛИЯ__серийный.jpg. Ищем по серийному номеру, самый свежий файл первым
async function downloadPhoto(rawSn) {
  const sn = String(rawSn || '').trim().replace(/[^A-Za-z0-9_-]/g, '');
  if (!sn) return;
  const tail = ('__' + sn + '.jpg').toLowerCase();
  try {
    const client = sb();
    const { data, error } = await client.storage.from('photos').list('', {
      limit: 1000,
      sortBy: { column: 'updated_at', order: 'desc' }
    });
    if (error) throw error;

    const file = (data || []).find(f => f.name.toLowerCase().endsWith(tail));
    if (!file) { lvToast(t('phNone', { n: sn })); return; }

    const { data: blob, error: e2 } = await client.storage.from('photos').download(file.name);
    if (e2 || !blob) throw e2 || new Error('empty file');

    const saveName = file.name.split('__')[1] || (sn + '.jpg'); // серийный номер.jpg, как он сохранён
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = saveName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    lvToast(t('phOk', { n: saveName }));

    // Отметка «скачано» для вкладки Photo (таблица photo_downloads). Ошибка отметки не мешает скачиванию
    try { await client.rpc('mark_photo_downloaded', { p_name: file.name }); } catch (e) {}
  } catch (e) {
    console.error('photo download:', e);
    lvToast(t('phErr'));
  }
}

/* ----- Поиск: серийный номер -> история ремонта, номер части (Panel_pn) -> строки вкладки 123 ----- */

function runSingleSearch() {
  const serial = $('search').value.trim().toUpperCase();
  const output = $('search-result');
  if (!serial) { output.innerHTML = ''; resultMode = null; return; }
  resultMode = 'single';

  const matches = combinedDataCache
    .filter(r => (r.serial || '').trim().toUpperCase() === serial)
    .sort((a, b) => (parseDatePart(b.date) || 0) - (parseDatePart(a.date) || 0));

  if (!matches.length) {
    output.innerHTML = `<p class="lv-msg">${escHtml(t('noInfo'))}</p>`;
    return;
  }

  output.innerHTML = `<table><thead><tr>
      <th>${escHtml(t('hDate'))}</th><th>${escHtml(t('hStatus'))}</th><th>${escHtml(t('hRepairer'))}</th>
      <th>${escHtml(t('hFinal'))}</th><th>${escHtml(t('hInfo'))}</th>
    </tr></thead>
    <tbody>${matches.map((d, i) => `
      <tr ${i === 0 ? 'class="latest-record"' : ''}>
        <td>${escHtml(d.date)}</td><td>${escHtml(d.status)}</td><td>${escHtml(d.name)}</td>
        <td>${escHtml(d.nameG)}</td><td>${escHtml(d.comment)}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

function runBulkSearch() {
  const output = $('search-result');
  const snList = $('bulk-input').value.split('\n').map(s => s.trim().toUpperCase()).filter(s => s !== '');
  if (!snList.length) { output.innerHTML = ''; resultMode = null; return; }
  resultMode = 'bulk';

  const groups = {};
  const notFound = [];

  snList.forEach(sn => {
    const matches = combinedDataCache.filter(r => (r.serial || '').trim().toUpperCase() === sn);
    if (matches.length) {
      matches.sort((a, b) => (parseDatePart(b.date) || 0) - (parseDatePart(a.date) || 0));
      const record = matches[0];
      const wName = record.name || t('unknown');
      if (!groups[wName]) groups[wName] = [];
      groups[wName].push(record);
    } else {
      notFound.push(sn);
    }
  });
  bulkGroups = groups;
  bulkNotFound = notFound;

  const sortedNames = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  const foundTotal = sortedNames.reduce((n, name) => n + groups[name].length, 0);

  // Таблица: работник и количество. Клик по работнику открывает окно со списком его серийников
  let rows = sortedNames.map(name => `
      <tr class="bulk-row" data-key="${escHtml('w:' + name)}">
        <td class="bulk-name ${getUserCustomClass(name)}">${escHtml(name)}</td>
        <td class="sum-col">${groups[name].length}</td>
      </tr>`).join('');

  if (notFound.length) {
    rows += `
      <tr class="bulk-row bulk-missing-row" data-key="missing">
        <td class="bulk-name">${escHtml(t('notFoundCount', { n: notFound.length }))}</td>
        <td></td>
      </tr>`;
  }

  output.innerHTML = rows
    ? `<div class="lv-table-wrap"><table class="bulk-table">
        <thead><tr><th class="bulk-th-name">${escHtml(t('name'))}</th><th>${escHtml(t('sum'))}</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="total-row"><td>${escHtml(t('total'))}</td><td>${foundTotal}</td></tr></tfoot>
      </table></div>`
    : `<p class="lv-msg">${escHtml(t('notFound'))}</p>`;
}

// Клик по строке результата: открыть окно работника
function onBulkClick(e) {
  const row = e.target.closest && e.target.closest('tr.bulk-row');
  if (row && row.dataset.key) openBulkModal(row.dataset.key);
}

// Клик по надписи Serial в окне: скопировать серийные номера этого работника
function onModalBodyClick(e) {
  const th = e.target.closest && e.target.closest('th.bulk-copy');
  if (!th || !bulkModalList || !bulkModalList.length) return;
  const list = bulkModalList;
  const done = (msg) => {
    th.textContent = msg;
    clearTimeout(th._t);
    th._t = setTimeout(() => { th.textContent = t('hSerial'); }, 1500);
  };
  navigator.clipboard.writeText(list.map(r => r.serial).join('\n'))
    .then(() => done(t('copyOk', { n: list.length })))
    .catch(() => done(t('copyErr')));
}

/* ----- Вкладка pn: последняя строка (Alt + 3) ----- */
async function refreshPnRecord(showLoader = false) {
  const output = $('search-result');
  if (!output) return;
  resultMode = 'pn';
  if (showLoader) output.innerHTML = `<p class="lv-msg">${escHtml(t('pnLoading'))}</p>`;

  let rows = null;
  try {
    rows = await sheetRows(null, SHEET_PN_ID, SHEET_PN_GID);
  } catch (err) {
    console.error('pn sheet:', err);
  }
  if (resultMode !== 'pn') return; // пока шла загрузка, пользователь переключился
  if (!rows || rows.length === 0) {
    output.innerHTML = `<p class="lv-msg">${escHtml(t('pnEmpty'))}</p>`;
    return;
  }

  const hasHeader = rows.length > 1;
  const headers = hasHeader ? rows[0] : null;
  const lastRow = rows[rows.length - 1];

  let html = '<table>';
  if (headers) html += '<thead><tr>' + headers.map(h => `<th>${escHtml(h)}</th>`).join('') + '</tr></thead>';
  html += `<tbody><tr class="latest-record" style="cursor:pointer;" title="${escHtml(t('pnCopyHint'))}">` +
    lastRow.map(v => `<td>${escHtml(v || '--')}</td>`).join('') + '</tr></tbody></table>';
  output.innerHTML = html;

  const row = output.querySelector('.latest-record');
  if (row) {
    row.addEventListener('click', () => {
      const text = Array.from(row.children).map(td => td.innerText).join('\t');
      navigator.clipboard.writeText(text);
      row.style.opacity = '0.6';
      setTimeout(() => { row.style.opacity = ''; }, 300);
    });
  }
}

async function togglePnRecord() {
  const output = $('search-result');
  if (!output) return;
  if (resultMode === 'pn') {
    output.innerHTML = '';
    resultMode = null;
  } else {
    await refreshPnRecord(true);
  }
}

function onSearchKey(e) {
  if (e.key === 'Enter') runSingleSearch();
}

function onBulkKey(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    runBulkSearch();
  }
}

function exitFullscreen() {
  $('overview-wrap').classList.remove('fullscreen-mode');
  $('diag-wrap').style.display = '';
  $('search-wrap').style.display = '';
}

function toggleFullscreen() {
  const ov = $('overview-wrap');
  if (ov.classList.contains('fullscreen-mode')) {
    exitFullscreen();
  } else {
    ov.classList.add('fullscreen-mode');
    $('diag-wrap').style.display = 'none';
    $('search-wrap').style.display = 'none';
  }
}

function closeOverlays() {
  closeModal();
  if ($('overview-wrap').classList.contains('fullscreen-mode')) exitFullscreen();
}

function onGlobalKey(e) {
  if (!isVisible()) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    if (e.key === 'Escape') closeOverlays();
    return;
  }
  if (e.altKey) {
    if (e.code === 'Digit1' || e.key === '1') {
      e.preventDefault();
      toggleBlock('overview-block');
    }
    if (e.code === 'Digit2' || e.key === '2') {
      e.preventDefault();
      $('diag-block').style.display = 'block';
      toggleBlock('diag-block');
    }
    if (e.code === 'Digit3' || e.key === '3') {
      e.preventDefault();
      togglePnRecord();
    }
  }
  if (e.key === 'Escape') closeOverlays();
}

// Перерисовка всего модуля при смене языка сайта
function refreshLanguage() {
  applyText();
  refreshTitleDate();
  if (lastFiltered.length) {
    displayCombinedStats(lastFiltered);
    displayDiagonalStats(lastFiltered);
  }
  if (resultMode === 'single') runSingleSearch();
  else if (resultMode === 'bulk') runBulkSearch();
  else if (resultMode === 'pn') refreshPnRecord(false);
}

export function init() {
  const root = $('livePage');
  if (!root) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  root.innerHTML = MARKUP;

  $('modal-close').onclick = closeModal;
  $('modal').onclick = (e) => { if (e.target === $('modal')) closeModal(); };

  $('table-title').addEventListener('click', onTitleClick);
  $('table-title').addEventListener('dblclick', onTitleDblClick);
  $('overview-title').addEventListener('dblclick', (e) => {
    if (e.target.id !== 'table-title') toggleFullscreen();
  });

  $('combined-table').querySelector('tbody').addEventListener('click', (e) => {
    const td = e.target.closest('.ld-name');
    if (td && td.dataset.name) openModal(td.dataset.name);
  });

  $('overview-title').addEventListener('click', (e) => {
    if (e.target.id !== 'table-title') toggleBlock('overview-block');
  });
  $('diag-block').querySelector('.lv-block-title').addEventListener('click', () => toggleBlock('diag-block'));

  $('mode-switch').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setMode(b.dataset.mode);
  });
  $('search').addEventListener('keydown', onSearchKey);
  $('bulk-input').addEventListener('keydown', onBulkKey);
  $('bulk-run').onclick = runBulkSearch;
  $('search-result').addEventListener('click', onBulkClick);
  $('modal-body').addEventListener('click', onModalBodyClick);

  document.addEventListener('keydown', onGlobalKey, true);

  // Двойной клик по серийному номеру (окно работника, пакетный поиск): скачать фото
  root.addEventListener('dblclick', (e) => {
    const td = e.target.closest && e.target.closest('td.lv-sn');
    if (td && td.dataset.sn) downloadPhoto(td.dataset.sn);
  });

  applyText();
  refreshTitleDate();
  setInterval(refreshTitleDate, 60000);
  setInterval(() => { if (resultMode === 'pn' && isVisible() && !document.hidden) refreshPnRecord(false); }, 5000);

  onLangChange(refreshLanguage);
}

// Оболочка вызывает при открытии вкладки Statistic per day.
// Данные загружаются при первом открытии, дальше раз в минуту, пока страница открыта.
export function show() {
  if (started) return;
  started = true;
  updateStats();
  setInterval(() => { if (isVisible() && !document.hidden) updateStats(); }, 60000);
}
