document.addEventListener('DOMContentLoaded', async () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const clearLogBtn = document.getElementById('clearLogBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const detailedMode = document.getElementById('detailedMode');
    const logBox = document.getElementById('logBox');
    const progressDiv = document.getElementById('progress');
    const historyInfoDiv = document.getElementById('historyInfo');
  
    let fileList = [];
    let extList = [];
    let targets = [];
    let results = [];
    let currentIndex = 0;
    let total = 0;
    let isStopped = false;
    let scanning = false;
    let currentOrigin = "";
  
    // 別ファイルからスキャン対象リストをロード
    async function loadLists() {
      try {
        const fileListUrl = chrome.runtime.getURL('fileList.json');
        const extListUrl = chrome.runtime.getURL('extensionList.json');
        const res1 = await fetch(fileListUrl);
        fileList = await res1.json();
        const res2 = await fetch(extListUrl);
        extList = await res2.json();
      } catch (err) {
        log(`Error loading lists: ${err}`, true);
      }
    }
  
    // ログ出力（詳細モードの場合は常に出力）
    function log(message, always = false) {
      if (detailedMode.checked || always) {
        logBox.value += message + "\n";
      }
    }
  
    // 進捗表示更新
    function updateProgress() {
      const progress = total ? Math.floor((currentIndex / total) * 100) : 0;
      progressDiv.textContent = `Progress: ${progress}% (${currentIndex}/${total})`;
    }
  
    // 状態の保存（進捗用）
    function saveProgressState() {
      const state = { currentIndex, total, results, log: logBox.value, origin: currentOrigin };
      chrome.storage.local.set({ scanProgress: state });
    }
  
    // スキャン完了時の履歴保存
    function saveHistory() {
      const entry = {
        lastScan: new Date().toISOString(),
        results,
        log: logBox.value
      };
      // scanHistory はドメインごとのオブジェクトとして保存
      chrome.storage.local.get('scanHistory', data => {
        const history = data.scanHistory || {};
        history[currentOrigin] = entry;
        chrome.storage.local.set({ scanHistory: history });
        displayHistory(entry);
      });
    }
  
    // 状態の読み込み（進捗用）
    async function loadProgressState() {
      return new Promise(resolve => {
        chrome.storage.local.get('scanProgress', data => {
          resolve(data.scanProgress || null);
        });
      });
    }
  
    // 現在のタブのオリジンからスキャン対象の URL リストを生成
    async function buildTargets(origin) {
      targets = [];
      fileList.forEach(filePath => {
        extList.forEach(ext => {
          targets.push(`${origin}${filePath}${ext}`);
        });
      });
      total = targets.length;
    }
  
    // 過去のスキャン履歴の読み込み・表示
    async function loadHistoryForDomain(origin) {
      chrome.storage.local.get('scanHistory', data => {
        const history = data.scanHistory || {};
        if (history[origin]) {
          displayHistory(history[origin]);
        } else {
          historyInfoDiv.textContent = "No previous scan history found for this domain.";
        }
      });
    }
  
    function displayHistory(entry) {
      const dateStr = new Date(entry.lastScan).toLocaleString();
      historyInfoDiv.textContent = `Last Scan: ${dateStr}\nFound URLs: ${JSON.stringify(entry.results)}\nLog:\n${entry.log}`;
    }
  
    /**
     * メインのスキャン処理
     * @param {boolean} clearLog - true の場合はログをクリア、false の場合は既存ログに追記する
     */
    async function scanDomain(clearLog = true) {
      scanning = true;
      if (clearLog) {
        logBox.value = "";
      }
      log("Starting scan...", true);
  
      // 現在のタブを取得
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        log("No active tab found.", true);
        scanning = false;
        return;
      }
      const tab = tabs[0];
      const urlObj = new URL(tab.url);
      currentOrigin = urlObj.origin;
  
      // 新規スキャンの場合は targets 再構築
      if (currentIndex === 0) {
        await buildTargets(currentOrigin);
        results = [];
      }
  
      for (; currentIndex < total; currentIndex++) {
        if (isStopped) {
          log("Scan stopped.", true);
          saveProgressState();
          scanning = false;
          return;
        }
  
        const target = targets[currentIndex];
        try {
          const response = await fetch(target, { method: 'HEAD' });
          if (response.status === 200) {
            results.push(target);
            log(`200 OK: ${target}`, true);
          } else {
            log(`Not found (${response.status}): ${target}`);
          }
        } catch (err) {
          log(`Error scanning ${target}: ${err}`);
        }
        updateProgress();
        saveProgressState();
        // スキャン間隔（ここでは 500ms）
        await new Promise(r => setTimeout(r, 500));
      }
      log("Scan complete.", true);
      // 完了時は進捗状態を削除し、履歴として保存
      chrome.storage.local.remove('scanProgress');
      saveHistory();
      scanning = false;
    }
  
    // Start ボタン押下時：保存状態があれば再開、なければ新規開始
    startBtn.addEventListener('click', async () => {
      isStopped = false;
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        log("No active tab found.", true);
        return;
      }
      const tab = tabs[0];
      const urlObj = new URL(tab.url);
      currentOrigin = urlObj.origin;
  
      // まず、過去のスキャン履歴を表示
      loadHistoryForDomain(currentOrigin);
  
      const saved = await loadProgressState();
      if (saved && saved.origin === currentOrigin && saved.currentIndex < saved.total) {
        // 保存された進捗がある場合、状態を復元して表示（ログはクリアせずそのまま利用）
        currentIndex = saved.currentIndex;
        total = saved.total;
        results = saved.results;
        logBox.value = saved.log;
        updateProgress();
        log("Loaded saved scan progress.", true);
        // resume 状態の場合はログをクリアしない
        scanDomain(false);
      } else {
        currentIndex = 0;
        results = [];
        await loadLists();
        await buildTargets(currentOrigin);
        scanDomain(true);
      }
    });
  
    // Stop ボタン押下時：フラグを立ててループを中断
    stopBtn.addEventListener('click', () => {
      if (scanning) {
        isStopped = true;
      }
    });
  
    // Resume ボタン押下時：保存状態があれば再開（既存ログを維持して追記）
    resumeBtn.addEventListener('click', async () => {
      const saved = await loadProgressState();
      if (saved && saved.origin === currentOrigin && saved.currentIndex < saved.total) {
        currentIndex = saved.currentIndex;
        results = saved.results;
        isStopped = false;
        scanDomain(false);
      } else {
        log("No saved progress to resume.", true);
      }
    });
  
    // Clear Log ボタン押下時：ログテキストエリアをクリア
    clearLogBtn.addEventListener('click', () => {
      logBox.value = "";
    });
  
    // Clear History ボタン押下時：現在のドメインのスキャン履歴を削除
    clearHistoryBtn.addEventListener('click', () => {
      chrome.storage.local.get('scanHistory', data => {
        const history = data.scanHistory || {};
        if (history[currentOrigin]) {
          delete history[currentOrigin];
          chrome.storage.local.set({ scanHistory: history }, () => {
            historyInfoDiv.textContent = "Scan history cleared for this domain.";
          });
        } else {
          historyInfoDiv.textContent = "No scan history found for this domain.";
        }
      });
    });
  
    // popup が閉じられる際にも現在の状態を保存する（自動保存）
    window.addEventListener("unload", () => {
      saveProgressState();
    });
  
    // 初期化：現在のタブのオリジンに対する過去履歴および進捗状態を読み込む
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      const urlObj = new URL(tab.url);
      currentOrigin = urlObj.origin;
      loadHistoryForDomain(currentOrigin);
      // 既に保存された進捗があれば読み込み、表示する
      const savedProgress = await loadProgressState();
      if (savedProgress && savedProgress.origin === currentOrigin) {
        currentIndex = savedProgress.currentIndex;
        total = savedProgress.total;
        results = savedProgress.results;
        logBox.value = savedProgress.log;
        updateProgress();
      }
    }
  });
  