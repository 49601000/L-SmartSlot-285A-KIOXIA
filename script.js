document.addEventListener("DOMContentLoaded", () => {

  // --- 株価 & IR データベース ---
  const STOCK_DATA_HISTORY = [
    { date: "2025/02/10", p285A: "6,210", diff285A: "▲ +12 (+0.19%)", open: "6,180", high: "6,250", low: "6,150", vol: "10,210,000", type: "normal" },
    { date: "2025/02/12", p285A: "6,280", diff285A: "▲ +70 (+1.12%)", open: "6,210", high: "6,310", low: "6,190", vol: "11,500,000", type: "coop" },
    { date: "2025/02/13", p285A: "6,190", diff285A: "▼ -90 (-1.43%)", open: "6,280", high: "6,290", low: "6,150", vol: "14,100,000", type: "alone" },
    { date: "2025/02/14", p285A: "6,329", diff285A: "▲ +139 (+2.24%)", open: "6,210", high: "6,350", low: "6,180", vol: "12,459,300", type: "surge" }
  ];

  // --- 実株価履歴（data/285A_daily_close.json） ---
  // 読み込めた場合はこちらが正（終値のみ・分割調整後）。JSONは日次終値しか持たないため、
  // 始値・出来高のような当日データは表示しない。読めない環境（file://直開き等）では
  // 上の STOCK_DATA_HISTORY（サンプル表示）にフォールバックする。
  let priceHistory = null;

  // --- 掲示板データ（data/board/、scripts/normalize_board_data.py で生成） ---
  // 営業日キーで index.json が引け、その日のファイルに実在の投稿が入っている。
  // 投稿は原文のまま・時系列順にローテーション表示する（後知恵で改変しない）。
  let boardIndex = null;
  const boardCache = {};
  let boardPosts = null;
  let boardCursor = 0;
  let boardTimer = null;
  let boardDay = null;
  let boardBgSourceDay = null;

  // --- ステージ定義（正本は data/stages.json。読めない環境向けに同内容を内蔵） ---
  // 区切りは実チャートのダイジェスト日付（docs/PRESENTATION_SPEC.md のステージ設計）。
  const FALLBACK_STAGES = [
    { id: 0, from: "2024-12-18", to: "2025-08-31", name: "上場・底ばい", tone: "base" },
    { id: 1, from: "2025-09-01", to: "2025-11-10", name: "初動ブレイク", tone: "rise" },
    { id: 2, from: "2025-11-11", to: "2026-04-09", name: "調整・A前のベース", tone: "base" },
    { id: 3, from: "2026-04-10", to: "2026-06-10", name: "上昇・左肩A", tone: "rise" },
    { id: 4, from: "2026-06-11", to: "2026-06-22", name: "大天井B", tone: "peak" },
    { id: 5, from: "2026-06-23", to: "2026-07-29", name: "急落①→②", tone: "crash" },
    { id: 6, from: "2026-07-30", to: "2026-10-02", name: "右肩C・戻り", tone: "recover" },
    { id: 7, from: "2026-10-03", to: "2026-10-30", name: "下落継続", tone: "crash" }
  ];
  let stages = FALLBACK_STAGES;
  let currentStageId = null;

  const IR_EVENTS = [
    { title: "好決算発表！", sub: "純利益が市場予想を大幅上回り！", type: "good" },
    { title: "材料出尽くし...", sub: "好決算発表も寄り付きから大暴落", type: "bad" },
    { title: "NAND供給逼迫！", sub: "データセンター需要急増で単価上昇", type: "good" },
    { title: "サムスン増産報道", sub: "競合の供給増懸念で市況冷え込み", type: "bad" },
    { title: "設備投資拡大（CAPEX）", sub: "次世代NAND工場へ数千億円投入", type: "warn" }
  ];

  // ゲーム状態管理
  const state = {
    credit: 1000,
    payout: 0,
    totalG: 0,
    mode: "NORMAL",
    atNav: 0,
    czGames: 0,
    isSpinning: [false, false, false],
    stoppedReels: [false, false, false],
    reelResults: [0, 0, 0],
    stockIndex: 3,
    lastChangePct: 0,
    pendingFlag: null,
    spinInterval: null
  };

  // DOM要素の安全な取得
  const elCredit = document.getElementById("valCredit");
  const elPayout = document.getElementById("valPayout");
  const elAtNav = document.getElementById("valAtNav");
  const elTotalG = document.getElementById("valTotalG");
  const elIrTicker = document.getElementById("irTicker");

  const elPrice285A = document.getElementById("price285A");
  const elDate = document.getElementById("valDate");
  const elTicker285A = document.getElementById("ticker285A");
  const elDiff285A = document.getElementById("diff285A");
  const elOpen = document.getElementById("valOpen");
  const elHigh = document.getElementById("valHigh");
  const elLow = document.getElementById("valLow");
  const elVolume = document.getElementById("valVolume");

  const elBoardBar = document.getElementById("boardBar");
  const elBoardLabel = document.getElementById("boardLabel");
  const elBoardPost = document.getElementById("boardPost");
  const elMainScreen = document.getElementById("mainScreen");
  const elStageBadge = document.getElementById("stageBadge");
  const elBoardBg = document.getElementById("boardBg");

  const elScreenEffect = document.getElementById("screenEffect");
  const elEffectTitle = document.getElementById("effectTitle");
  const elEffectSub = document.getElementById("effectSub");

  const btnLever = document.getElementById("btnLever");
  const btnStops = [
    document.getElementById("btnStop1"),
    document.getElementById("btnStop2"),
    document.getElementById("btnStop3")
  ];

  function fmtPrice(n) {
    return n.toLocaleString("ja-JP", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  // ステージ判定と表示（バッジ＋液晶のトーン）
  function stageForDate(dateStr) {
    for (const s of stages) {
      if (dateStr >= s.from && dateStr <= s.to) return s;
    }
    return null;
  }

  const TONE_CLASSES = ["tone-base", "tone-rise", "tone-peak", "tone-crash", "tone-recover"];

  function updateStageUI(dateStr) {
    const s = stageForDate(dateStr);
    if (!s) return;
    currentStageId = s.id;
    if (elStageBadge) {
      elStageBadge.textContent = `STAGE ${s.id} ${s.name}`;
      elStageBadge.className = `stage-badge stage-overlay tone-${s.tone}`;
    }
    if (elMainScreen) {
      elMainScreen.classList.remove(...TONE_CLASSES);
      if (s.tone !== "base") elMainScreen.classList.add(`tone-${s.tone}`);
    }
  }

  async function loadStages() {
    try {
      const res = await fetch("data/stages.json");
      if (!res.ok) return;
      const json = await res.json();
      if (json && Array.isArray(json.stages) && json.stages.length > 0) {
        stages = json.stages;
        const cur = priceHistory ? priceHistory[state.stockIndex] : null;
        if (cur) updateStageUI(cur.date);
      }
    } catch (e) {
      // 内蔵定義のまま動作する
    }
  }

  // 株価ダッシュボード更新（エラー回避の安全設計）
  // 実データ連携時: 1ゲーム = 1営業日。state.stockIndex が対象営業日を指す。
  function updateStockBoard() {
    if (priceHistory) {
      const i = state.stockIndex;
      const cur = priceHistory[i];
      if (!cur) return;
      const prev = i > 0 ? priceHistory[i - 1] : null;

      let high = -Infinity, low = Infinity;
      for (let k = 0; k <= i; k++) {
        if (priceHistory[k].close > high) high = priceHistory[k].close;
        if (priceHistory[k].close < low) low = priceHistory[k].close;
      }

      if (elDate) elDate.textContent = cur.date.replace(/-/g, "/");
      if (elPrice285A) elPrice285A.textContent = fmtPrice(cur.close);

      if (prev) {
        const diff = cur.close - prev.close;
        const pct = (diff / prev.close) * 100;
        const arrow = diff >= 0 ? "▲" : "▼";
        const sign = diff >= 0 ? "+" : "-";
        const diffText = `${arrow} ${sign}${fmtPrice(Math.abs(diff))} (${sign}${Math.abs(pct).toFixed(2)}%)`;
        if (elDiff285A) {
          elDiff285A.textContent = diffText;
          elDiff285A.className = `stock-diff ${diff >= 0 ? 'plus' : 'minus'}`;
        }
        if (elTicker285A) {
          elTicker285A.textContent = `${fmtPrice(cur.close)} ${arrow}${sign}${fmtPrice(Math.abs(diff))}`;
          elTicker285A.className = diff >= 0 ? 'plus' : 'minus';
        }
        state.lastChangePct = pct;
      } else {
        if (elDiff285A) {
          elDiff285A.textContent = "— （上場日）";
          elDiff285A.className = "stock-diff plus";
        }
        if (elTicker285A) {
          elTicker285A.textContent = `${fmtPrice(cur.close)} （上場日）`;
          elTicker285A.className = 'plus';
        }
        state.lastChangePct = 0;
      }

      if (elOpen) elOpen.textContent = prev ? fmtPrice(prev.close) : "—";
      if (elHigh) elHigh.textContent = fmtPrice(high);
      if (elLow) elLow.textContent = fmtPrice(low);
      if (elVolume) elVolume.textContent = `${i + 1} / ${priceHistory.length}`;
      updateStageUI(cur.date);
      syncBoardToDay(cur.date);
      return;
    }

    const data = STOCK_DATA_HISTORY[state.stockIndex];
    if (!data) return;

    if (elDate) elDate.textContent = data.date;
    if (elPrice285A) elPrice285A.textContent = data.p285A;
    if (elDiff285A) {
      elDiff285A.textContent = data.diff285A;
      elDiff285A.className = `stock-diff ${data.diff285A.includes('▲') ? 'plus' : 'minus'}`;
    }
    if (elTicker285A) {
      elTicker285A.textContent = `${data.p285A} ${data.diff285A.split(' ')[0]}${data.diff285A.split(' ')[1] || ''}`;
      elTicker285A.className = data.diff285A.includes('▲') ? 'plus' : 'minus';
    }
    if (elOpen) elOpen.textContent = data.open;
    if (elHigh) elHigh.textContent = data.high;
    if (elLow) elLow.textContent = data.low;
    if (elVolume) elVolume.textContent = data.vol;
    updateStageUI(data.date.replace(/\//g, "-"));

    if (elIrTicker) {
      if (data.type === "alone") {
        elIrTicker.textContent = "【株価警告】SNDK急騰も285A下落...『おいてけぼりZONE』示唆！";
      } else if (data.type === "coop") {
        elIrTicker.textContent = "【市況追風】日米NAND同時高！『日米NAND共闘』演出発生！";
      } else {
        elIrTicker.textContent = "【IR速報】半導体市況監視中。次回決算ガイダンスに要注目。";
      }
    }
  }

  // 抽選ロジック
  function lottery() {
    const rand = Math.random() * 1000;
    if (rand < 15) return { type: "CHERRY_STRONG", pay: 0, name: "強チェリー" };
    if (rand < 50) return { type: "CHERRY_WEAK", pay: 0, name: "弱チェリー" };
    if (rand < 110) return { type: "WATERMELON", pay: 3, name: "スイカ" };
    if (rand < 400) return { type: "BELL", pay: 9, name: "ベル" };
    if (rand < 600) return { type: "REPLAY", pay: 0, name: "リプレイ" };
    return { type: "MISS", pay: 0, name: "ハズレ" };
  }

  // レバーON処理
  if (btnLever) {
    btnLever.addEventListener("click", () => {
      if (state.credit < 3 && state.mode !== "AT" && state.mode !== "SUPER_AT") {
        alert("メダルが不足しています！デバッグボタンで補充してください。");
        return;
      }

      if (state.mode !== "AT" && state.mode !== "SUPER_AT") {
        state.credit -= 3;
      }
      state.payout = 0;
      state.totalG++;

      // 1ゲームで1営業日進む。最終営業日の次は上場日へ巻き戻す（デモ仕様）。
      const stockLen = priceHistory ? priceHistory.length : STOCK_DATA_HISTORY.length;
      state.stockIndex = (state.stockIndex + 1) % stockLen;
      updateStockBoard();

      const flag = lottery();
      state.pendingFlag = flag;

      btnLever.disabled = true;
      btnStops.forEach(btn => { if(btn) btn.disabled = false; });

      state.isSpinning = [true, true, true];
      state.stoppedReels = [false, false, false];
      startReelSpin();

      triggerScreenEffect(flag);
      updateUI();
    });
  }

  // リール回転
  function startReelSpin() {
    for (let i = 1; i <= 3; i++) {
      const strip = document.getElementById(`strip${i}`);
      if (strip) {
        strip.style.transition = "none";
        strip.style.transform = "translateY(-120px)";
      }
    }

    if (state.spinInterval) clearInterval(state.spinInterval);

    state.spinInterval = setInterval(() => {
      for (let i = 1; i <= 3; i++) {
        if (state.isSpinning[i - 1]) {
          const strip = document.getElementById(`strip${i}`);
          if (strip) {
            const currentTop = parseInt(strip.style.transform.replace("translateY(", "").replace("px)", "")) || 0;
            let newTop = currentTop + 20;
            if (newTop >= 0) newTop = -120;
            strip.style.transform = `translateY(${newTop}px)`;
          }
        }
      }
    }, 20);
  }

  // ストップボタン
  btnStops.forEach((btn, idx) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (!state.isSpinning[idx]) return;

      state.isSpinning[idx] = false;
      state.stoppedReels[idx] = true;
      btn.disabled = true;

      determineSymbol(idx);

      if (state.stoppedReels.every(v => v)) {
        clearInterval(state.spinInterval);
        if (btnLever) btnLever.disabled = false;
        evaluateRound();
      }
    });
  });

  function determineSymbol(reelIdx) {
    const flag = state.pendingFlag;
    let symbolId = 1;

    if (flag.type === "BELL") symbolId = 2;
    else if (flag.type === "REPLAY") symbolId = 3;
    else if (flag.type === "CHERRY_WEAK" || flag.type === "CHERRY_STRONG") symbolId = 4;
    else if (flag.type === "WATERMELON") symbolId = 5;
    else if (state.mode === "AT" && Math.random() < 0.2) symbolId = 0;

    state.reelResults[reelIdx] = symbolId;

    const strip = document.getElementById(`strip${reelIdx + 1}`);
    if (strip) {
      strip.style.transition = "transform 0.1s ease-out";
      strip.style.transform = `translateY(-${symbolId * 40}px)`;
    }
  }

  // 演出制御
  function triggerScreenEffect(flag) {
    if (!elScreenEffect) return;
    elScreenEffect.className = "screen-effect";

    if (Math.random() < 0.3) {
      const ir = IR_EVENTS[Math.floor(Math.random() * IR_EVENTS.length)];
      if (elEffectTitle) elEffectTitle.textContent = ir.title;
      if (elEffectSub) elEffectSub.textContent = ir.sub;
      if (ir.type === "good") elScreenEffect.classList.add("flash-gold");
      else if (ir.type === "bad") elScreenEffect.classList.add("flash-red");
      return;
    }

    if (flag.type === "CHERRY_STRONG") {
      if (elEffectTitle) elEffectTitle.textContent = "🚨 強NAND需要検出！";
      if (elEffectSub) elEffectSub.textContent = "CZ「NAND品薄CHANCE」大チャンス！";
      elScreenEffect.classList.add("flash-red");
    } else if (flag.type === "WATERMELON") {
      if (elEffectTitle) elEffectTitle.textContent = "🍉 設備投資ログ確認";
      if (elEffectSub) elEffectSub.textContent = "市況好転の兆し...？";
    } else {
      if (elEffectTitle) elEffectTitle.textContent = "RUSH";
      if (elEffectSub) elEffectSub.textContent = "【IR速報】市況監視中...";
    }
  }

  // ラウンド評価
  function evaluateRound() {
    const flag = state.pendingFlag;
    state.payout = flag.pay;
    state.credit += flag.pay;

    if (state.mode === "NORMAL") {
      if (flag.type === "CHERRY_STRONG" || Math.random() < 0.08) {
        state.mode = "CZ";
        state.czGames = 5;
        if (elEffectTitle) elEffectTitle.textContent = "🔥 NAND品薄CHANCE";
        if (elEffectSub) elEffectSub.textContent = "5G以内にNAND価格を急騰させよ！";
      }
    } else if (state.mode === "CZ") {
      state.czGames--;
      if (flag.type === "BELL" || flag.type === "CHERRY_STRONG" || Math.random() < 0.3) {
        state.mode = "AT";
        state.atNav = 100;
        if (elEffectTitle) elEffectTitle.textContent = "🎉 SUPER CYCLE RUSH";
        if (elEffectSub) elEffectSub.textContent = "初期100枚スタート！半導体バブル到来！";
      } else if (state.czGames <= 0) {
        state.mode = "NORMAL";
        if (elEffectTitle) elEffectTitle.textContent = "RUSH";
        if (elEffectSub) elEffectSub.textContent = "CZ終了... 市況冷え込み";
      }
    } else if (state.mode === "AT" || state.mode === "SUPER_AT") {
      state.atNav -= (flag.pay > 0 ? flag.pay : 1);

      if (flag.type === "CHERRY_STRONG") {
        const add = 50;
        state.atNav += add;
        if (elEffectTitle) elEffectTitle.textContent = `⚡ 上乗せ +${add}枚！`;
        if (elEffectSub) elEffectSub.textContent = "AIデータセンター需要爆発！";
      }

      if (state.mode === "AT" && state.atNav > 150) {
        state.mode = "SUPER_AT";
        if (elEffectTitle) elEffectTitle.textContent = "👑 AI CAPEX BUBBLE";
        if (elEffectSub) elEffectSub.textContent = "極上の設備投資バブルモード！！";
      }

      if (state.atNav <= 0) {
        state.atNav = 0;
        state.mode = "NORMAL";
        if (elEffectTitle) elEffectTitle.textContent = "RUSH";
        if (elEffectSub) elEffectSub.textContent = "AT終了「設備投資回収懸念」";
      }
    }

    updateUI();
  }

  // UI更新
  function updateUI() {
    if (elCredit) elCredit.textContent = state.credit;
    if (elPayout) elPayout.textContent = state.payout;
    if (elAtNav) elAtNav.textContent = state.atNav;
    if (elTotalG) elTotalG.textContent = state.totalG;
  }

  // デバッグボタン処理
  const btnCz = document.getElementById("btnDebugCz");
  if (btnCz) btnCz.addEventListener("click", () => { state.mode = "CZ"; state.czGames = 5; updateUI(); });

  const btnAt = document.getElementById("btnDebugAt");
  if (btnAt) btnAt.addEventListener("click", () => { state.mode = "AT"; state.atNav = 100; updateUI(); });

  const btnAdd = document.getElementById("btnDebugAdd");
  if (btnAdd) btnAdd.addEventListener("click", () => { state.credit += 1000; updateUI(); });

  const btnRst = document.getElementById("btnReset");
  if (btnRst) btnRst.addEventListener("click", () => { state.credit = 1000; state.totalG = 0; state.mode = "NORMAL"; state.atNav = 0; state.stockIndex = priceHistory ? 0 : 3; updateStockBoard(); updateUI(); });

  // 掲示板ローテーション
  function formatBoardPost(p) {
    const txt = p.text.replace(/\s*\n\s*/g, " ").slice(0, 110);
    const datePart = p.date !== boardDay ? `${p.date.slice(5).replace("-", "/")} ` : "";
    return `${datePart}${p.time} No.${p.number} ${txt}`;
  }

  function showBoardPost() {
    if (!elBoardPost || !boardPosts || boardPosts.length === 0) return;
    const p = boardPosts[boardCursor % boardPosts.length];
    boardCursor++;
    elBoardPost.textContent = formatBoardPost(p);
  }

  function stopBoardRotation() {
    if (boardTimer) { clearInterval(boardTimer); boardTimer = null; }
  }

  // 指定した掲示板日の投稿を取得（キャッシュ付き）
  async function fetchBoardPosts(dateStr) {
    if (boardCache[dateStr]) return boardCache[dateStr];
    const entry = boardIndex && boardIndex.days ? boardIndex.days[dateStr] : null;
    if (!entry) { boardCache[dateStr] = []; return boardCache[dateStr]; }
    try {
      const res = await fetch(`data/board/${entry.file}`);
      if (!res.ok) throw new Error("board fetch failed");
      const json = await res.json();
      boardCache[dateStr] = json.posts || [];
    } catch (e) {
      boardCache[dateStr] = [];
    }
    return boardCache[dateStr];
  }

  // 背景プールの日：その日に掲示板データが無ければ、直近の過去の掲示板日を使う
  function boardPoolDay(dateStr) {
    if (!boardIndex || !boardIndex.days) return null;
    const days = Object.keys(boardIndex.days).sort();
    if (days.length === 0) return null;
    let pool = days[0];
    for (const d of days) {
      if (d <= dateStr) pool = d; else break;
    }
    return pool;
  }

  // ステージ背景：掲示板投稿を液晶の背景で下から上へ流し続ける（エンジンAの背景利用）
  async function syncBoardBg(dateStr) {
    if (!elBoardBg || !boardIndex) return;
    const poolDay = boardPoolDay(dateStr);
    if (!poolDay || poolDay === boardBgSourceDay) return;
    const posts = await fetchBoardPosts(poolDay);
    if (boardPoolDay(dateStr) !== poolDay) return; // 取得中に日が進んだ場合は破棄
    if (!posts || posts.length === 0) return;
    boardBgSourceDay = poolDay;

    const MAX_LINES = 90;
    const stride = Math.max(1, Math.floor(posts.length / MAX_LINES));
    const lines = [];
    for (let i = 0; i < posts.length && lines.length < MAX_LINES; i += stride) {
      const p = posts[i];
      const txt = p.text.replace(/\s*\n\s*/g, " ").slice(0, 90);
      lines.push(`${p.time} No.${p.number} ${txt}`);
    }

    // アニメーションを最初から再生するため、内側要素を作り直す
    const old = document.getElementById("boardBgInner");
    const inner = document.createElement("div");
    inner.className = "board-bg-inner";
    inner.id = "boardBgInner";
    for (let copy = 0; copy < 2; copy++) {
      for (const line of lines) {
        const div = document.createElement("div");
        div.className = "board-bg-line";
        div.textContent = line;
        inner.appendChild(div);
      }
    }
    // 1周分（lines.length行 ≒ 13.5px/行）を約9px/秒で流す
    inner.style.animationDuration = `${Math.max(40, (lines.length * 13.5) / 9)}s`;
    if (old) old.replaceWith(inner); else elBoardBg.appendChild(inner);
  }

  async function syncBoardToDay(dateStr) {
    if (dateStr === boardDay) return;
    if (!boardIndex) return; // index読み込み後に loadBoardIndex 側から再同期する
    boardDay = dateStr;
    syncBoardBg(dateStr);
    stopBoardRotation();
    boardPosts = null;
    boardCursor = 0;
    if (!elBoardPost) return;

    const entry = boardIndex && boardIndex.days ? boardIndex.days[dateStr] : null;
    if (!entry) {
      if (elBoardLabel) elBoardLabel.textContent = "掲示板";
      elBoardPost.textContent = "この日の掲示板データはありません";
      if (elBoardBar) elBoardBar.classList.add("board-empty");
      return;
    }
    if (elBoardBar) elBoardBar.classList.remove("board-empty");
    if (elBoardLabel) elBoardLabel.textContent = `掲示板 ${entry.count}件`;
    elBoardPost.textContent = "読み込み中...";

    await fetchBoardPosts(dateStr);
    if (boardDay !== dateStr) return; // 読み込み中に日付が変わった場合は破棄
    boardPosts = boardCache[dateStr];
    if (!boardPosts || boardPosts.length === 0) {
      elBoardPost.textContent = "掲示板データの読み込みに失敗しました";
      return;
    }
    boardCursor = Math.floor(Math.random() * boardPosts.length);
    showBoardPost();
    boardTimer = setInterval(showBoardPost, 4000);
  }

  async function loadBoardIndex() {
    try {
      const res = await fetch("data/board/index.json");
      if (!res.ok) return;
      boardIndex = await res.json();
      if (priceHistory) syncBoardToDay(priceHistory[state.stockIndex].date);
    } catch (e) {
      // 掲示板なしでもゲームは動作する
    }
  }

  // 実株価JSONの読み込み。成功したら上場日（先頭）から表示する。
  // file://直開き等で fetch が失敗した場合はサンプル表示のまま動く。
  async function loadPriceHistory() {
    try {
      const res = await fetch("data/285A_daily_close.json");
      if (!res.ok) return;
      const json = await res.json();
      if (!json || !Array.isArray(json.prices) || json.prices.length === 0) return;
      priceHistory = json.prices;
      state.stockIndex = 0;
      updateStockBoard();
    } catch (e) {
      // フォールバック: サンプル表示を維持
    }
  }

  // 初期化実行
  updateStockBoard();
  updateUI();
  loadPriceHistory();
  loadBoardIndex();
  loadStages();
});