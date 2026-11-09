export const GAS_MANIFEST_JSON = `{
  "timeZone": "Asia/Tokyo",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Docs",
        "serviceId": "docs",
        "version": "v1"
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}`;

export const GAS_READONLY_SCRIPT = `/**
 * 書斎 (Shosai) - Google Apps Script 安全連携プロキシ
 * 
 * 【特徴】
 * 1. メール + 共通の合言葉でログイン。成功後は署名付きトークンで認証 (メールの自己申告は信用しない)
 * 2. 許可リスト(シート共有 or Usersシート)にある人だけが閲覧・書き込み可能 (DB不要・無料)
 * 3. Google Docs の最新「タブ(Tabs)」構造に完全対応
 * 4. 閲覧権限ホワイトリスト照合 & 蛍光ペンメモ同期
 */

// ★ 管理スプレッドシートの ID (URL の /d/ と /edit の間の文字列)。GAS に貼り付けた後で自分の ID に書き換える
const SHEET_ID = 'YOUR_SHEET_ID';

// ★ 読者に共有する「合言葉」。必ず自分で決めた文字列に書き換える (変更すると全員がログアウトされる)
const SHARED_PASSWORD = 'CHANGE_ME_PASSWORD';
// ログイン状態の有効日数 (自前の署名トークン。DB不要)
const SESSION_DAYS = 30;

function doGet(e) {
  const params = e.parameter || {};
  const action = params.action || 'getCatalog';

  try {
    // 1. ログイン: メール + 合言葉を確認 → 自前のセッショントークンを発行
    if (action === 'login') {
      return jsonResponse(loginWithPassword(params.email, params.password));
    }

    // 2. それ以外は全てセッショントークン必須 (メールアドレスは自己申告を一切信用しない)
    const email = verifySessionToken(params.token);
    if (!email) {
      return jsonResponse({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'ログインの有効期限が切れました。再ログインしてください。'
      });
    }
    if (!isUserAllowed(email)) {
      return jsonResponse({
        success: false,
        error: 'PERMISSION_DENIED',
        message: '閲覧室への入場権限がありません。著者に共有を依頼してください。'
      });
    }
    // 書き込みの投稿者は必ずトークンのメールにする (なりすまし防止)
    params.authorEmail = email;

    // 3. アクション別処理
    if (action === 'getCatalog') {
      const works = getCatalogFromSheet();
      return jsonResponse({ success: true, works: works });
    }

    if (action === 'getDoc') {
      const docId = params.docId;
      if (!docId) {
        return jsonResponse({ success: false, error: 'docIdが必要です。' });
      }
      const docData = getDocumentContent(docId);
      return jsonResponse({ success: true, data: docData });
    }

    if (action === 'getHighlights') {
      const highlights = getHighlightsFromSheet(params.workId, params.tabId);
      return jsonResponse({ success: true, highlights: highlights });
    }

    if (action === 'getAllHighlights') {
      const highlights = getAllHighlightsFromSheet();
      return jsonResponse({ success: true, highlights: highlights });
    }

    if (action === 'addHighlight') {
      const savedId = addHighlightToSheet(params);
      return jsonResponse({ success: true, id: savedId });
    }

    if (action === 'reactHighlight') {
      const result = reactToSheet(params);
      return jsonResponse({ success: true, id: result.id, reactionCount: result.reactionCount });
    }

    if (action === 'deleteHighlight') {
      deleteHighlightFromSheet(params.id, email);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: '未知のアクションです: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * メール + 合言葉でログイン → 許可リスト確認 → セッショントークン発行
 * 失敗時の文言は常に同じ (どのメールが許可されているか推測されないため)
 * 連続失敗はロックする (メールごと10回 / 全体50回、15分)
 */
function loginWithPassword(emailRaw, password) {
  if (SHARED_PASSWORD === 'CHANGE_ME_PASSWORD') {
    return { success: false, error: 'SETUP', message: 'GAS の SHARED_PASSWORD が未設定です。' };
  }

  const email = String(emailRaw || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  const emailKey = 'fail:' + email;
  const allKey = 'fail:all';
  const emailFails = Number(cache.get(emailKey) || 0);
  const allFails = Number(cache.get(allKey) || 0);
  if (emailFails >= 10 || allFails >= 50) {
    return { success: false, error: 'LOCKED', message: '試行回数が多すぎます。しばらく待ってからお試しください。' };
  }

  const passwordOk = String(password || '') === SHARED_PASSWORD;
  const allowed = passwordOk && isUserAllowed(email);
  if (!allowed) {
    cache.put(emailKey, String(emailFails + 1), 900);
    cache.put(allKey, String(allFails + 1), 900);
    return { success: false, error: 'DENIED', message: 'メールアドレスまたは合言葉が正しくありません。' };
  }

  return {
    success: true,
    email: email,
    name: email.split('@')[0],
    token: signSession(email)
  };
}

function getSessionSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SESSION_SECRET', secret);
  }
  return secret;
}

function signSession(email) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = email + '|' + exp;
  const sig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, getSessionSecret() + '|' + SHARED_PASSWORD)
  );
  return Utilities.base64EncodeWebSafe(payload) + '.' + sig;
}

function verifySessionToken(token) {
  if (!token) return '';
  const parts = String(token).split('.');
  if (parts.length !== 2) return '';
  let payload;
  try {
    payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
  } catch (e) {
    return '';
  }
  const expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, getSessionSecret() + '|' + SHARED_PASSWORD)
  );
  if (expected !== parts[1]) return '';
  const idx = payload.lastIndexOf('|');
  if (idx < 0) return '';
  const exp = Number(payload.slice(idx + 1));
  if (!exp || Date.now() > exp) return '';
  return payload.slice(0, idx);
}

/**
 * 閲覧権限チェック (許可されていなければ false = fail-closed)
 *  - スプレッドシートの所有者 / 編集者 / 閲覧者
 *  - 'Users' / '読者リスト' / 'Readers' シートの A 列に書かれたメール
 * 5分キャッシュ。権限を外した場合は最大5分で反映される。
 */
function isUserAllowed(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return false;

  const cache = CacheService.getScriptCache();
  const cacheKey = 'allow:' + email;
  if (cache.get(cacheKey) === '1') return true;

  let allowed = false;
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const people = [].concat(ss.getViewers(), ss.getEditors());
    if (ss.getOwner()) people.push(ss.getOwner());
    const emails = people.map(function(u) { return String(u.getEmail()).toLowerCase(); });
    emails.push(String(Session.getEffectiveUser().getEmail()).toLowerCase());
    if (emails.indexOf(email) !== -1) allowed = true;

    if (!allowed) {
      const userSheet = ss.getSheetByName('Users') || ss.getSheetByName('読者リスト') || ss.getSheetByName('Readers');
      if (userSheet) {
        const values = userSheet.getDataRange().getValues();
        for (let i = 0; i < values.length; i++) {
          if (String(values[i][0] || '').trim().toLowerCase() === email) { allowed = true; break; }
        }
      }
    }
  } catch (err) {
    Logger.log('isUserAllowed error: ' + err);
    return false;
  }

  if (allowed) cache.put(cacheKey, '1', 300);
  return allowed;
}

/**
 * スプレッドシートから作品一覧を取得
 */
function getCatalogFromSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  if (!rows || rows.length < 2) return [];

  // ヘッダー行を特定 (行1または行2)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const rowStr = rows[i].map(function(c) { return String(c).toLowerCase(); });
    if (rowStr.some(function(c) { return c.indexOf('title') !== -1 || c.indexOf('タイトル') !== -1 || c.indexOf('作品') !== -1 || c.indexOf('url') !== -1; })) {
      headerIndex = i;
      break;
    }
  }

  const headers = rows[headerIndex].map(function(c) { return String(c).toLowerCase().trim(); });
  function getCol() {
    var names = Array.prototype.slice.call(arguments);
    return headers.findIndex(function(h) {
      return names.some(function(n) { return h.indexOf(n.toLowerCase()) !== -1; });
    });
  }

  const titleCol = getCol('タイトル', 'title', '題名');
  const typeCol = getCol('種別', 'type', '区分');
  const urlCol = getCol('url', '文書id', 'doc_id', 'リンク');
  const summaryCol = getCol('概要', 'summary', 'あらすじ');
  const tagsCol = getCol('タグ', 'tags');
  const authorCol = getCol('著者', 'author');
  const dateCol = getCol('更新日', 'updated_at', '日付');
  const episodesCol = getCol('話数', '話', 'episodes', 'エピソード数');

  const works = [];
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const title = titleCol >= 0 && row[titleCol] ? String(row[titleCol]).trim() : '';
    if (!title) continue;

    const rawType = typeCol >= 0 && row[typeCol] ? String(row[typeCol]).trim() : '';
    const isShort = rawType.indexOf('短編') !== -1 || rawType.toLowerCase().indexOf('short') !== -1;
    const rawUrl = urlCol >= 0 && row[urlCol] ? String(row[urlCol]).trim() : '';
    
    // docId 抽出
    let docId = rawUrl;
    const match = rawUrl.match(/\\/d\\/([a-zA-Z0-9_-]+)/);
    if (match) docId = match[1];

    const summary = summaryCol >= 0 && row[summaryCol] ? String(row[summaryCol]).trim() : '';
    const rawTags = tagsCol >= 0 && row[tagsCol] ? String(row[tagsCol]).trim() : '';
    const tags = rawTags ? rawTags.split(/[,\\s#]+/).map(function(t) { return t.trim(); }).filter(Boolean) : [];
    const author = authorCol >= 0 && row[authorCol] ? String(row[authorCol]).trim() : '書斎の主';
    const rawDate = dateCol >= 0 ? row[dateCol] : '';
    const date = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rawDate || '').trim();
    const rawEpCount = episodesCol >= 0 && row[episodesCol] ? parseInt(String(row[episodesCol]).replace(/[^0-9]/g, ''), 10) : undefined;
    const episodeCount = !isNaN(rawEpCount) ? rawEpCount : undefined;

    works.push({
      id: docId || ('work_' + r),
      title: title,
      type: isShort ? 'short' : 'series',
      summary: summary,
      author: author,
      tags: tags,
      updatedAt: date,
      createdAt: date,
      docUrl: rawUrl.indexOf('http') === 0 ? rawUrl : undefined,
      episodeCount: episodeCount,
      rowIndex: r,
      episodes: []
    });
  }

  return works;
}

/**
 * 原稿を取得（純粋読み取り専用 Docs API & 複数フォールバック）
 */
function getDocumentContent(rawDocId) {
  let docId = String(rawDocId).trim();
  // もしURLごと渡されていた場合は安全にIDを抽出
  if (docId.indexOf('/') !== -1) {
    const match = docId.match(/\\/d\\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) docId = match[1];
  }

  // 方法 1: Google Docs 高級サービス (Docs API v1) - 最も推奨
  if (typeof Docs !== 'undefined' && Docs.Documents && Docs.Documents.get) {
    try {
      const doc = Docs.Documents.get(docId, { includeTabsContent: true });
      return parseDocTabs(doc, docId);
    } catch (e) {
      Logger.log('Docs Advanced Service error: ' + e);
    }
  }

  // 方法 2: UrlFetchApp による Docs REST API 呼び出し (documents.readonly)
  try {
    const token = ScriptApp.getOAuthToken();
    const url = 'https://docs.googleapis.com/v1/documents/' + encodeURIComponent(docId) + '?includeTabsContent=true';
    const resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      const doc = JSON.parse(resp.getContentText());
      return parseDocTabs(doc, docId);
    } else {
      Logger.log('UrlFetch response (' + resp.getResponseCode() + '): ' + resp.getContentText());
    }
  } catch (e) {
    Logger.log('UrlFetch failed: ' + e);
  }

  // 方法 3: DocumentApp によるフォールバック (もし auth/documents 権限が許可されている場合)
  try {
    if (typeof DocumentApp !== 'undefined') {
      const doc = DocumentApp.openById(docId);
      return parseViaDocumentApp(doc, docId);
    }
  } catch (e) {
    Logger.log('DocumentApp fallback error: ' + e);
  }

  throw new Error('Google Docs 閲覧権限エラー (403): GASエディタの左メニュー [サービス(+)] から "Google Docs API" を追加するか、対象ドキュメントの共有設定（閲覧権限）をご確認ください。');
}

/**
 * Docs REST API のタブ構造を解析
 */
function parseDocTabs(doc, docId) {
  const docTitle = doc.title || '無題原稿';
  const episodes = [];

  if (doc.tabs && Array.isArray(doc.tabs) && doc.tabs.length > 0) {
    let orderIndex = 1;
    function processTab(tab) {
      const props = tab.tabProperties || {};
      const tabId = props.tabId || ('tab_' + orderIndex);
      const tabTitle = props.title || ('第' + orderIndex + '話');
      const content = tab.documentTab && tab.documentTab.body ? tab.documentTab.body.content : [];
      const blocks = parseBlocks(content);
      const wordCount = blocks.reduce(function(acc, b) { return acc + b.text.replace(/\\s+/g, '').length; }, 0);

      episodes.push({
        tabId: tabId,
        title: tabTitle,
        order: orderIndex++,
        wordCount: wordCount,
        blocks: blocks
      });

      if (tab.childTabs && Array.isArray(tab.childTabs)) {
        tab.childTabs.forEach(processTab);
      }
    }
    doc.tabs.forEach(processTab);
  } else {
    const content = doc.body ? doc.body.content : [];
    const blocks = parseBlocks(content);
    const wordCount = blocks.reduce(function(acc, b) { return acc + b.text.replace(/\\s+/g, '').length; }, 0);

    episodes.push({
      tabId: 'root',
      title: docTitle,
      order: 1,
      wordCount: wordCount,
      blocks: blocks
    });
  }

  return {
    docId: docId,
    title: docTitle,
    episodes: episodes
  };
}

/**
 * DocumentApp フォールバック解析
 */
function parseViaDocumentApp(doc, docId) {
  const docTitle = doc.getName() || '無題原稿';
  const body = doc.getBody();
  const numChildren = body.getNumChildren();
  const blocks = [];

  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    const type = child.getType();
    if (type === DocumentApp.ElementType.PARAGRAPH) {
      const p = child.asParagraph();
      const heading = p.getHeading();
      const text = p.getText().replace(/\\r/g, '').replace(/\\n$/, '');
      if (!text.trim() && blocks.length > 0 && !blocks[blocks.length - 1].text.trim()) {
        continue;
      }
      let blockType = 'NORMAL_TEXT';
      if (heading === DocumentApp.ParagraphHeading.HEADING1 || heading === DocumentApp.ParagraphHeading.TITLE) {
        blockType = 'HEADING_1';
      } else if (heading === DocumentApp.ParagraphHeading.HEADING2 || heading === DocumentApp.ParagraphHeading.SUBTITLE) {
        blockType = 'HEADING_2';
      }
      blocks.push({ type: blockType, text: text });
    }
  }

  const wordCount = blocks.reduce(function(acc, b) { return acc + b.text.replace(/\\s+/g, '').length; }, 0);

  return {
    docId: docId,
    title: docTitle,
    episodes: [{
      tabId: 'root',
      title: docTitle,
      order: 1,
      wordCount: wordCount,
      blocks: blocks
    }]
  };
}

function parseBlocks(contentList) {
  if (!contentList || !Array.isArray(contentList)) return [];
  const blocks = [];

  for (let i = 0; i < contentList.length; i++) {
    const elem = contentList[i];
    if (!elem.paragraph) continue;

    const p = elem.paragraph;
    const style = (p.paragraphStyle && p.paragraphStyle.namedStyleType) || 'NORMAL_TEXT';
    let text = '';
    if (p.elements && Array.isArray(p.elements)) {
      for (let j = 0; j < p.elements.length; j++) {
        if (p.elements[j].textRun && p.elements[j].textRun.content) {
          text += p.elements[j].textRun.content;
        }
      }
    }

    const cleanText = text.replace(/\\r/g, '').replace(/\\n$/, '');
    if (!cleanText.trim() && blocks.length > 0 && !blocks[blocks.length - 1].text.trim()) {
      continue;
    }

    let type = 'NORMAL_TEXT';
    if (style === 'HEADING_1' || style === 'TITLE') type = 'HEADING_1';
    else if (style === 'HEADING_2' || style === 'SUBTITLE') type = 'HEADING_2';

    blocks.push({ type: type, text: cleanText });
  }

  return blocks;
}

/**
 * ハイライト・メモ機能 (スプレッドシート連携)
 */
var HIGHLIGHT_HEADERS = [
  'id', 'workId', 'tabId', 'paragraphIndex', 'selectedText',
  'memoText', 'color', 'authorEmail', 'authorName', 'createdAt',
  'textColor', 'emoji', 'reactionCount', 'kind', 'workTitle', 'tabTitle'
];

function getHighlightsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Highlights');
  if (!sheet) {
    sheet = ss.insertSheet('Highlights');
  }
  // 旧バージョンで作られたシート(10列ヘッダー)でも、K〜P列のヘッダーを自動補完する
  const headerRange = sheet.getRange(1, 1, 1, HIGHLIGHT_HEADERS.length);
  const current = headerRange.getValues()[0];
  let needsUpdate = false;
  for (let i = 0; i < HIGHLIGHT_HEADERS.length; i++) {
    if (String(current[i] || '') !== HIGHLIGHT_HEADERS[i]) { needsUpdate = true; break; }
  }
  if (needsUpdate) headerRange.setValues([HIGHLIGHT_HEADERS]);
  return sheet;
}

function cellToDateString(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  return String(v || '');
}

function parseHighlightRow(r) {
  return {
    id: String(r[0]),
    workId: String(r[1]),
    tabId: String(r[2]),
    paragraphIndex: Number(r[3]),
    selectedText: String(r[4] || ''),
    memoText: String(r[5] || ''),
    color: String(r[6] || '#60A5FA'),
    authorEmail: String(r[7] || ''),
    authorName: String(r[8] || ''),
    createdAt: cellToDateString(r[9]),
    textColor: String(r[10] || '#60A5FA'),
    emoji: r[11] ? String(r[11]) : undefined,
    reactionCount: r[11] ? (Number(r[12]) || 1) : undefined,
    kind: r[13] ? String(r[13]) : 'highlight',
    workTitle: r[14] ? String(r[14]) : undefined,
    tabTitle: r[15] ? String(r[15]) : undefined
  };
}

function getHighlightsFromSheet(workId, tabId) {
  const sheet = getHighlightsSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[1]) === String(workId) && String(r[2]) === String(tabId)) {
      result.push(parseHighlightRow(r));
    }
  }
  return result;
}

function getAllHighlightsFromSheet() {
  const sheet = getHighlightsSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    result.push(parseHighlightRow(rows[i]));
  }
  return result;
}

/**
 * 1行ぶんの値を組み立て、全セルをプレーンテキスト書式にして追記する。
 * (日付の自動変換・「=」始まりの数式解釈を防ぐ)
 */
function buildHighlightRow(p, id, reactionCount) {
  return [
    id,
    p.workId || '',
    p.tabId || '',
    p.paragraphIndex !== undefined && p.paragraphIndex !== '' ? Number(p.paragraphIndex) : 0,
    p.selectedText || '',
    p.memoText || '',
    p.color || '#60A5FA',
    String(p.authorEmail || '').trim().toLowerCase(),
    p.authorName || '',
    p.createdAt || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd'),
    p.textColor || p.color || '#60A5FA',
    p.emoji || '',
    reactionCount !== undefined && reactionCount !== '' ? Number(reactionCount) : '',
    p.kind || 'highlight',
    p.workTitle || '',
    p.tabTitle || ''
  ];
}

function appendHighlightRow(sheet, values) {
  const rowNo = sheet.getLastRow() + 1;
  const range = sheet.getRange(rowNo, 1, 1, values.length);
  range.setNumberFormat('@');
  range.setValues([values]);
}

/**
 * ハイライト/メモ/コメント追加。id が既にあれば行を増やさず上書き(upsert)。
 */
function addHighlightToSheet(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getHighlightsSheet();
    const id = p.id || Utilities.getUuid();
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        if (String(rows[i][7]).trim().toLowerCase() !== String(p.authorEmail || '').trim().toLowerCase()) {
          throw new Error('他のユーザーの投稿は編集できません。');
        }
        const values = buildHighlightRow(p, id, p.reactionCount);
        const range = sheet.getRange(i + 1, 1, 1, values.length);
        range.setNumberFormat('@');
        range.setValues([values]);
        return id;
      }
    }
    appendHighlightRow(sheet, buildHighlightRow(p, id, p.reactionCount));
    return id;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 絵文字リアクション(ウェブ拍手)。
 * 「作品・話・段落・選択文・絵文字・投稿者」が同じ行があれば reactionCount を +1、無ければ新規作成。
 * targetId が自分の行を指していれば、その行を直接 +1。
 */
function reactToSheet(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getHighlightsSheet();
    const rows = sheet.getDataRange().getValues();
    const author = String(p.authorEmail || '').trim().toLowerCase();
    const emoji = String(p.emoji || '');
    if (!emoji) throw new Error('emoji が必要です。');

    let found = -1;
    if (p.targetId) {
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(p.targetId) &&
            String(rows[i][7]).trim().toLowerCase() === author &&
            String(rows[i][11]) === emoji) { found = i; break; }
      }
    }
    if (found < 0) {
      const para = Number(p.paragraphIndex);
      for (let i = rows.length - 1; i >= 1; i--) {
        const r = rows[i];
        if (String(r[1]) === String(p.workId) &&
            String(r[2]) === String(p.tabId) &&
            Number(r[3]) === para &&
            String(r[4]) === String(p.selectedText || '') &&
            String(r[11]) === emoji &&
            String(r[7]).trim().toLowerCase() === author &&
            !String(r[5] || '')) { found = i; break; }
      }
    }

    if (found >= 0) {
      const newCount = (Number(rows[found][12]) || 1) + 1;
      const cell = sheet.getRange(found + 1, 13);
      cell.setNumberFormat('@');
      cell.setValue(newCount);
      return { id: String(rows[found][0]), reactionCount: newCount };
    }

    const id = p.id || Utilities.getUuid();
    appendHighlightRow(sheet, buildHighlightRow(p, id, 1));
    return { id: id, reactionCount: 1 };
  } finally {
    lock.releaseLock();
  }
}

function deleteHighlightFromSheet(id, email) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getHighlightsSheet();
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][0]) === String(id)) {
        if (String(rows[i][7]).trim().toLowerCase() !== String(email || '').trim().toLowerCase()) {
          throw new Error('他のユーザーの投稿は削除できません。');
        }
        sheet.deleteRow(i + 1);
        break;
      }
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * 【1回だけ手動実行】過去のバグで増えた重複行を整理する。
 *  1) 同じ id の行 → reactionCount が最大の1行だけ残す
 *  2) 同じ (作品,話,段落,選択文,絵文字,投稿者) の絵文字単体行 → カウントを合算して1行に統合
 * GASエディタで関数 cleanupDuplicateHighlights を選んで実行 → ログに結果が出ます。
 * 実行前にスプレッドシートのコピーを取っておくと安心です。
 */
function cleanupDuplicateHighlights() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getHighlightsSheet();
    const rows = sheet.getDataRange().getValues();
    const toDelete = {};
    const newCounts = {};

    // 1) 同一 id
    const byId = {};
    for (let i = 1; i < rows.length; i++) {
      const id = String(rows[i][0]);
      const cnt = Number(rows[i][12]) || 0;
      if (byId[id] === undefined) { byId[id] = i; continue; }
      const keep = byId[id];
      if (cnt > (Number(rows[keep][12]) || 0)) { toDelete[keep] = true; byId[id] = i; }
      else { toDelete[i] = true; }
    }

    // 2) 絵文字単体行の統合
    const byKey = {};
    for (let i = 1; i < rows.length; i++) {
      if (toDelete[i]) continue;
      const r = rows[i];
      if (!r[11] || r[5]) continue;
      const key = [r[1], r[2], r[3], r[4], r[11], String(r[7]).trim().toLowerCase()].join('||');
      if (byKey[key] === undefined) { byKey[key] = i; continue; }
      const keep = byKey[key];
      newCounts[keep] = (newCounts[keep] || Number(rows[keep][12]) || 1) + (Number(r[12]) || 1);
      toDelete[i] = true;
    }

    Object.keys(newCounts).forEach(function(k) {
      sheet.getRange(Number(k) + 1, 13).setValue(newCounts[k]);
    });
    const del = Object.keys(toDelete).map(Number).sort(function(a, b) { return b - a; });
    del.forEach(function(i) { sheet.deleteRow(i + 1); });

    Logger.log('削除した重複行: ' + del.length + ' / カウント統合: ' + Object.keys(newCounts).length);
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// 初回スコープ承認用ダミー関数（GASエディタで実行して承認を完了させる）
function authorizeNow() {
  Logger.log('OAuth Scopes:');
  Logger.log(ScriptApp.getOAuthToken());
}`;
