// ════════════════════════════════════════
// STATS STRINGS — v2.9.0 owner dashboard (stats.html, js/stats/statsPage.js): 繁中 (廣東話書面語) + English.
// Kept apart from LOCALES (locales/en.js, zh-HK.js): the dashboard is not part of the app and is never cached by sw.js.
// Params: {n} {d} {p} {m} {s}; months: {y} 2026, {yy} 26, {m} 10, {mon} Oct.
// ════════════════════════════════════════
const STATS_STRINGS = {
  'zh-HK': {
    title: 'Life in UK · 使用統計', subtitle: 'life-uk.vercel.app · 日期以 UTC 計', range: '時間範圍',
    days: '{n} 日', year: '1 年', all: '全部',
    langBtn: 'EN', langAria: 'Switch to English', refresh: '重新整理', signOut: '登出',
    since: '上線至今 · 由 {d} 起', lifeOpens: '累計開啟', lifeInstalls: '累計安裝', lifeShare: '用已安裝 app 開', lifeDays: '上線日數',
    summary: '摘要', tileOpen: '開 app 次數', tileDau: '平均每日活躍裝置', tileInstall: '新安裝', tileShare: '用已安裝 app 開',
    vsPrev: '對比之前 {p}', vsPrevDays: '{n} 日', vsPrevYear: '1 年', points: ' 個百分點', noPrev: '之前冇數據',
    dauDaily: '每日活躍裝置', dauMonthly: '每月：平均每日活躍裝置',
    dauSubDaily: '每部機每個 UTC 日計一次', dauSubMonthly: '嗰個月每日活躍裝置嘅平均數（唔係當月獨立裝置數）',
    openDaily: '每日開 app 次數', openMonthly: '每月開 app 次數', openSub: '兩段疊埋嘅高度 = 總開啟次數',
    browserOpens: 'Browser', appOpens: '已安裝 app', total: '總數', toDate: '（至今）',
    monthLong: '{y}年{m}月', monthShort: '{yy}年{m}月', fromDay: '（由 {d} 日起）',
    errData: '收到嘅數據唔啱，請稍後再試', errUser: '請輸入帳號',
    tableDaily: '每日明細', tableMonthly: '每月明細', tableSub: '最新排最上，喺框內捲動睇舊數據',
    colDay: '日期', colMonth: '月份', colOpen: '總開啟', colBrowser: 'Browser', colApp: '已安裝 app',
    colDauDaily: '活躍裝置', colDauMonthly: '平均每日活躍裝置', colInstall: '新安裝',
    signInTitle: '登入使用統計', signInHint: '用 Vercel 入面設定嘅帳號同密碼登入。', username: '帳號', password: '密碼',
    signIn: '登入', signingIn: '登入緊…', loading: '載入緊…',
    errWrong: '帳號或密碼唔啱，請再試一次', errLocked: '錯太多次，請 {m} 分鐘後再試',
    errNetwork: '連唔到伺服器，請檢查網絡再試', errServer: '伺服器出錯（{s}），請稍後再試',
    cappedOne: '呢段時間有 {n} 日去到每日上限，嗰日嘅數字可能偏低',
    cappedMany: '呢段時間有 {n} 日去到每日上限，嗰幾日嘅數字可能偏低',
  },
  en: {
    title: 'Life in UK · Usage', subtitle: 'life-uk.vercel.app · dates in UTC', range: 'Time range',
    days: '{n} days', year: '1 year', all: 'All time',
    langBtn: '中', langAria: '切換至中文', refresh: 'Refresh', signOut: 'Sign out',
    since: 'Since launch · from {d}', lifeOpens: 'Total opens', lifeInstalls: 'Total installs', lifeShare: 'Opened as installed app', lifeDays: 'Days live',
    summary: 'Summary', tileOpen: 'App opens', tileDau: 'Avg daily active devices', tileInstall: 'New installs', tileShare: 'Opened as installed app',
    vsPrev: 'vs previous {p}', vsPrevDays: '{n} days', vsPrevYear: 'year', points: ' pts', noPrev: 'No earlier data',
    dauDaily: 'Daily active devices', dauMonthly: 'Monthly: average daily active devices',
    dauSubDaily: 'Each device counts once per UTC day', dauSubMonthly: 'Average of the daily counts in that month (not unique devices per month)',
    openDaily: 'Daily app opens', openMonthly: 'Monthly app opens', openSub: 'The two stacked parts add up to all opens',
    browserOpens: 'Browser', appOpens: 'Installed app', total: 'Total', toDate: ' (to date)',
    monthLong: '{mon} {y}', monthShort: '{mon} {yy}', fromDay: ' (from day {d})',
    errData: 'The server sent unexpected data. Try again later.', errUser: 'Enter the username.',
    tableDaily: 'Daily breakdown', tableMonthly: 'Monthly breakdown', tableSub: 'Newest first; scroll inside the panel for older rows',
    colDay: 'Date', colMonth: 'Month', colOpen: 'All opens', colBrowser: 'Browser', colApp: 'Installed app',
    colDauDaily: 'Active devices', colDauMonthly: 'Avg daily active', colInstall: 'Installs',
    signInTitle: 'Sign in to usage stats', signInHint: 'Use the username and password set in Vercel.', username: 'Username', password: 'Password',
    signIn: 'Sign in', signingIn: 'Signing in…', loading: 'Loading…',
    errWrong: 'Wrong username or password. Try again.', errLocked: 'Too many wrong attempts. Try again in {m} min.',
    errNetwork: 'Can’t reach the server. Check your connection and try again.', errServer: 'Server error ({s}). Try again later.',
    cappedOne: 'The daily request limit was reached on {n} day in this range, so that day may be undercounted.',
    cappedMany: 'The daily request limit was reached on {n} days in this range, so those days may be undercounted.',
  },
};
// month names for the en formats ({mon}); zh-HK formats use the month number
const STATS_EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
