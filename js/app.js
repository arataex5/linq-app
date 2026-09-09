/* =========================================================
   app.js  -  LINQ 画面遷移・状態管理・ゲームロジック
   ========================================================= */
(function (global) {
  'use strict';

  var S = global.LinqStore;
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var KANJI_NUM = ['①', '②'];

  /* ------------------------- 状態 ------------------------- */
  var nav = { current: null, stack: [] };

  var game = {
    mode: 'quick',          // 'quick' | 'full'
    n: 4,
    order: [],              // 順番position -> playerIndex
    names: [],              // playerIndex -> 表示名
    roles: [],              // position -> 'spy' | 'citizen'
    topic: null,
    kw: [],                 // position -> [キーワード①, キーワード②]
    kwDone: [],             // position -> [確定済みか, 確定済みか]
    votes: [],              // position -> [投票先position, ...]
    base: [],               // position -> ゲーム開始時の保持pt
    round: [],              // position -> 今回の取得pt
    scored: null,
    roleIndex: 0,
    revealed: false,
    gameNo: 1,
    inSuddenDeath: false,
    targetPoints: 10,
    sdEnabled: true,
    orderMethod: 'random',
    prevOrder: null,
    posHist: null          // playerIndex -> 経験済みの順番(position)の配列
  };

  var ui = {
    setupOrder: [],         // 設定画面での並び（position -> playerIndex）
    orderLocked: false,     // フル：2ゲーム目以降は順番決め方法を変更不可
    editMode: false,
    editingUid: null,
    listFilter: 'all',
    listQuery: '',
    historySelected: [],
    editorSelected: []
  };

  /* ------------------------- テーマ ------------------------- */
  function applyTheme() {
    var light = (S.settings.theme === 'light');
    document.body.classList.toggle('light', light);
    var btn = $('btn-theme');
    if (btn) btn.textContent = light ? '🌙' : '☀';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f4f5fa' : '#0b0d1c');
  }
  function toggleTheme() {
    S.settings.theme = (S.settings.theme === 'light') ? 'dark' : 'light';
    S.saveSettings();
    applyTheme();
  }

  /* ------------------------- 汎用UI ------------------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg, ms, actionLabel, onAction) {
    var t = $('toast');
    t.innerHTML = '';
    var span = document.createElement('span');
    span.className = 'toast-text';
    span.textContent = msg;
    t.appendChild(span);
    if (actionLabel && onAction) {
      var b = document.createElement('button');
      b.className = 'toast-action';
      b.textContent = actionLabel;
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        clearTimeout(t._tm);
        t.hidden = true;
        onAction();
      });
      t.appendChild(b);
    }
    t.hidden = false;
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.hidden = true; }, ms || 1800);
  }

  var modalCb = { yes: null, no: null };
  function confirmDialog(text, onYes, onNo) {
    $('modal-text').textContent = text;
    modalCb.yes = onYes || null;
    modalCb.no = onNo || null;
    $('modal').hidden = false;
  }
  function closeModal() { $('modal').hidden = true; modalCb.yes = modalCb.no = null; }

  function infoDialog(title, html) {
    $('info-title').textContent = title;
    $('info-text').innerHTML = html;
    $('info').hidden = false;
  }
  function closeInfo() { $('info').hidden = true; }

  /* 文字を枠に収める（実測は requestAnimationFrame 内で行う） */
  function fitText(el, maxPx, minPx) {
    if (!el) return;
    requestAnimationFrame(function () {
      var max = maxPx || 44, min = minPx || 15;
      el.style.fontSize = max + 'px';
      var size = max, guard = 0;
      while (guard < 60 && size > min &&
             (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        size -= 1; guard++;
        el.style.fontSize = size + 'px';
      }
    });
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.max(44, el.scrollHeight) + 'px';
  }
  function autoGrowAll(root) {
    requestAnimationFrame(function () {
      $$('textarea.kw-in', root || document).forEach(autoGrow);
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ------------------------- 画面遷移 ------------------------- */
  var onEnter = {};
  function show(name, opts) {
    opts = opts || {};
    if (nav.current && !opts.replace && nav.current !== name) nav.stack.push(nav.current);
    if (opts.resetStack) nav.stack = [];
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $('screen-' + name);
    if (!el) return;
    el.classList.add('active');
    nav.current = name;
    var sc = el.querySelector('.scroll-area');
    if (sc && !opts.keepScroll) sc.scrollTop = 0;
    if (onEnter[name]) onEnter[name](opts);
  }
  function goBack() {
    var prev = nav.stack.pop() || 'title';
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $('screen-' + prev);
    if (!el) { show('title', { resetStack: true }); return; }
    el.classList.add('active');
    nav.current = prev;
    if (onEnter[prev]) onEnter[prev]({ back: true });
  }
  function goTitle() { show('title', { resetStack: true }); }

  /* =========================================================
     ルール文言（プレイヤー人数によって変わる）
     ========================================================= */
  function rulesHtml(n, mode) {
    var r = S.rulesFor(n);
    var win = (mode === 'quick')
      ? '1ゲームで<span class="hl">最も多くポイント</span>を獲得したプレイヤーの勝利！'
      : '合計 <span class="hl">' + game.targetPoints + 'pt</span> に到達して<span class="hl">単独1位</span>になったプレイヤーの勝利！';
    return '' +
      '<p class="rb-win">' + win + '</p>' +
      '<div class="rb-grid">' +
        '<div class="rb-box spy"><h4>スパイ（' + r.spies + '人）のポイント</h4><ul>' +
          '<li>スパイ（相方）を当てた：<b>+1pt</b></li>' +
          '<li>他のスパイから指名された数：1人につき <b>+1pt</b>（最大 ' + r.namedCap + 'pt）</li>' +
          '<li>ペナルティ：一般人からの得票が <b>' + r.penaltyVotes + '票以上</b> → その回は <b>0pt</b></li>' +
        '</ul></div>' +
        '<div class="rb-box citizen"><h4>一般人（' + r.citizens + '人）のポイント</h4><ul>' +
          '<li>指名した2人が両方ともスパイ：<b>+2pt</b></li>' +
          '<li>1人のみ正解は <b>0pt</b></li>' +
        '</ul></div>' +
      '</div>' +
      '<p class="rb-rescue">救済ルール：ラウンド終了時に誰一人ポイントを獲得できなかった場合、一般人全員に 1pt。</p>';
  }

  function ptNoteHtml(n) {
    var r = S.rulesFor(n);
    return '<b class="s">スパイ(' + r.spies + '人)</b>：相方的中 +1pt ／ 他スパイからの指名 1人につき +1pt（最大' + r.namedCap + 'pt） ／ ' +
           '一般人から' + r.penaltyVotes + '票以上で 0pt<br>' +
           '<b class="c">一般人(' + r.citizens + '人)</b>：スパイ2人を的中で +2pt（1人のみは0pt） ／ ' +
           '全員0ptなら一般人全員に +1pt（救済）';
  }

  function rolesLineHtml(n) {
    var r = S.rulesFor(n);
    return '役職配分：<b class="s">スパイ ' + r.spies + '人</b> ／ <b class="c">一般人 ' + r.citizens + '人</b>' +
           '（投票の合計得票数は ' + r.expectedVotes + '票）';
  }

  /* =========================================================
     数値入力の共通バインド
     ========================================================= */
  function bindNumberField(id, opts) {
    var el = $(id);
    if (!el) return;
    var min = opts.min, max = opts.max;
    function flagError() {
      el.classList.add('err');
      clearTimeout(el._errTm);
      el._errTm = setTimeout(function () { el.classList.remove('err'); }, 900);
      showToast(min + '〜' + max + ' の範囲で入力してください', 1500);
    }
    el.addEventListener('input', function () {
      var digits = el.value.replace(/[^0-9]/g, '');
      if (digits !== '') {
        var v = parseInt(digits, 10);
        if (v > max) { digits = String(opts.get()); flagError(); }
      }
      el.value = digits;
    });
    function commit() {
      var v = parseInt(el.value, 10);
      if (isNaN(v)) v = opts.get();
      if (v < min || v > max) flagError();
      v = Math.max(min, Math.min(max, v));
      el.value = v;
      opts.apply(v);
    }
    el.addEventListener('change', commit);
    el.addEventListener('blur', commit);
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
    });
    el.addEventListener('focus', function () {
      var before = el.value;
      setTimeout(function () {
        if (document.activeElement === el && el.value === before) el.select();
      }, 0);
    });
  }

  /* =========================================================
     並べ替え（タップして運んで離す）
     ========================================================= */
  function bindDragHandle(handle, listEl, onDrop) {
    handle.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      ev.preventDefault();
      var rows = Array.prototype.slice.call(listEl.children);
      var row = handle.closest('.pl-row');
      var from = rows.indexOf(row);
      if (from < 0 || rows.length < 2) return;

      var rects = rows.map(function (r) { return r.getBoundingClientRect(); });
      // 画面回転時はリストが視覚的に横方向へ並ぶため、並びの軸を実測して判定する
      var axis = (Math.abs(rects[1].left - rects[0].left) > Math.abs(rects[1].top - rects[0].top)) ? 'x' : 'y';
      var centers = rects.map(function (r) {
        return axis === 'x' ? (r.left + r.width / 2) : (r.top + r.height / 2);
      });
      var to = from;
      row.classList.add('dragging');
      try { handle.setPointerCapture(ev.pointerId); } catch (e) {}

      function move(e) {
        var pos = (axis === 'x') ? e.clientX : e.clientY;
        var best = 0, bestD = Infinity;
        for (var i = 0; i < centers.length; i++) {
          var d = Math.abs(pos - centers[i]);
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best !== to) {
          rows.forEach(function (r) { r.classList.remove('drop-target'); });
          to = best;
          if (to !== from && rows[to]) rows[to].classList.add('drop-target');
        }
      }
      function up() {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        row.classList.remove('dragging');
        rows.forEach(function (r) { r.classList.remove('drop-target'); });
        if (to !== from) onDrop(from, to);
      }
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }

  function moveItem(arr, from, to) {
    var v = arr.splice(from, 1)[0];
    arr.splice(to, 0, v);
    return arr;
  }

  /* =========================================================
     設定画面（共通のプレイヤー行描画）
     ========================================================= */
  function syncSetupOrder() {
    var n = S.players.count;
    var seen = {}, out = [];
    ui.setupOrder.forEach(function (p) {
      if (p < n && !seen[p]) { seen[p] = true; out.push(p); }
    });
    for (var i = 0; i < n; i++) if (!seen[i]) out.push(i);
    ui.setupOrder = out;
  }

  function renderPlayerRows(listId, opts) {
    syncSetupOrder();
    var box = $(listId);
    box.innerHTML = '';
    ui.setupOrder.forEach(function (pi, pos) {
      var row = document.createElement('div');
      row.className = 'pl-row';

      var no = document.createElement('div');
      no.className = 'pl-no' + (opts.draggable ? ' draggable' : '');
      no.innerHTML = opts.draggable
        ? '<span>' + (pos + 1) + '</span><span class="grip">⠿</span>'
        : '<span>' + (pos + 1) + '</span>';
      row.appendChild(no);

      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'pl-name';
      inp.maxLength = 12;
      inp.placeholder = 'プレイヤー' + (pi + 1);
      inp.value = S.players.names[pi] || '';
      inp.addEventListener('input', function () { S.setPlayerName(pi, this.value); });
      row.appendChild(inp);

      if (opts.points) {
        var pt = document.createElement('input');
        pt.type = 'text';
        pt.className = 'pl-pt';
        pt.inputMode = 'numeric';
        pt.pattern = '[0-9]*';
        pt.maxLength = 3;
        pt.value = String(S.players.points[pi] || 0);
        pt.addEventListener('input', function () {
          this.value = this.value.replace(/[^0-9]/g, '').slice(0, 3);
        });
        pt.addEventListener('blur', function () {
          var v = parseInt(this.value, 10);
          if (isNaN(v)) v = 0;
          v = Math.max(0, Math.min(999, v));
          this.value = v;
          S.setPlayerPoint(pi, v);
        });
        pt.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); this.blur(); }
        });
        row.appendChild(pt);
      }

      box.appendChild(row);
      if (opts.draggable) {
        bindDragHandle(no, box, function (from, to) {
          moveItem(ui.setupOrder, from, to);
          opts.rerender();
          showToast('順番を入れ替えました', 900);
        });
      }
    });
  }

  /* ------------------------- ゲーム設定①（クイック） ------------------------- */
  function renderQuickSetup() {
    var n = S.players.count;
    $('q-count').value = n;
    $('q-banner').innerHTML = rulesHtml(n, 'quick');
    $('q-roles').innerHTML = rolesLineHtml(n);
    $$('#q-order-seg .seg-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.val === S.settings.orderQuick);
    });
    var manual = (S.settings.orderQuick === 'manual');
    $('q-order-hint').textContent = manual
      ? '左の番号がそのまま順番になります。番号を長めにタップして運び、離すと入れ替えできます。'
      : 'ゲーム開始時にランダムで順番を決めます。';
    renderPlayerRows('q-players', { draggable: manual, points: false, rerender: renderQuickSetup });
  }
  onEnter['setup-quick'] = function () { renderQuickSetup(); };

  /* ------------------------- ゲーム設定②③（フル） ------------------------- */
  function renderFullSetup() {
    var n = S.players.count;
    $('f-count').value = n;
    $('f-target').value = game.targetPoints;
    $('f-banner').innerHTML = rulesHtml(n, 'full');
    $('f-roles').innerHTML = rolesLineHtml(n);
    $('f-title').textContent = (game.gameNo > 1)
      ? (game.gameNo + 'ゲーム目' + (game.inSuddenDeath ? '\nサドンデス' : ''))
      : '1ゲーム目';
    $$('#f-sd-seg .seg-btn').forEach(function (b) {
      b.classList.toggle('on', (b.dataset.val === 'on') === !!game.sdEnabled);
    });
    $$('#f-order-seg .seg-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.val === game.orderMethod);
      b.disabled = ui.orderLocked;
    });
    $('f-order-lock').hidden = !ui.orderLocked;
    // サドンデス中は勝利に必要なポイント数・サドンデスの設定を隠す
    $('f-card-target').hidden = !!game.inSuddenDeath;
    $('f-card-sd').hidden = !!game.inSuddenDeath;
    var hints = {
      shift: '毎ゲーム、順番が1つずつずれます。番号を長めにタップして運ぶと入れ替えできます。',
      randomFirst: '最初のゲームだけランダム。2ゲーム目以降は1つずつずれます。',
      randomNoDup: '毎ゲーム、前回と同じ順番のプレイヤーが出ないようにランダムで決めます。',
      randomDup: '毎ゲーム、完全にランダムで決めます（前回と同じ順番になることもあります）。'
    };
    $('f-order-hint').textContent = hints[game.orderMethod] || '';
    var draggable = (game.orderMethod === 'shift');
    renderPlayerRows('f-players', { draggable: draggable, points: true, rerender: renderFullSetup });
  }
  onEnter['setup-full'] = function () { renderFullSetup(); };

  /* =========================================================
     ゲーム開始
     ========================================================= */
  function decideOrder() {
    var n = S.players.count;
    var base = ui.setupOrder.slice(0, n);
    if (game.mode === 'quick') {
      return (S.settings.orderQuick === 'manual') ? base.slice() : shuffle(base);
    }
    // フルゲーム
    var prev = game.prevOrder;
    if (!prev || prev.length !== n) {
      // 1ゲーム目（または人数変更後）
      if (game.orderMethod === 'shift') return base.slice();
      return shuffle(base);
    }
    if (game.orderMethod === 'shift' || game.orderMethod === 'randomFirst') {
      return base.slice(); // 設定画面で既に1つずらした並びを表示している
    }
    if (game.orderMethod === 'randomNoDup') return pickUnusedOrder(base, n);
    return shuffle(base);
  }

  /* 「ランダム（被りなし）」：各プレイヤーがまだ経験していない順番の中から選ぶ。
     全部経験済みになったプレイヤーは、その人の履歴だけリセットする。 */
  function ensurePosHist(n) {
    if (!game.posHist || game.posHist.length !== n) {
      game.posHist = [];
      for (var i = 0; i < n; i++) game.posHist.push([]);
    }
    return game.posHist;
  }
  function recordPosHist(order) {
    var h = ensurePosHist(order.length);
    order.forEach(function (pi, pos) {
      if (h[pi].indexOf(pos) < 0) h[pi].push(pos);
    });
  }
  function pickUnusedOrder(players, n) {
    var h = ensurePosHist(n);
    // 全ての順番を経験したプレイヤーは履歴をリセット
    players.forEach(function (pi) { if (h[pi].length >= n) h[pi] = []; });

    var avail = {};
    players.forEach(function (pi) {
      var a = [];
      for (var p = 0; p < n; p++) if (h[pi].indexOf(p) < 0) a.push(p);
      avail[pi] = a;
    });
    // 候補の少ないプレイヤーから割り当てる（ランダム性は候補のシャッフルで担保）
    var queue = players.slice().sort(function (a, b) {
      return avail[a].length - avail[b].length || (Math.random() - .5);
    });
    var used = {}, assign = {};
    function solve(k) {
      if (k >= queue.length) return true;
      var pi = queue[k];
      var cands = shuffle(avail[pi]);
      for (var i = 0; i < cands.length; i++) {
        var p = cands[i];
        if (used[p]) continue;
        used[p] = true; assign[pi] = p;
        if (solve(k + 1)) return true;
        used[p] = false; delete assign[pi];
      }
      return false;
    }
    if (!solve(0)) {
      // 割り当て不能なら全員の履歴をリセットして完全ランダム
      players.forEach(function (pi) { h[pi] = []; });
      return shuffle(players);
    }
    var out = [];
    for (var p = 0; p < n; p++) out.push(null);
    players.forEach(function (pi) { out[assign[pi]] = pi; });
    return out;
  }

  function assignRoles(n) {
    var spies = S.spyCountFor(n);
    var pos = [];
    for (var i = 0; i < n; i++) pos.push(i);
    var picked = shuffle(pos).slice(0, spies);
    var roles = [];
    for (var j = 0; j < n; j++) roles.push(picked.indexOf(j) > -1 ? 'spy' : 'citizen');
    return roles;
  }

  function startRound() {
    var n = S.players.count;
    game.n = n;
    game.order = decideOrder();
    recordPosHist(game.order);
    game.names = S.playerNames();
    game.roles = assignRoles(n);

    var d = S.drawOne();
    if (!d) { showToast('お題がありません。設定を見直してください'); return false; }
    game.topic = { uid: d.topic.uid, no: d.topic.no, text: d.topic.text };
    S.markUsed(d.topic.uid);
    if (d.relaxed) showToast('抽出できるお題がなくなったため、全お題から選びました', 2600);

    game.kw = [];
    game.kwDone = [];
    game.votes = [];
    game.base = [];
    game.round = [];
    for (var p = 0; p < n; p++) {
      game.kw.push(['', '']);
      game.kwDone.push([false, false]);
      game.votes.push([]);
      game.base.push(game.mode === 'full' ? (S.players.points[game.order[p]] || 0) : 0);
      game.round.push(0);
    }
    game.scored = null;
    game.roleIndex = 0;
    game.revealed = false;
    return true;
  }

  /* ------------------------- 役職＆お題確認 ------------------------- */
  function renderRoleStage() {
    var n = game.n;
    var pos = game.roleIndex;
    var name = game.names[game.order[pos]];
    $('role-progress').textContent = (pos + 1) + ' / ' + n + ' 人目';
    $('role-intro').hidden = false;
    $('role-reveal').hidden = true;
    $('role-msg').textContent = name + 'さんの番です。次の画面にて役職とお題が表示されます。';
    $('role-next').disabled = true;
    $('role-next').textContent = (pos >= n - 1) ? 'キーワード伝達画面へ' : '次の人へ';
    game.revealed = false;
  }
  function revealRole() {
    var pos = game.roleIndex;
    var name = game.names[game.order[pos]];
    var isSpy = (game.roles[pos] === 'spy');
    $('role-intro').hidden = true;
    $('role-reveal').hidden = false;
    $('role-name').textContent = name + 'さん';
    var t = $('role-title');
    t.textContent = isSpy ? 'あなたはスパイです。' : 'あなたは一般人です。';
    t.className = 'role-big ' + (isSpy ? 'spy' : 'citizen');
    var tp = $('role-topic');
    tp.innerHTML = isSpy
      ? 'お題は「<span class="tw">' + esc(game.topic.text) + '</span>」です。'
      : 'お題はありません。';
    fitText(t, 36, 18);
    fitText(tp, 42, 15);
    $('role-next').disabled = false;
    game.revealed = true;
  }
  onEnter.roles = function () { renderRoleStage(); };

  /* ------------------------- キーワード伝達 ------------------------- */
  /* 入力が「確定」した枠だけを埋まっているとみなす（入力中に次の人へ進まないように） */
  function kwDoneAt(p, c) {
    return !!(game.kwDone && game.kwDone[p] && game.kwDone[p][c]);
  }
  function kwTurn() {
    for (var c = 0; c < 2; c++) {
      for (var p = 0; p < game.n; p++) {
        if (!kwDoneAt(p, c)) return { pos: p, col: c };
      }
    }
    return null;
  }
  function kwCommit(p, c) {
    if (!game.kwDone) return;
    game.kwDone[p][c] = !!String(game.kw[p][c] || '').trim();
    updateKwPrompt();
  }
  function updateKwPrompt() {
    var t = kwTurn();
    var el = $('kw-prompt');
    $$('#kw-list .kw-row').forEach(function (r) { r.classList.remove('turn'); });
    $$('#kw-list .kw-in').forEach(function (i) { i.classList.remove('turn-cell'); });
    if (!t) {
      el.className = 'kw-prompt done';
      el.textContent = '全員の入力が完了しました。投票画面へ進んでください。';
      return;
    }
    el.className = 'kw-prompt';
    var name = game.names[game.order[t.pos]];
    el.innerHTML = '<span class="who">' + esc(name) + '</span>さんはキーワード' + KANJI_NUM[t.col] + 'へことばを入力してください。';
    var row = $('kw-list').children[t.pos];
    if (row) {
      row.classList.add('turn');
      var cell = row.querySelectorAll('.kw-in')[t.col];
      if (cell) cell.classList.add('turn-cell');
    }
  }
  function renderKeywords() {
    var box = $('kw-list');
    box.innerHTML = '';
    for (var p = 0; p < game.n; p++) {
      (function (p) {
        var row = document.createElement('div');
        row.className = 'kw-row';
        var no = document.createElement('div');
        no.className = 'kw-no'; no.textContent = String(p + 1);
        var nm = document.createElement('div');
        nm.className = 'kw-name'; nm.textContent = game.names[game.order[p]];
        row.appendChild(no); row.appendChild(nm);
        for (var c = 0; c < 2; c++) {
          (function (c) {
            var ta = document.createElement('textarea');
            ta.className = 'kw-in';
            ta.rows = 1;
            ta.placeholder = 'キーワード' + KANJI_NUM[c];
            ta.value = game.kw[p][c] || '';
            ta.addEventListener('input', function () {
              game.kw[p][c] = this.value;   // 入力中も値は保持（プロンプトは動かさない）
              autoGrow(this);
            });
            ta.addEventListener('change', function () { game.kw[p][c] = this.value; kwCommit(p, c); });
            ta.addEventListener('blur', function () { game.kw[p][c] = this.value; kwCommit(p, c); });
            ta.addEventListener('keydown', function (ev) {
              if (ev.key === 'Enter') { ev.preventDefault(); this.blur(); }
            });
            row.appendChild(ta);
          })(c);
        }
        box.appendChild(row);
      })(p);
    }
    autoGrowAll(box);
    updateKwPrompt();
  }
  onEnter.keywords = function () {
    // 画面に戻ってきたときは、すでに文字が入っている枠を入力済みとして扱う
    for (var p = 0; p < game.n; p++) {
      for (var c = 0; c < 2; c++) {
        if (String(game.kw[p][c] || '').trim()) game.kwDone[p][c] = true;
      }
    }
    renderKeywords();
  };

  /* ------------------------- 投票 ------------------------- */
  function renderKwReadonly(containerId, positions) {
    var box = $(containerId);
    box.innerHTML = '';
    positions.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'kw-row';
      var no = document.createElement('div');
      no.className = 'kw-no'; no.textContent = String(p + 1);
      var nm = document.createElement('div');
      nm.className = 'kw-name'; nm.textContent = game.names[game.order[p]];
      row.appendChild(no); row.appendChild(nm);
      for (var c = 0; c < 2; c++) {
        var d = document.createElement('div');
        var v = String(game.kw[p][c] || '').trim();
        d.className = 'kw-txt' + (v ? '' : ' empty');
        d.textContent = v || '（未入力）';
        row.appendChild(d);
      }
      box.appendChild(row);
    });
  }

  function voteCounts() {
    var recv = [];
    for (var i = 0; i < game.n; i++) recv.push(0);
    game.votes.forEach(function (v) {
      v.forEach(function (t) { if (t >= 0 && t < game.n) recv[t]++; });
    });
    return recv;
  }
  function totalVotes() {
    var s = 0;
    game.votes.forEach(function (v) { s += v.length; });
    return s;
  }
  function updateVoteCounts() {
    var recv = voteCounts();
    $$('#vote-list .vt-cnt .num').forEach(function (el, i) { el.textContent = String(recv[i]); });
    var r = S.rulesFor(game.n);
    var tv = totalVotes();
    var hint = $('vote-count-hint');
    hint.textContent = '合計得票数：' + tv + ' 票（本来あるべき票数：' + r.expectedVotes + ' 票）';
    hint.style.color = (tv === r.expectedVotes) ? '' : 'var(--danger)';
  }
  function renderVote() {
    var order = [];
    for (var i = 0; i < game.n; i++) order.push(i);
    renderKwReadonly('vote-kw', order);
    $('vote-ptnote').innerHTML = ptNoteHtml(game.n);

    var box = $('vote-list');
    box.innerHTML = '';
    for (var p = 0; p < game.n; p++) {
      (function (p) {
        var row = document.createElement('div');
        row.className = 'vt-row';
        var top = document.createElement('div');
        top.className = 'vt-top';
        top.innerHTML =
          '<span class="vt-no">' + (p + 1) + '</span>' +
          '<span class="vt-name">' + esc(game.names[game.order[p]]) + '</span>' +
          '<span class="vt-cnt"><span class="num">0</span><small>得票</small></span>';
        row.appendChild(top);

        var tg = document.createElement('div');
        tg.className = 'vt-targets';
        for (var q = 0; q < game.n; q++) {
          if (q === p) continue;
          (function (q) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'vt-chip' + (game.votes[p].indexOf(q) > -1 ? ' on' : '');
            chip.innerHTML = '<span class="n">' + (q + 1) + '</span><span class="nm">' +
                             esc(game.names[game.order[q]]) + '</span>';
            chip.addEventListener('click', function () {
              var idx = game.votes[p].indexOf(q);
              if (idx > -1) { game.votes[p].splice(idx, 1); chip.classList.remove('on'); }
              else {
                var lim = (game.roles[p] === 'spy') ? 1 : 2;
                if (game.votes[p].length >= lim) {
                  showToast('このプレイヤーの投票先は' + lim + '人までです', 1300);
                  return;
                }
                game.votes[p].push(q); chip.classList.add('on');
              }
              updateVoteCounts();
            });
            tg.appendChild(chip);
          })(q);
        }
        row.appendChild(tg);
        box.appendChild(row);
      })(p);
    }
    updateVoteCounts();
  }
  onEnter.vote = function () { renderVote(); };

  /* ------------------------- ポイント集計 ------------------------- */
  function computeRound() {
    game.scored = S.scoreRound(game.roles, game.votes);
    game.round = game.scored.points.slice();
  }
  /* 並びはキーワード伝達画面と同じ「順番どおり」 */
  function tallyOrder() {
    var out = [];
    for (var p = 0; p < game.n; p++) out.push(p);
    return out;
  }
  function voteTargetText(p) {
    var v = (game.votes[p] || []).slice().sort(function (a, b) { return a - b; });
    if (!v.length) return '投票先：なし';
    return '投票先：' + v.map(function (q) {
      return (q + 1) + '.' + game.names[game.order[q]];
    }).join('、');
  }
  function renderTally() {
    computeRound();
    $('tally-ptnote').innerHTML = ptNoteHtml(game.n);
    var ord = tallyOrder();
    var box = $('tally-list');
    box.innerHTML = '';
    ord.forEach(function (p) {
      var isSpy = (game.roles[p] === 'spy');
      var row = document.createElement('div');
      row.className = 'tl-row ' + (isSpy ? 'spy' : 'citizen');
      row.innerHTML =
        '<span class="tl-role">' + (isSpy ? 'スパイ' : '一般人') + '</span>' +
        '<span class="tl-name">' +
          '<span class="tl-nm"><span class="tl-ord">' + (p + 1) + '</span>' + esc(game.names[game.order[p]]) + '</span>' +
          '<span class="tl-vote">' + esc(voteTargetText(p)) + '</span>' +
          (game.scored.penalized[p] ? '<span class="pen">一般人から' + S.rulesFor(game.n).penaltyVotes + '票以上 → 0pt</span>' : '') +
        '</span>' +
        '<span class="tl-cnt">' + game.scored.received[p] + '</span>' +
        '<span class="tl-pt">' + (game.round[p] > 0 ? '+' : '') + game.round[p] + '</span>';
      box.appendChild(row);
    });
    $('tally-rescue').hidden = !game.scored.rescue;
    renderKwReadonly('tally-kw', ord);
  }
  onEnter.tally = function () { renderTally(); };

  /* ------------------------- リザルト ------------------------- */
  function totalsNow() {
    var out = [];
    for (var p = 0; p < game.n; p++) out.push((game.base[p] || 0) + (game.round[p] || 0));
    return out;
  }
  function commitPoints() {
    if (game.mode !== 'full') return;
    var tot = totalsNow();
    for (var p = 0; p < game.n; p++) S.setPlayerPoint(game.order[p], tot[p]);
  }

  function renderResult() {
    var tot = totalsNow();
    var rows = [];
    for (var p = 0; p < game.n; p++) rows.push({ pos: p, name: game.names[game.order[p]], round: game.round[p], total: tot[p] });
    rows.sort(function (a, b) { return b.total - a.total; });
    var rank = 0, prev = null;
    rows.forEach(function (r, i) {
      if (prev === null || r.total !== prev) { rank = i + 1; prev = r.total; }
      r.rank = rank;
    });

    var box = $('result-list');
    box.innerHTML = '';
    rows.forEach(function (r) {
      var el = document.createElement('div');
      el.className = 'rs-row' + (r.rank === 1 ? ' top' : '');
      el.innerHTML =
        '<span class="rs-rank">' + r.rank + '</span>' +
        '<span class="rs-name">' + esc(r.name) + '</span>' +
        '<span class="rs-pt">' + (r.round > 0 ? '+' : '') + r.round + '</span>' +
        '<span class="rs-total">' + r.total + '</span>';
      box.appendChild(el);
    });

    var head = $('result-headline');
    var bar = $('result-bar');
    var note = $('result-note');
    bar.innerHTML = '';
    note.textContent = '';
    head.hidden = true;
    head.className = 'result-headline';

    var max = rows.length ? rows[0].total : 0;
    var tops = rows.filter(function (r) { return r.total === max; });
    var names = tops.map(function (r) { return r.name + 'さん'; }).join('、');

    function btn(label, cls, fn) {
      var b = document.createElement('button');
      b.className = 'btn-big' + (cls ? ' ' + cls : '');
      b.textContent = label;
      b.addEventListener('click', fn);
      bar.appendChild(b);
      return b;
    }

    if (game.mode === 'quick') {
      head.hidden = false;
      head.className = 'result-headline win';
      head.textContent = names + 'の勝利！';
      btn('タイトルへ戻る', 'sub', function () { goTitle(); });
      btn('もう一度遊ぶ', '', function () { show('setup-quick', { resetStack: true }); });
      return;
    }

    // フルゲーム
    var overs = rows.filter(function (r) { return r.total >= game.targetPoints; });
    if (!overs.length) {
      note.textContent = '勝利に必要なポイント（' + game.targetPoints + 'pt）に到達したプレイヤーはまだいません。';
      btn('次のゲームへ', '', function () { nextFullGame(false); });
      return;
    }
    if (tops.length === 1) {
      head.hidden = false;
      head.className = 'result-headline win';
      head.textContent = names + 'の勝利！';
      btn('タイトルへ戻る', '', function () { commitPoints(); goTitle(); });
      return;
    }
    if (!game.sdEnabled) {
      head.hidden = false;
      head.className = 'result-headline win';
      head.textContent = names + 'の勝利！';
      btn('タイトルへ戻る', '', function () { commitPoints(); goTitle(); });
      return;
    }
    head.hidden = false;
    head.className = 'result-headline sd';
    head.textContent = '複数人勝者がいるためサドンデス！！！';
    note.textContent = '単独トップが生まれるまでサドンデスゲームは続きます。';
    btn('サドンデスへ', '', function () { nextFullGame(true); });
    btn('サドンデスをやめてタイトルへ戻る', 'sub', function () {
      confirmDialog('サドンデスをやめてタイトルへ戻りますか？', function () { commitPoints(); goTitle(); });
    });
  }
  onEnter.result = function () { renderResult(); };

  /* 次のゲームへ（フル） */
  function nextFullGame(sudden) {
    commitPoints();
    game.prevOrder = game.order.slice();
    game.gameNo++;
    if (sudden) game.inSuddenDeath = true;
    ui.orderLocked = true;

    // 次ゲームの並びを用意（一個ずつずれる／最初だけランダム → 1つずらす）
    var next;
    if (game.orderMethod === 'shift' || game.orderMethod === 'randomFirst') {
      next = game.prevOrder.slice(1).concat(game.prevOrder.slice(0, 1));
    } else {
      next = game.prevOrder.slice();
    }
    ui.setupOrder = next;
    show('setup-full', { resetStack: true });
  }

  /* =========================================================
     お題リスト / 追加・削除 / 履歴 / 設定
     ========================================================= */
  function filteredTopics() {
    var q = ui.listQuery.trim();
    return S.topics.filter(function (t) {
      if (ui.listFilter === 'fav' && !t.fav) return false;
      if (ui.listFilter === 'ex' && !t.ex) return false;
      if (q && t.text.indexOf(q) < 0 && String(t.no).indexOf(q) < 0) return false;
      return true;
    });
  }
  function renderTopicList() {
    var ul = $('topic-list');
    ul.innerHTML = '';
    var list = filteredTopics();
    $('btn-filter-fav').classList.toggle('on', ui.listFilter === 'fav');
    $('btn-filter-ex').classList.toggle('on', ui.listFilter === 'ex');
    if (!list.length) {
      var p = document.createElement('p');
      p.className = 'empty-note';
      p.textContent = '該当するお題がありません。';
      ul.appendChild(p);
      return;
    }
    list.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'li' + (t.master ? ' master' : '');
      li.innerHTML =
        '<button class="li-heart' + (t.fav ? ' on' : '') + '" aria-label="お気に入り">' + (t.fav ? '♥' : '♡') + '</button>' +
        '<span class="li-no">' + t.no + '</span>' +
        '<span class="li-main">' + esc(t.text) +
          (t.used ? '<span class="li-sub">使用済み</span>' : '') + '</span>' +
        '<label class="li-check"><input type="checkbox"' + (t.ex ? ' checked' : '') + '><span class="cbox"></span></label>';
      li.querySelector('.li-heart').addEventListener('click', function (ev) {
        ev.stopPropagation();
        S.toggleFav(t.uid);
        renderTopicList();
      });
      li.querySelector('input[type="checkbox"]').addEventListener('change', function () {
        S.toggleEx(t.uid);
        if (ui.listFilter === 'ex') renderTopicList();
      });
      ul.appendChild(li);
    });
  }
  onEnter.list = function () { renderTopicList(); };

  function renderEditor() {
    var ul = $('editor-list');
    ul.innerHTML = '';
    $('btn-edit-mode').textContent = ui.editMode ? '完了' : '編集';
    $('btn-edit-mode').classList.toggle('on', ui.editMode);
    $('editor-delete-bar').hidden = !ui.editMode;
    S.topics.forEach(function (t) {
      var li = document.createElement('li');
      var sel = ui.editorSelected.indexOf(t.uid) > -1;
      li.className = 'li' + (t.master ? ' master' : '') + (sel ? ' sel' : '');
      li.innerHTML =
        (ui.editMode && !t.master ? '<span class="li-pick"></span>' : '<span class="li-no">' + t.no + '</span>') +
        '<span class="li-main">' + esc(t.text) + '</span>' +
        (t.master ? '<span class="li-badge">標準</span>' : '<span class="li-badge used">追加</span>');
      li.addEventListener('click', function () {
        if (ui.editMode) {
          if (t.master) { showToast('標準のお題は削除できません', 1400); return; }
          var i = ui.editorSelected.indexOf(t.uid);
          if (i > -1) ui.editorSelected.splice(i, 1); else ui.editorSelected.push(t.uid);
          renderEditor();
        } else if (!t.master) {
          openAddForm(t);
        } else {
          showToast('標準のお題は編集できません', 1400);
        }
      });
      ul.appendChild(li);
    });
  }
  function openAddForm(topic) {
    ui.editingUid = topic ? topic.uid : null;
    $('af-title').textContent = topic ? 'お題を編集' : 'お題を追加';
    $('af-topic').value = topic ? topic.text : '';
    $('add-form').hidden = false;
    $('btn-add-open').hidden = true;
  }
  function closeAddForm() {
    ui.editingUid = null;
    $('add-form').hidden = true;
    $('btn-add-open').hidden = false;
  }
  onEnter.editor = function () { closeAddForm(); renderEditor(); };

  function renderHistory() {
    var ul = $('history-list');
    ul.innerHTML = '';
    if (!S.history.length) {
      var p = document.createElement('p');
      p.className = 'empty-note';
      p.textContent = 'まだ履歴がありません。\nゲームで使用したお題がここに表示されます。';
      ul.appendChild(p);
      return;
    }
    S.history.slice().reverse().forEach(function (h, ri) {
      var i = S.history.length - 1 - ri;
      var id = String(h.ts) + '_' + i;
      var sel = ui.historySelected.indexOf(id) > -1;
      var d = new Date(h.ts || 0);
      var ds = isNaN(d.getTime()) ? '' :
        '<span class="ld-d">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span>' +
        '<span class="ld-t">' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + '</span>';
      var li = document.createElement('li');
      li.className = 'li' + (sel ? ' sel' : '');
      li.innerHTML =
        '<span class="li-pick"></span>' +
        '<span class="li-no">' + h.no + '</span>' +
        '<span class="li-main">' + esc(h.text) + '</span>' +
        '<span class="li-date">' + ds + '</span>';
      li.addEventListener('click', function () {
        var k = ui.historySelected.indexOf(id);
        if (k > -1) ui.historySelected.splice(k, 1); else ui.historySelected.push(id);
        renderHistory();
      });
      ul.appendChild(li);
    });
  }
  onEnter.history = function () { ui.historySelected = []; renderHistory(); };

  function updatePoolInfo() {
    var n = S.pool().length;
    var total = S.topics.length;
    var used = S.topics.filter(function (t) { return t.used; }).length;
    var fav = S.topics.filter(function (t) { return t.fav; }).length;
    $('pool-info').textContent =
      '抽出対象：' + n + ' 件 ／ 登録 ' + total + ' 件（使用済み ' + used + ' 件・お気に入り ' + fav + ' 件）';
  }
  onEnter.settings = function () {
    $('set-exclude-used').checked = !!S.settings.excludeUsed;
    $('set-favorite-only').checked = !!S.settings.favoriteOnly;
    $('set-use-exclusion').checked = !!S.settings.useExclusion;
    updatePoolInfo();
    $('version-info').textContent =
      'LINQ v' + (S.version || '-') + '　/　お題データ：' + (S.csvSource === 'csv' ? 'CSV読込' : '内蔵データ');
  };

  /* ------------------------- ルール説明 ------------------------- */
  var RULES_HTML = '' +
  '<div class="rule-sec"><h3><span class="badge">1</span>どんなゲーム？</h3>' +
    '<p>プレイヤーの中に、共通のお題（キーワード）を知っている<b style="color:var(--spy)">スパイ</b>が潜んでいます。' +
    '残りは、お題を知らない<b style="color:var(--citizen)">一般人</b>です。</p>' +
    '<div class="rule-fig">' + figCards() + '</div>' +
    '<ul>' +
      '<li><b style="color:var(--spy)">スパイ</b>：バレないように、仲間にだけ伝わる連想ワードを出して相方を見つける。</li>' +
      '<li><b style="color:var(--citizen)">一般人</b>：会話からお題を推理してスパイを見破る。または知っているフリでブラフをかける。</li>' +
    '</ul>' +
  '</div>' +
  '<div class="rule-sec"><h3><span class="badge">2</span>人数と役職配分</h3>' +
    '<table class="rule-tbl"><tr><th>プレイヤー</th><th>スパイ</th><th>一般人</th></tr>' +
    '<tr><td>4〜8人</td><td class="s">2人</td><td class="c">2〜6人</td></tr>' +
    '<tr><td>9〜12人</td><td class="s">3人</td><td class="c">6〜9人</td></tr>' +
    '<tr><td>13〜16人</td><td class="s">4人</td><td class="c">9〜12人</td></tr>' +
    '<tr><td>17〜20人</td><td class="s">5人</td><td class="c">12〜15人</td></tr></table>' +
  '</div>' +
  '<div class="rule-sec"><h3><span class="badge">3</span>ゲームの流れ</h3>' +
    '<div class="rule-fig">' + figFlow() + '</div>' +
    '<ul>' +
      '<li><b>① 役職とお題の確認</b>：アプリを回して、一人ずつ自分の役職とお題を確認します。</li>' +
      '<li><b>② 1周目</b>：順番に、お題から連想する言葉を1つずつ入力します。</li>' +
      '<li><b>③ 2周目</b>：もう1周して、2つ目の言葉を入力します。</li>' +
      '<li><b>④ 討論と投票</b>：誰と誰がリンクしているのかを推理して、一斉に投票します。</li>' +
      '<li><b>⑤ 答え合わせ</b>：得点を計算し、総ポイントを確認します。</li>' +
    '</ul>' +
  '</div>' +
  '<div class="rule-sec"><h3><span class="badge">4</span>投票のしかた</h3>' +
    '<div class="rule-fig">' + figHands() + '</div>' +
    '<ul>' +
      '<li><b style="color:var(--spy)">スパイ</b>：同じスパイだと思う人を<b>一人</b>に投票（<b>片手のみ</b>使用）</li>' +
      '<li><b style="color:var(--citizen)">一般人</b>：スパイだと思う<b>二人</b>に投票（<b>両手</b>を使用）</li>' +
      '<li>投票前は全員が両手を同じ高さで待機するのがおすすめです。</li>' +
    '</ul>' +
  '</div>' +
  '<div class="rule-sec"><h3><span class="badge">5</span>ポイントの取り方</h3>' +
    '<p><b style="color:var(--spy)">スパイ</b></p>' +
    '<ul><li>スパイ（相方）を当てた：<b>+1pt</b></li>' +
      '<li>他のスパイから指名された数：1人につき <b>+1pt</b>（上限はスパイ数−1）</li>' +
      '<li>ペナルティ：一般人からの得票が「スパイ人数」以上 → その回は <b>0pt</b></li></ul>' +
    '<p><b style="color:var(--citizen)">一般人</b></p>' +
    '<ul><li>指名した2人が両方ともスパイ：<b>+2pt</b>（1人のみ正解は0pt）</li></ul>' +
    '<p>救済ルール：誰もポイントを獲得できなかった場合、一般人全員に <b>1pt</b>。</p>' +
  '</div>' +
  '<div class="rule-sec"><h3><span class="badge">6</span>2つのモード</h3>' +
    '<ul>' +
      '<li><b>クイックゲーム</b>：1ゲームだけ遊んで勝敗を決めるモード。</li>' +
      '<li><b>フルゲーム</b>：複数ゲームを行い、ポイントの取得数で勝敗を決めるモード。' +
        '設定した必要ポイントを超えて単独1位になれば勝利。サドンデスを「あり」にすると、' +
        '1位が複数いる場合は単独勝者が出るまでゲームが続きます。</li>' +
    '</ul>' +
  '</div>';

  function figCards() {
    return '<svg viewBox="0 0 320 96" role="img" aria-label="スパイと一般人のカード">' +
      '<g fill="none" stroke="currentColor" stroke-width="2" opacity=".35">' +
      '<rect x="8" y="12" width="66" height="72" rx="9"/><rect x="86" y="12" width="66" height="72" rx="9"/>' +
      '<rect x="164" y="12" width="66" height="72" rx="9"/><rect x="242" y="12" width="66" height="72" rx="9"/></g>' +
      '<g font-size="13" font-weight="700" text-anchor="middle">' +
      '<text x="41" y="44" fill="#ff6b7e">スパイ</text><text x="41" y="66" fill="currentColor" opacity=".75">りんご</text>' +
      '<text x="119" y="44" fill="#ff6b7e">スパイ</text><text x="119" y="66" fill="currentColor" opacity=".75">りんご</text>' +
      '<text x="197" y="44" fill="#5ad3e0">一般人</text><text x="197" y="66" fill="currentColor" opacity=".45">？</text>' +
      '<text x="275" y="44" fill="#5ad3e0">一般人</text><text x="275" y="66" fill="currentColor" opacity=".45">？</text>' +
      '</g></svg>';
  }
  function figFlow() {
    return '<svg viewBox="0 0 320 74" role="img" aria-label="ゲームの流れ">' +
      '<g font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">' +
      '<circle cx="34" cy="28" r="20" fill="none" stroke="currentColor" stroke-width="2" opacity=".45"/>' +
      '<text x="34" y="32">役職</text><text x="34" y="66" opacity=".6">確認</text>' +
      '<circle cx="106" cy="28" r="20" fill="none" stroke="currentColor" stroke-width="2" opacity=".45"/>' +
      '<text x="106" y="32">語①</text><text x="106" y="66" opacity=".6">1周目</text>' +
      '<circle cx="178" cy="28" r="20" fill="none" stroke="currentColor" stroke-width="2" opacity=".45"/>' +
      '<text x="178" y="32">語②</text><text x="178" y="66" opacity=".6">2周目</text>' +
      '<circle cx="250" cy="28" r="20" fill="none" stroke="#c6203a" stroke-width="2"/>' +
      '<text x="250" y="32" fill="#e23b55">投票</text><text x="250" y="66" opacity=".6">討論</text>' +
      '<circle cx="300" cy="28" r="16" fill="none" stroke="currentColor" stroke-width="2" opacity=".45"/>' +
      '<text x="300" y="32">pt</text></g>' +
      '<g stroke="currentColor" stroke-width="2" opacity=".35">' +
      '<path d="M58 28 h24"/><path d="M130 28 h24"/><path d="M202 28 h24"/><path d="M272 28 h10"/></g>' +
      '</svg>';
  }
  function figHands() {
    return '<svg viewBox="0 0 320 78" role="img" aria-label="投票の手の使い方">' +
      '<g font-size="12" font-weight="700" fill="currentColor">' +
      '<text x="16" y="22" fill="#ff6b7e">スパイ</text>' +
      '<text x="16" y="44" opacity=".8">片手で 1人 を指名</text>' +
      '<text x="176" y="22" fill="#5ad3e0">一般人</text>' +
      '<text x="176" y="44" opacity=".8">両手で 2人 を指名</text></g>' +
      '<g stroke="currentColor" stroke-width="2" fill="none" opacity=".5">' +
      '<path d="M24 60 l16 -10"/><path d="M184 60 l16 -10"/><path d="M212 60 l16 -10"/></g>' +
      '</svg>';
  }
  onEnter.rules = function () {
    var box = $('rules-scroll');
    if (!box.dataset.filled) { box.innerHTML = RULES_HTML; box.dataset.filled = '1'; }
  };

  /* =========================================================
     イベント登録
     ========================================================= */
  var HELP = {
    quick: ['クイックゲーム', '1ゲームにて勝敗を決めるモードです。'],
    full: ['フルゲーム', '複数ゲーム行い、ポイントの取得数にて勝敗を決めるモードです。'],
    sudden: ['サドンデス', 'ありにすると勝利に必要なポイント数を超えたプレイヤーがいたとしても、1位が複数いた場合は単独勝者がでるまでゲームが続きます。']
  };

  function bind() {
    document.addEventListener('click', function (ev) {
      var help = ev.target.closest('[data-help]');
      if (help) {
        var h = HELP[help.dataset.help];
        if (h) infoDialog(h[0], esc(h[1]));
        return;
      }
      var go = ev.target.closest('[data-go]');
      if (go) { show(go.dataset.go); return; }
      var back = ev.target.closest('[data-back]');
      if (back) { goBack(); return; }
      var t1 = ev.target.closest('[data-title]');
      if (t1) { goTitle(); return; }
      var t2 = ev.target.closest('[data-title-confirm]');
      if (t2) {
        confirmDialog('タイトルへ戻りますか？\n進行中のゲームは終了します。', goTitle);
        return;
      }
      var orient = ev.target.closest('.btn-orient');
      if (orient) {
        document.body.classList.toggle('rotated');
        showToast(document.body.classList.contains('rotated') ? '横画面レイアウト' : '縦画面レイアウト', 1200);
        setTimeout(function () {
          autoGrowAll();
          if (nav.current === 'roles' && game.revealed) {
            fitText($('role-title'), 36, 18);
            fitText($('role-topic'), 42, 15);
          }
        }, 80);
        return;
      }
    });

    // モーダル
    $('modal-yes').addEventListener('click', function () { var cb = modalCb.yes; closeModal(); if (cb) cb(); });
    $('modal-no').addEventListener('click', function () { var cb = modalCb.no; closeModal(); if (cb) cb(); });
    $('modal').addEventListener('click', function (ev) {
      if (ev.target === this) { var cb = modalCb.no; closeModal(); if (cb) cb(); }
    });
    $('info-ok').addEventListener('click', closeInfo);
    $('info').addEventListener('click', function (ev) { if (ev.target === this) closeInfo(); });

    // タイトル
    $('btn-theme').addEventListener('click', toggleTheme);
    $('btn-quick').addEventListener('click', function () {
      game.mode = 'quick';
      game.gameNo = 1;
      game.inSuddenDeath = false;
      game.prevOrder = null;
      game.posHist = null;
      ui.orderLocked = false;
      ui.setupOrder = [];
      show('setup-quick', { resetStack: true });
    });
    $('btn-full').addEventListener('click', function () {
      game.mode = 'full';
      game.gameNo = 1;
      game.inSuddenDeath = false;
      game.prevOrder = null;
      game.posHist = null;
      game.targetPoints = S.settings.targetPoints;
      game.sdEnabled = !!S.settings.suddenDeath;
      game.orderMethod = S.settings.orderFull;
      ui.orderLocked = false;
      ui.setupOrder = [];
      S.resetPoints();
      show('setup-full', { resetStack: true });
    });

    // ゲーム設定①（クイック）
    $('q-plus').addEventListener('click', function () { S.setPlayerCount(S.players.count + 1); renderQuickSetup(); });
    $('q-minus').addEventListener('click', function () { S.setPlayerCount(S.players.count - 1); renderQuickSetup(); });
    bindNumberField('q-count', {
      min: 4, max: 20,
      get: function () { return S.players.count; },
      apply: function (v) { S.setPlayerCount(v); renderQuickSetup(); }
    });
    $('q-order-seg').addEventListener('click', function (ev) {
      var b = ev.target.closest('.seg-btn'); if (!b) return;
      S.settings.orderQuick = b.dataset.val; S.saveSettings();
      renderQuickSetup();
    });
    $('q-start').addEventListener('click', function () {
      if (startRound()) show('roles', { resetStack: true });
    });

    // ゲーム設定②③（フル）
    $('f-plus').addEventListener('click', function () { S.setPlayerCount(S.players.count + 1); game.posHist = null; renderFullSetup(); });
    $('f-minus').addEventListener('click', function () { S.setPlayerCount(S.players.count - 1); game.posHist = null; renderFullSetup(); });
    bindNumberField('f-count', {
      min: 4, max: 20,
      get: function () { return S.players.count; },
      apply: function (v) { S.setPlayerCount(v); game.posHist = null; renderFullSetup(); }
    });
    $('f-tp-plus').addEventListener('click', function () {
      game.targetPoints = Math.min(99, game.targetPoints + 1);
      S.settings.targetPoints = game.targetPoints; S.saveSettings(); renderFullSetup();
    });
    $('f-tp-minus').addEventListener('click', function () {
      game.targetPoints = Math.max(1, game.targetPoints - 1);
      S.settings.targetPoints = game.targetPoints; S.saveSettings(); renderFullSetup();
    });
    bindNumberField('f-target', {
      min: 1, max: 99,
      get: function () { return game.targetPoints; },
      apply: function (v) {
        game.targetPoints = v;
        S.settings.targetPoints = v; S.saveSettings();
        renderFullSetup();
      }
    });
    $('f-sd-seg').addEventListener('click', function (ev) {
      var b = ev.target.closest('.seg-btn'); if (!b) return;
      game.sdEnabled = (b.dataset.val === 'on');
      S.settings.suddenDeath = game.sdEnabled; S.saveSettings();
      renderFullSetup();
    });
    $('f-order-seg').addEventListener('click', function (ev) {
      var b = ev.target.closest('.seg-btn'); if (!b || b.disabled) return;
      game.orderMethod = b.dataset.val;
      S.settings.orderFull = game.orderMethod; S.saveSettings();
      renderFullSetup();
    });
    $('f-start').addEventListener('click', function () {
      if (startRound()) show('roles', { resetStack: true });
    });

    // 役職＆お題確認
    $('role-tap').addEventListener('click', function () {
      if (game.revealed) return;
      var name = game.names[game.order[game.roleIndex]];
      confirmDialog('あなたは' + name + 'さんですか？', revealRole);
    });
    $('role-next').addEventListener('click', function () {
      if (!game.revealed) return;
      if (game.roleIndex >= game.n - 1) { show('keywords', { resetStack: true }); return; }
      game.roleIndex++;
      renderRoleStage();
    });

    // キーワード伝達
    $('kw-next').addEventListener('click', function () {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (kwTurn()) {
        confirmDialog('空欄の枠がありますが、このまま進みますか？', function () { show('vote'); });
      } else show('vote');
    });

    // 投票
    $('vote-back').addEventListener('click', function () { show('keywords', { replace: true }); });
    $('vote-next').addEventListener('click', function () {
      var r = S.rulesFor(game.n);
      if (totalVotes() !== r.expectedVotes) {
        confirmDialog('得票数が一致していませんが、このまま進みますか？', function () { show('tally'); });
      } else show('tally');
    });

    // ポイント集計
    $('tally-back').addEventListener('click', function () { show('vote', { replace: true }); });
    $('tally-next').addEventListener('click', function () { show('result'); });

    // リザルト
    $('result-back').addEventListener('click', function () { show('tally', { replace: true }); });

    // お題リスト
    $('btn-filter-fav').addEventListener('click', function () {
      ui.listFilter = (ui.listFilter === 'fav') ? 'all' : 'fav';
      renderTopicList();
    });
    $('btn-filter-ex').addEventListener('click', function () {
      ui.listFilter = (ui.listFilter === 'ex') ? 'all' : 'ex';
      renderTopicList();
    });
    $('list-search').addEventListener('input', function () {
      ui.listQuery = this.value; renderTopicList();
    });

    // お題の追加・削除
    $('btn-edit-mode').addEventListener('click', function () {
      ui.editMode = !ui.editMode;
      ui.editorSelected = [];
      closeAddForm();
      renderEditor();
    });
    $('btn-add-open').addEventListener('click', function () { openAddForm(null); });
    $('af-cancel').addEventListener('click', closeAddForm);
    $('add-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = $('af-topic').value.trim();
      if (!text) { showToast('お題を入力してください', 1400); return; }
      if (ui.editingUid) S.updateTopic(ui.editingUid, text);
      else S.addTopic(text);
      closeAddForm();
      renderEditor();
      showToast(ui.editingUid ? '保存しました' : '追加しました', 1200);
    });
    $('btn-delete-selected').addEventListener('click', function () {
      if (!ui.editorSelected.length) { showToast('削除するお題を選んでください', 1400); return; }
      var cnt = ui.editorSelected.length;
      confirmDialog(cnt + ' 件のお題を削除しますか？', function () {
        S.deleteTopics(ui.editorSelected);
        ui.editorSelected = [];
        renderEditor();
        showToast('削除しました', 1200);
      });
    });

    // 履歴
    $('btn-history-clear').addEventListener('click', function () {
      if (!S.history.length) { showToast('履歴はありません', 1200); return; }
      confirmDialog('履歴をすべて削除しますか？\n（使用済みの状態も解除されます）', function () {
        var removed = S.clearHistory();
        renderHistory();
        showToast('履歴を全削除しました', 3000, '元に戻す', function () {
          S.restoreHistory(removed); renderHistory();
        });
      });
    });
    $('btn-history-trash').addEventListener('click', function () {
      if (!ui.historySelected.length) { showToast('削除する履歴を選んでください', 1400); return; }
      var ids = ui.historySelected.slice();
      var removed = S.deleteHistory(ids);
      ui.historySelected = [];
      renderHistory();
      showToast(removed.length + ' 件削除しました', 3000, '元に戻す', function () {
        S.restoreHistory(removed); renderHistory();
      });
    });

    // 設定
    $('set-exclude-used').addEventListener('change', function () {
      S.settings.excludeUsed = this.checked; S.saveSettings(); updatePoolInfo();
    });
    $('set-favorite-only').addEventListener('change', function () {
      S.settings.favoriteOnly = this.checked; S.saveSettings(); updatePoolInfo();
    });
    $('set-use-exclusion').addEventListener('change', function () {
      S.settings.useExclusion = this.checked; S.saveSettings(); updatePoolInfo();
    });

    // インストール導線
    $('btn-install-open').addEventListener('click', function () { $('install-sheet').hidden = false; });
    $('install-close').addEventListener('click', function () { $('install-sheet').hidden = true; });
    $('install-sheet').addEventListener('click', function (ev) { if (ev.target === this) this.hidden = true; });

    // リサイズ / 回転
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        autoGrowAll();
        if (nav.current === 'roles' && game.revealed) {
          fitText($('role-title'), 36, 18);
          fitText($('role-topic'), 42, 15);
        }
      }, 200);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { autoGrowAll(); }, 300);
    });

    // Android の戻るボタン（Capacitor / APK）
    try {
      var CapApp = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App;
      if (CapApp && CapApp.addListener) {
        CapApp.addListener('backButton', function () {
          if (!$('modal').hidden) { closeModal(); return; }
          if (!$('info').hidden) { closeInfo(); return; }
          if (!$('install-sheet').hidden) { $('install-sheet').hidden = true; return; }
          if (nav.current && nav.current !== 'title') { goBack(); return; }
          try { S.flush(); } catch (e) {}
          setTimeout(function () { if (CapApp.exitApp) CapApp.exitApp(); }, 180);
        });
      }
    } catch (e) {}

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { try { S.flush(); } catch (e) {} }
    });
    window.addEventListener('pagehide', function () { try { S.flush(); } catch (e) {} });

    // iOS のピンチ / ダブルタップズーム抑止
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (e) {
      document.addEventListener(e, function (ev) { ev.preventDefault(); }, { passive: false });
    });
    var lastTouch = 0;
    document.addEventListener('touchend', function (ev) {
      var now = Date.now();
      if (now - lastTouch <= 300 && !ev.target.closest('input,textarea')) ev.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  function initInstallButton() {
    var btn = $('btn-install-open');
    if (!btn) return;
    btn.hidden = true;

    var apk = (S.apk || { path: './download/linq.apk', mode: 'off' });
    var link = $('install-dl');
    if (link) link.setAttribute('href', apk.path);

    var ua = navigator.userAgent || '';
    var isNative = !!(global.Capacitor && (global.Capacitor.isNativePlatform
      ? global.Capacitor.isNativePlatform() : global.Capacitor.isNative));
    var isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    // アプリ版で開いているとき / iOS では表示しない（APKはAndroid専用）
    if (isNative || isIOS || apk.mode === 'off') return;

    var proto = (global.location && global.location.protocol) || '';
    if (proto !== 'http:' && proto !== 'https:') return;   // file:// では確認できない

    if (apk.mode === 'on') { btn.hidden = false; return; }

    // 'auto'：配布情報（GitHub Actions が更新）を見て、APKがあるときだけ導線を出す
    try {
      fetch(apk.info, { cache: 'no-store' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (info) {
          if (!info || !info.available) return;
          btn.hidden = false;
          if (link && info.file) link.setAttribute('href', apk.dir + info.file);
          var el = $('install-size');
          if (el && info.size > 0) {
            var mb = info.size / (1024 * 1024);
            el.textContent = '約' + (mb >= 10 ? Math.round(mb) : mb.toFixed(1)) + 'MB';
          }
          var v = $('install-version');
          if (v && info.version) v.textContent = 'アプリ版 v' + info.version;
        })
        .catch(function () { /* 配布情報が無ければ導線は出さない */ });
    } catch (e) {}
  }

  /* ------------------------- 起動 ------------------------- */
  function boot() {
    try {
      var raw = global.localStorage.getItem('linq.settings.v1');
      if (raw && JSON.parse(raw).theme === 'light') document.body.classList.add('light');
    } catch (e) {}
    bind();
    S.init().then(function () {
      applyTheme();
      initInstallButton();
      game.targetPoints = S.settings.targetPoints;
      game.sdEnabled = !!S.settings.suddenDeath;
      game.orderMethod = S.settings.orderFull;
      if (S.topicsReset) showToast('お題データを更新しました（お気に入り・除外・履歴はリセットされます）', 4200);
      else if (S.repaired) showToast('使用状況を修復しました（' + S.repaired + '件）', 3200);
      show('title', { resetStack: true });
    }).catch(function () {
      applyTheme();
      show('title', { resetStack: true });
      showToast('データの初期化に失敗しました');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.LinqApp = { show: show, state: game, ui: ui, store: S };
})(window);
