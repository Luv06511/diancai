/* 小饭桌 —— 两个人一起吃的单文件应用（无依赖） */
(function () {
  'use strict';

  const LS_KEY = 'diancai.v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ================= 小工具 ================= */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function fmtTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return '今天 ' + hm;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return '昨天 ' + hm;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }

  const ICONS = {
    bag: '<path d="M5.5 8h13l1.1 12.4a1.5 1.5 0 0 1-1.5 1.6H5.9a1.5 1.5 0 0 1-1.5-1.6L5.5 8z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/>',
    menu: '<path d="M3.4 11.3h17.2c0 4.8-3.8 8.7-8.6 8.7s-8.6-3.9-8.6-8.7z"/>',
    orders: '<path d="M6 3.8h12v16.4l-3-2-3 2-3-2-3 2z"/><path d="M9.2 8.5h5.6M9.2 12.4h5.6"/>',
    manage: '<path d="M9 6.8h11M9 12h11M9 17.2h11"/><circle cx="4.8" cy="6.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="17.2" r="1.1" fill="currentColor" stroke="none"/>',
    heart: '<path d="M12 20.2c-.4 0-.8-.15-1.1-.42C7.3 16.6 3.6 13.3 3.6 9.7c0-2.5 1.9-4.4 4.3-4.4 1.5 0 2.9.75 3.7 1.95.8-1.2 2.2-1.95 3.7-1.95 2.4 0 4.3 1.9 4.3 4.4 0 3.6-3.7 6.9-7.3 10.08-.3.27-.7.42-1.1.42z"/>'
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ================= 数据 ================= */
  const CAT_MAP = { '招牌': '拿手菜', '热菜': '热炒', '汤羹': '汤汤', '凉菜': '小凉菜', '饮品': '喝的' };
  const catName = (c) => (CAT_MAP[c] || c);

  function defaultData() {
    return {
      v: 2,
      shop: '小饭桌',
      seq: 0,
      note: '',
      cats: DISH_CATS.slice(),
      dishes: SEED_DISHES.map((d) => Object.assign({}, d)),
      cart: [],
      orders: []
    };
  }

  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || !Array.isArray(raw.dishes) || !raw.dishes.length) return defaultData();

    const d = Object.assign(defaultData(), raw);
    d.cats = (Array.isArray(raw.cats) && raw.cats.length ? raw.cats.slice() : DISH_CATS.slice()).map(catName);
    d.dishes.forEach((x) => {
      if (!x.id) x.id = uid();
      if (!Array.isArray(x.tags)) x.tags = [];
      if (!Array.isArray(x.ingredients)) x.ingredients = [];
      if (x.cat) x.cat = catName(x.cat);
      if (x.cat && d.cats.indexOf(x.cat) < 0) d.cats.push(x.cat);
    });
    d.cats = d.cats.filter((c, i) => d.cats.indexOf(c) === i);
    d.cart = (Array.isArray(raw.cart) ? raw.cart : []).filter((c) =>
      d.dishes.some((x) => x.id === c.id) && c.qty > 0
    );
    d.orders = Array.isArray(raw.orders) ? raw.orders : [];
    if (typeof d.seq !== 'number') d.seq = d.orders.length;
    return d;
  }

  let db = load();

  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeNow, 150);
  }
  function writeNow() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(db));
    } catch (e) {
      toast('存不下啦，空间可能满了');
    }
  }

  /* -------- 图片（IndexedDB，不进 localStorage） -------- */
  const photoCache = new Map();
  let idbPromise = null;

  function openIdb() {
    if (!idbPromise) {
      idbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('no idb')); return; }
        const req = indexedDB.open('diancai-photos', 1);
        req.onupgradeneeded = () => {
          const s = req.result;
          if (!s.objectStoreNames.contains('p')) s.createObjectStore('p');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return idbPromise;
  }

  async function photoPut(id, blob) {
    try {
      const dbh = await openIdb();
      await new Promise((res, rej) => {
        const tx = dbh.transaction('p', 'readwrite');
        tx.objectStore('p').put(blob, id);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      const old = photoCache.get(id);
      if (old) URL.revokeObjectURL(old);
      photoCache.set(id, URL.createObjectURL(blob));
      return true;
    } catch (e) {
      toast('照片没存上，可能不支持本地存储');
      return false;
    }
  }

  async function photoGet(id) {
    try {
      const dbh = await openIdb();
      return await new Promise((res, rej) => {
        const tx = dbh.transaction('p', 'readonly');
        const r = tx.objectStore('p').get(id);
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => rej(r.error);
      });
    } catch (e) {
      return null;
    }
  }

  async function photoDel(id) {
    try {
      const dbh = await openIdb();
      await new Promise((res) => {
        const tx = dbh.transaction('p', 'readwrite');
        tx.objectStore('p').delete(id);
        tx.oncomplete = res;
        tx.onerror = res;
      });
    } catch (e) { /* ignore */ }
    const old = photoCache.get(id);
    if (old) URL.revokeObjectURL(old);
    photoCache.delete(id);
  }

  async function photoClearAll() {
    try {
      const dbh = await openIdb();
      await new Promise((res) => {
        const tx = dbh.transaction('p', 'readwrite');
        tx.objectStore('p').clear();
        tx.oncomplete = res;
        tx.onerror = res;
      });
    } catch (e) { /* ignore */ }
    photoCache.forEach((url) => { if (url) URL.revokeObjectURL(url); });
    photoCache.clear();
  }

  function blobToDataUrl(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }

  async function hydratePhotos() {
    const imgs = $$('img[data-photo]');
    for (const img of imgs) {
      const id = img.dataset.photo;
      if (!id) continue;
      if (photoCache.has(id)) {
        const url = photoCache.get(id);
        if (url) img.src = url; else img.remove();
        continue;
      }
      const blob = await photoGet(id);
      if (!blob) { photoCache.set(id, null); img.remove(); continue; }
      const url = URL.createObjectURL(blob);
      photoCache.set(id, url);
      img.src = url;
    }
  }

  /* ================= 状态 ================= */
  const ui = { tab: 'menu', cat: '全部' };
  let sheet = null;      // {type:'cart'} | {type:'dish',id} | {type:'edit'} | {type:'shopping',id}
  let draft = null;

  /* ================= 选择器 ================= */
  const dishById = (id) => db.dishes.find((d) => d.id === id);
  const cartLine = (id) => db.cart.find((c) => c.id === id);
  const cartQty = (id) => (cartLine(id) || {}).qty || 0;
  const cartCount = () => db.cart.reduce((s, c) => s + c.qty, 0);

  /* ================= 渲染：外壳 ================= */
  function render(keepScroll) {
    const y = keepScroll ? window.scrollY : 0;
    renderTop();
    renderView();
    renderTabbar();
    renderCartBar();
    if (sheet) renderSheet(); else clearSheetDom();
    if (keepScroll) requestAnimationFrame(() => window.scrollTo(0, y));
    else window.scrollTo(0, 0);
    hydratePhotos();
  }

  function renderTop() {
    const n = cartCount();
    $('#topbar').innerHTML =
      '<div class="brand"><h1>' + esc(db.shop) + '</h1><span class="tag">两个人一起</span></div>' +
      '<button class="cart-btn" data-act="open-cart" aria-label="想吃清单">' + svg('bag') +
      '<span class="badge"' + (n ? '' : ' hidden') + '>' + n + '</span></button>';
  }

  function renderTabbar() {
    const tabs = [
      ['menu', '想吃', 'menu'],
      ['orders', '记录', 'orders'],
      ['manage', '菜谱', 'manage'],
      ['me', '我们', 'heart']
    ];
    $('#tabbar').innerHTML = tabs.map((t) =>
      '<button class="tab' + (ui.tab === t[0] ? ' active' : '') + '" data-act="tab" data-tab="' + t[0] + '">' +
      svg(t[2]) + '<span>' + t[1] + '</span></button>'
    ).join('');
  }

  function renderCartBar() {
    const wrap = $('#cartbar-wrap');
    if (!db.cart.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML =
      '<div class="cartbar">' +
      '<div class="cb-left"><span class="cb-emoji">🧺</span>' +
      '<span class="cb-total">' + cartCount() + ' 个菜</span></div>' +
      '<button class="cb-btn" data-act="open-cart">定啦</button></div>';
  }

  function renderView() {
    const view = $('#view');
    let html = '';
    if (ui.tab === 'menu') html = menuView();
    else if (ui.tab === 'orders') html = ordersView();
    else if (ui.tab === 'manage') html = manageView();
    else html = meView();
    view.innerHTML = html;
  }

  function emptyBlock(ico, title, sub, act, label) {
    return '<div class="empty"><div class="ico">' + ico + '</div><h3>' + esc(title) + '</h3><p>' + esc(sub) + '</p>' +
      (act ? '<button class="btn primary" style="margin-top:16px" data-act="' + act + '">' + esc(label) + '</button>' : '') +
      '</div>';
  }

  /* ================= 视图：想吃 ================= */
  function menuView() {
    if (!db.dishes.length) return emptyBlock('🍽️', '菜谱本还空着', '先去「菜谱」加几道爱吃的吧', 'tab', '去加菜');

    const counts = {};
    db.dishes.forEach((d) => { counts[d.cat] = (counts[d.cat] || 0) + 1; });
    const cats = ['全部'].concat(db.cats.filter((c) => counts[c]));
    db.dishes.forEach((d) => { if (cats.indexOf(d.cat) < 0) cats.push(d.cat); });

    const chips = cats.map((c) => {
      const n = c === '全部' ? db.dishes.length : (counts[c] || 0);
      return '<button class="chip' + (ui.cat === c ? ' active' : '') + '" data-act="cat" data-cat="' + esc(c) + '">' +
        esc(c) + '<i>' + n + '</i></button>';
    }).join('');

    const shown = ui.cat === '全部' ? cats.slice(1) : [ui.cat];
    const sections = shown.map((cat) => {
      const ds = db.dishes.filter((d) => d.cat === cat);
      if (!ds.length) return '';
      return '<section class="section"><div class="section-head"><h2>' + esc(cat) + '</h2><span>' + ds.length + ' 道</span></div>' +
        '<div class="dish-list">' + ds.map(dishCard).join('') + '</div></section>';
    }).join('');

    return '<div class="hero">' +
      '<div class="hero-hearts"><span>🤍</span><span>💗</span><span>🤍</span></div>' +
      '<p class="hero-kicker">今天也要好好吃饭</p>' +
      '<h2 class="hero-title">今天想吃<br>什么呀？</h2>' +
      '<p class="hero-sub">' + db.dishes.length + ' 道菜 · 挑中了就告诉我</p>' +
      '<button class="hero-dice" data-act="lucky">🎲 随便配一桌</button>' +
      '</div>' +
      '<div class="catbar"><div class="catbar-inner">' + chips + '</div></div>' +
      (sections || emptyBlock('🍳', '这个分类还没有菜', '去「菜谱」里加一道'));
  }

  function dishCard(d) {
    const q = cartQty(d.id);
    const tags = (d.tags || []).slice(0, 2).map((t) => '<span class="tag">' + esc(t) + '</span>').join('');
    return '<article class="dish' + (d.off ? ' off' : '') + '" data-act="dish" data-id="' + d.id + '">' +
      '<div class="thumb">' +
        (d.photo ? '<img data-photo="' + d.id + '" alt="">' : '') +
        '<span class="emoji">' + esc(d.emoji || '🍽️') + '</span>' +
      '</div>' +
      '<div class="dish-main">' +
        '<div class="dish-title"><h3>' + esc(d.name) + '</h3>' + (d.off ? '<span class="soldout">歇一天</span>' : '') + '</div>' +
        (d.desc ? '<p class="dish-desc">' + esc(d.desc) + '</p>' : '') +
        '<div class="dish-meta">' +
          (d.minutes ? '<span class="mins">' + d.minutes + ' 分钟</span>' : '') +
          tags +
        '</div>' +
      '</div>' +
      '<div class="dish-act">' +
        (q ? '<span class="qbadge">' + q + '</span>' : '') +
        '<button class="add" data-act="add" data-id="' + d.id + '"' + (d.off ? ' disabled' : '') + ' aria-label="加入想吃">+</button>' +
      '</div>' +
    '</article>';
  }

  /* ================= 视图：记录 ================= */
  function ordersView() {
    if (!db.orders.length) return emptyBlock('💌', '还没有投喂记录', '去「想吃」挑几道，做完就会记在这里');
    const head = '<div class="page-head"><h2>投喂记录</h2><span>' + db.orders.length + ' 顿</span></div>';
    return head + '<div class="orders">' + db.orders.map(orderCard).join('') + '</div>';
  }

  function orderCard(o) {
    const done = o.status === 'done';
    const items = o.items.map((it) =>
      '<li class="order-item"><span class="oi-emoji">' + esc(it.emoji || '🍽️') + '</span>' +
      '<span class="oi-name">' + esc(it.name) + '</span>' +
      '<span class="oi-qty">×' + it.qty + '</span>' +
      (it.note ? '<span class="oi-note">备注：' + esc(it.note) + '</span>' : '') +
      '</li>'
    ).join('');
    const count = o.items.reduce((s, i) => s + i.qty, 0);

    return '<article class="order">' +
      '<div class="order-head">' +
        '<span class="order-no">第 ' + o.no + ' 顿</span>' +
        '<span class="order-time">' + fmtTime(o.at) + '</span>' +
        '<span class="badge-status ' + (done ? 'done' : 'todo') + '">' + (done ? '吃过啦' : '等你做') + '</span>' +
      '</div>' +
      '<ul class="order-items">' + items + '</ul>' +
      (o.note ? '<p class="order-note">小纸条：' + esc(o.note) + '</p>' : '') +
      '<div class="order-foot">' +
        '<span class="order-total">一共 ' + count + ' 个菜</span>' +
        '<button class="mini ' + (done ? '' : 'green') + '" data-act="done" data-id="' + o.id + '">' +
          (done ? '撤回' : '做好啦') + '</button>' +
      '</div>' +
      '<div class="order-acts">' +
        '<button class="link-btn" data-act="shopping" data-id="' + o.id + '">🧺 买菜清单</button>' +
        '<button class="link-btn" data-act="reorder" data-id="' + o.id + '">🔁 再做一次</button>' +
        '<button class="link-btn" data-act="del-order" data-id="' + o.id + '">删除</button>' +
      '</div>' +
    '</article>';
  }

  /* ================= 视图：菜谱 ================= */
  function manageView() {
    const rows = db.dishes.map((d) =>
      '<div class="mrow' + (d.off ? ' off' : '') + '">' +
        '<div class="m-emoji">' + esc(d.emoji || '🍽️') + '</div>' +
        '<div class="m-main"><div class="m-name">' + esc(d.name) + '</div>' +
          '<div class="m-sub">' + esc(d.cat) + (d.minutes ? ' · ' + d.minutes + ' 分钟' : '') + '</div></div>' +
        '<div class="m-acts">' +
          '<button class="mini" data-act="toggle-off" data-id="' + d.id + '">' + (d.off ? '叫回来' : '歇一天') + '</button>' +
          '<button class="mini accent" data-act="edit-dish" data-id="' + d.id + '">编辑</button>' +
        '</div>' +
      '</div>'
    ).join('');

    return '<div class="page-head"><h2>菜谱本</h2><span>' + db.dishes.length + ' 道</span></div>' +
      '<p class="tip">「歇一天」的菜先不出现在想吃里，随时可以叫回来～</p>' +
      '<div class="mlist">' + rows + '</div>' +
      '<button class="btn primary block big" data-act="new-dish">＋ 加一道新菜</button>';
  }

  /* ================= 视图：我们 ================= */
  function meView() {
    const ordered = {};
    db.orders.forEach((o) => o.items.forEach((it) => { ordered[it.name] = (ordered[it.name] || 0) + it.qty; }));
    const top = Object.keys(ordered).sort((a, b) => ordered[b] - ordered[a])[0];

    return '<div class="page-head"><h2>我们</h2></div>' +
      '<div class="card">' +
        '<div class="field"><label>小饭桌名字</label>' +
          '<input id="shop-name" value="' + esc(db.shop) + '" maxlength="16" placeholder="比如：小饭桌">' +
        '</div>' +
        '<p class="card-hint">改个你俩喜欢的名字，会出现在最上面～</p>' +
      '</div>' +
      '<div class="card">' +
        '<h3>一起吃过的</h3>' +
        '<div class="stat-grid">' +
          '<div class="stat-item"><b>' + db.dishes.length + '</b><span>道菜</span></div>' +
          '<div class="stat-item"><b>' + db.orders.length + '</b><span>顿饭</span></div>' +
          '<div class="stat-item"><b style="font-size:15px;line-height:1.9">' + esc(top || '—') + '</b><span>最常吃</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>数据</h3>' +
        '<button class="btn ghost block" data-act="export">导出备份</button>' +
        '<button class="btn ghost block" data-act="import">从备份回来</button>' +
        '<button class="btn ghost block" data-act="reset-seed">恢复示例菜谱</button>' +
        '<button class="btn danger block" data-act="wipe">清空所有</button>' +
        '<input type="file" id="import-file" accept=".json,application/json" hidden>' +
      '</div>' +
      '<p class="foot-note">这些只存在这台手机里，不会上传～<br>换手机之前记得先导出备份呀。</p>';
  }

  /* ================= 弹层 ================= */
  function openSheet(s) {
    sheet = s;
    renderSheet();
    document.body.classList.add('sheet-open');
  }

  function closeSheet() {
    sheet = null;
    draft = null;
    clearSheetDom();
    document.body.classList.remove('sheet-open');
  }

  function clearSheetDom() {
    const root = $('#sheet-root');
    if (root) root.innerHTML = '';
    document.body.classList.remove('sheet-open');
  }

  function renderSheet() {
    const root = $('#sheet-root');
    if (!sheet) { clearSheetDom(); return; }
    const html = sheetHtml();
    if (!html) { closeSheet(); return; }

    let s = root.querySelector('.sheet');
    const prevBody = root.querySelector('.sheet-body');
    const prevScroll = prevBody ? prevBody.scrollTop : 0;

    if (!root.querySelector('.backdrop') || !s) {
      root.innerHTML = '<div class="backdrop" data-act="close-sheet"></div><div class="sheet">' + html + '</div>';
    } else {
      s.innerHTML = html;
    }
    const nextBody = root.querySelector('.sheet-body');
    if (nextBody && prevScroll) nextBody.scrollTop = prevScroll;

    document.body.classList.add('sheet-open');
    hydratePhotos();
  }

  function sheetHead(title, sub) {
    return '<div class="sheet-grab"></div>' +
      '<div class="sheet-head"><h3>' + esc(title) + '</h3>' +
      (sub != null ? '<span class="sheet-sub">' + sub + '</span>' : '') +
      '<button class="sheet-x" data-act="close-sheet" aria-label="关闭">✕</button></div>';
  }

  function sheetHtml() {
    if (sheet.type === 'cart') return cartSheet();
    if (sheet.type === 'dish') {
      const d = dishById(sheet.id);
      return d ? dishSheet(d) : '';
    }
    if (sheet.type === 'edit') return editorSheet();
    if (sheet.type === 'shopping') {
      const o = db.orders.find((x) => x.id === sheet.id);
      return o ? shoppingSheet(o) : '';
    }
    return '';
  }

  /* -------- 想吃清单 -------- */
  function cartSheet() {
    if (!db.cart.length) {
      return sheetHead('想吃清单') + '<div class="sheet-body"><div class="empty" style="padding:36px 0">' +
        '<div class="ico">🧺</div><h3>还没挑菜呢</h3><p>回去看看想吃什么～</p></div></div>';
    }

    const lines = db.cart.map((c) => {
      const d = dishById(c.id);
      if (!d) return '';
      return '<div class="cart-line">' +
        '<div class="cl-emoji">' + esc(d.emoji || '🍽️') + '</div>' +
        '<div class="cl-main">' +
          '<div class="cl-top"><span class="cl-name">' + esc(d.name) + '</span></div>' +
          '<input class="cl-note" data-note="' + c.id + '" value="' + esc(c.note || '') + '"' +
            ' placeholder="有什么小要求？比如少辣～" maxlength="40" enterkeyhint="done">' +
        '</div>' +
        '<div class="qty">' +
          '<button data-act="dec" data-id="' + c.id + '" aria-label="减少">−</button>' +
          '<span>' + c.qty + '</span>' +
          '<button data-act="inc" data-id="' + c.id + '" aria-label="增加">+</button>' +
        '</div>' +
      '</div>';
    }).join('');

    return sheetHead('想吃清单', cartCount() + ' 个') +
      '<div class="sheet-body">' + lines +
        '<div class="field" style="margin-top:16px"><label>想说的话</label>' +
        '<input id="order-note" value="' + esc(db.note || '') + '" maxlength="60" placeholder="比如：今天想早点吃～">' +
        '</div>' +
      '</div>' +
      '<div class="sheet-foot">' +
        '<div class="sum">一共 ' + cartCount() + ' 个菜</div>' +
        '<button class="btn primary" data-act="submit">就这些！</button>' +
      '</div>';
  }

  /* -------- 菜品详情 -------- */
  function dishSheet(d) {
    const q = cartQty(d.id);
    const ings = (d.ingredients || []).map((x) => '<span>' + esc(x) + '</span>').join('');
    return sheetHead('这道菜') +
      '<div class="sheet-body">' +
        '<div class="dish-hero">' +
          '<div class="big-emoji">' +
            (d.photo ? '<img data-photo="' + d.id + '" alt="">' : '') +
            '<span>' + esc(d.emoji || '🍽️') + '</span>' +
          '</div>' +
          '<div><h2>' + esc(d.name) + '</h2>' +
            (d.desc ? '<p>' + esc(d.desc) + '</p>' : '') +
          '</div>' +
        '</div>' +
        (d.tags && d.tags.length
          ? '<div class="ing-list" style="margin-bottom:4px">' + d.tags.map((t) => '<span>' + esc(t) + '</span>').join('') + '</div>'
          : '') +
        (d.minutes ? '<p class="tip">大概要 ' + d.minutes + ' 分钟</p>' : '') +
        (ings ? '<div class="block-title">要用到</div><div class="ing-list">' + ings + '</div>' : '') +
      '</div>' +
      '<div class="sheet-foot">' +
        (q ? '<div class="sum">已经加过 <b style="font-size:15px">×' + q + '</b></div>' : '<div class="sum">现做现吃</div>') +
        '<button class="btn primary" data-act="add" data-id="' + d.id + '"' + (d.off ? ' disabled' : '') + '>' +
          (d.off ? '今天休息' : '加入想吃') + '</button>' +
      '</div>';
  }

  /* -------- 编辑菜品 -------- */
  function editorSheet() {
    const d = draft;
    const emojis = ['🍲', '🍗', '🥩', '🍅', '🥬', '🍆', '🌶️', '🍤', '🍚', '🍜', '🥟', '🍄', '🥔', '🧊', '🍋', '🥤'];
    return sheetHead(d.isNew ? '加一道新菜' : '改改这道菜') +
      '<form class="sheet-body" id="dish-form" autocomplete="off" onsubmit="return false">' +
        '<div class="photo-row">' +
          '<div class="photo-preview">' +
            (d.photo ? '<img data-photo="' + d.id + '" alt="">' : '') +
            '<span>' + esc(d.emoji || '🍲') + '</span>' +
          '</div>' +
          '<div class="photo-acts">' +
            '<label class="btn ghost small">选张照片<input type="file" id="dish-photo" accept="image/*" hidden></label>' +
            (d.photo ? '<button type="button" class="btn ghost small" data-act="clear-photo">移除</button>'
                     : '<small class="hint">不传就用表情代替</small>') +
          '</div>' +
        '</div>' +
        '<div class="field"><label>叫什么</label><input name="name" value="' + esc(d.name) + '" placeholder="比如：番茄炒蛋" maxlength="20"></div>' +
        '<div class="field"><label>归到哪一类</label><input name="cat" value="' + esc(d.cat) + '" list="cat-options" maxlength="8" placeholder="热炒">' +
          '<datalist id="cat-options">' + db.cats.map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist></div>' +
        '<div class="field"><label>一句话介绍</label><input name="desc" value="' + esc(d.desc || '') + '" placeholder="比如：汤汁拌饭一绝" maxlength="40"></div>' +
        '<div class="field"><label>大概要多久（分钟）</label><input name="minutes" type="number" inputmode="numeric" min="0" step="5" value="' + (d.minutes || '') + '" placeholder="20"></div>' +
        '<div class="field"><label>标签</label><input name="tags" value="' + esc((d.tags || []).join('，')) + '" placeholder="下饭，快手，微辣"></div>' +
        '<div class="field"><label>食材（一行一样，买菜清单会用到）</label>' +
          '<textarea name="ingredients" rows="4" placeholder="番茄 2个&#10;鸡蛋 3个&#10;糖 1小勺">' + esc((d.ingredients || []).join('\n')) + '</textarea></div>' +
        '<div class="field"><label>表情</label>' +
          '<input name="emoji" id="emoji-input" value="' + esc(d.emoji || '🍲') + '" maxlength="4" placeholder="🍲">' +
          '<div class="emoji-row">' + emojis.map((e) => '<button type="button" class="emoji-btn" data-act="pick-emoji" data-emoji="' + e + '">' + e + '</button>').join('') + '</div>' +
        '</div>' +
      '</form>' +
      '<div class="sheet-foot">' +
        (d.isNew ? '' : '<button class="btn ghost" data-act="del-dish">删除</button>') +
        '<button class="btn primary grow" data-act="save-dish">存好啦</button>' +
      '</div>';
  }

  /* -------- 买菜清单 -------- */
  function shoppingSheet(o) {
    const checked = new Set(o.shopping || []);
    let total = 0, done = 0;
    const groups = o.items.map((it, i) => {
      const lines = (it.ingredients || []).map((line, j) => {
        const key = i + ':' + j;
        total++;
        if (checked.has(key)) done++;
        return '<label class="check-row">' +
          '<input type="checkbox" data-act="check" data-order="' + o.id + '" data-key="' + key + '"' +
          (checked.has(key) ? ' checked' : '') + '><span>' + esc(line) + '</span></label>';
      }).join('');
      return '<div class="shop-group"><div class="shop-head">' + esc(it.emoji || '') + ' ' + esc(it.name) +
        ' <span>×' + it.qty + '</span></div>' + (lines || '<div class="check-row" style="opacity:.5">这道菜没写食材</div>') + '</div>';
    }).join('');

    return sheetHead('买菜清单', '<span id="shop-count">' + done + '/' + total + '</span>') +
      '<div class="sheet-body">' +
        '<p class="tip" style="margin:6px 0 2px">照着买就好，买一样勾一样～</p>' + groups +
      '</div>';
  }

  /* ================= 操作 ================= */
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1900);
  }

  function addToCart(id, n, silent) {
    const d = dishById(id);
    if (!d) return;
    if (d.off) { toast('这道菜今天休息啦'); return; }
    const c = cartLine(id);
    if (c) c.qty = clamp(c.qty + (n || 1), 1, 99);
    else db.cart.push({ id: id, qty: 1, note: '' });
    save();
    if (!silent) render(true);
  }

  function setQty(id, qty) {
    const c = cartLine(id);
    if (!c) return;
    if (qty <= 0) db.cart = db.cart.filter((x) => x.id !== id);
    else c.qty = clamp(qty, 1, 99);
    save();
    render(true);
  }

  function submitOrder() {
    if (!db.cart.length) return;
    const items = db.cart.map((c) => {
      const d = dishById(c.id);
      return {
        id: c.id,
        name: d.name,
        emoji: d.emoji,
        qty: c.qty,
        note: c.note || '',
        ingredients: (d.ingredients || []).slice()
      };
    });
    db.seq = (db.seq || 0) + 1;
    db.orders.unshift({
      id: uid(),
      no: db.seq,
      at: Date.now(),
      items: items,
      note: db.note || '',
      status: 'todo',
      shopping: []
    });
    db.cart = [];
    db.note = '';
    writeNow();
    closeSheet();
    ui.tab = 'orders';
    render(false);
    toast('记下啦，开火咯 🔥');
  }

  function mergeOrder(o) {
    let added = 0;
    o.items.forEach((it) => {
      if (!dishById(it.id)) return;
      const c = cartLine(it.id);
      if (c) c.qty = clamp(c.qty + it.qty, 1, 99);
      else db.cart.push({ id: it.id, qty: clamp(it.qty, 1, 99), note: it.note || '' });
      added += it.qty;
    });
    save();
    render(true);
    toast(added ? '又加进想吃 ' + added + ' 个菜' : '这些菜已经不在菜谱里了');
  }

  function luckyPick() {
    const pool = db.dishes.filter((d) => !d.off);
    if (!pool.length) { toast('菜谱本还空着呀'); return; }
    const pickFrom = (cats) => {
      const arr = pool.filter((d) => cats.indexOf(d.cat) >= 0);
      return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    };
    const picks = [];
    [pickFrom(['拿手菜', '热炒']), pickFrom(['素菜']), pickFrom(['汤汤']), pickFrom(['主食'])]
      .forEach((d) => { if (d && picks.indexOf(d) < 0) picks.push(d); });
    if (!picks.length) picks.push(pool[Math.floor(Math.random() * pool.length)]);
    picks.forEach((d) => addToCart(d.id, 1, true));
    render(true);
    toast('给你配了一桌：' + picks.map((d) => d.name).join('、'));
  }

  function openEditor(id) {
    if (id) {
      const d = dishById(id);
      if (!d) return;
      draft = Object.assign({}, d, { isNew: false });
    } else {
      draft = {
        id: 'p' + uid(), isNew: true, name: '', cat: ui.cat === '全部' ? '热炒' : ui.cat,
        desc: '', emoji: '🍲', minutes: '', tags: [], ingredients: [], off: false, photo: false
      };
    }
    openSheet({ type: 'edit' });
  }

  function readDraftForm() {
    const f = $('#dish-form');
    if (!f) return null;
    const get = (n) => {
      const el = f.querySelector('[name="' + n + '"]');
      return el ? el.value : '';
    };
    const name = get('name').trim();
    if (!name) { toast('先给这道菜起个名字呀'); return null; }
    const minutes = parseInt(get('minutes'), 10);
    const tags = get('tags').split(/[，,、\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    const ings = get('ingredients').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20);
    return {
      id: draft.id,
      name: name,
      cat: (get('cat').trim() || '热炒').slice(0, 8),
      desc: get('desc').trim().slice(0, 40),
      emoji: (get('emoji').trim() || '🍲').slice(0, 4),
      minutes: isFinite(minutes) && minutes > 0 ? minutes : 0,
      tags: tags,
      ingredients: ings,
      off: !!draft.off,
      photo: !!draft.photo
    };
  }

  /* 重绘表单前，先把没保存的输入收回草稿，免得被冲掉 */
  function syncDraftFromForm() {
    const f = $('#dish-form');
    if (!f || !draft) return;
    const get = (n) => {
      const el = f.querySelector('[name="' + n + '"]');
      return el ? el.value : '';
    };
    draft.name = get('name');
    draft.cat = get('cat');
    draft.desc = get('desc');
    draft.minutes = get('minutes');
    draft.tags = get('tags').split(/[，,、\s]+/).map((s) => s.trim()).filter(Boolean);
    draft.ingredients = get('ingredients').split('\n').map((s) => s.trim()).filter(Boolean);
    const em = get('emoji').trim();
    if (em) draft.emoji = em.slice(0, 4);
  }

  function saveDraft() {
    const dish = readDraftForm();
    if (!dish) return;
    const i = db.dishes.findIndex((x) => x.id === dish.id);
    if (i >= 0) db.dishes[i] = dish; else db.dishes.push(dish);
    if (db.cats.indexOf(dish.cat) < 0) db.cats.push(dish.cat);
    writeNow();
    const wasNew = draft.isNew;
    closeSheet();
    render(true);
    toast(wasNew ? '加进菜谱啦' : '改好啦');
  }

  function deleteDraft() {
    if (!draft) return;
    if (!confirm('把「' + (draft.name || '这道菜') + '」从菜谱里删掉吗？')) return;
    db.dishes = db.dishes.filter((x) => x.id !== draft.id);
    db.cart = db.cart.filter((x) => x.id !== draft.id);
    photoDel(draft.id);
    writeNow();
    closeSheet();
    render(true);
    toast('删掉啦');
  }

  async function pickPhoto(file) {
    if (!file || !draft) return;
    if (!/^image\//.test(file.type)) { toast('选一张图片呀'); return; }
    const targetId = draft.id;
    try {
      const blob = await compressImage(file, 880, 0.78);
      if (!draft || draft.id !== targetId) return;
      const ok = await photoPut(targetId, blob);
      if (ok && draft) {
        syncDraftFromForm();
        draft.photo = true;
        renderSheet();
      }
    } catch (e) {
      toast('这张图读不出来，换一张试试');
    }
  }

  function compressImage(file, max, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
      img.src = url;
    });
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  async function exportData() {
    toast('正在打包备份…');
    const photos = {};
    for (const d of db.dishes) {
      if (!d.photo) continue;
      const blob = await photoGet(d.id);
      if (blob) {
        try { photos[d.id] = await blobToDataUrl(blob); } catch (e) { /* skip */ }
      }
    }
    const payload = Object.assign({}, db, { _photos: photos });
    const text = JSON.stringify(payload, null, 2);

    const now = new Date();
    const stamp = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const name = '饭饭备份-' + stamp + '.json';

    if (window.DiancaiNative && window.DiancaiNative.exportBackup) {
      try {
        window.DiancaiNative.exportBackup(name, utf8ToBase64(text));
        toast('选个位置保存（含 ' + Object.keys(photos).length + ' 张照片）');
        return;
      } catch (e) { /* 落回网页下载 */ }
    }

    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('备份打包好啦（含 ' + Object.keys(photos).length + ' 张照片）');
  }

  async function restorePhotos(map) {
    if (!map || typeof map !== 'object') return;
    let n = 0;
    for (const id of Object.keys(map)) {
      try {
        const res = await fetch(map[id]);
        const blob = await res.blob();
        if (blob && blob.size) { await photoPut(id, blob); n++; }
      } catch (e) { /* 单张坏了不影响其它 */ }
    }
    if (n) render(true);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data = null;
      try { data = JSON.parse(String(reader.result)); } catch (e) { data = null; }
      if (!data || !Array.isArray(data.dishes) || !data.dishes.length) {
        toast('这个文件不是备份呀');
        return;
      }
      if (!confirm('用备份覆盖现在的菜谱和记录吗？（现在有 ' + db.dishes.length + ' 道菜）')) return;

      const next = defaultData();
      next.shop = typeof data.shop === 'string' && data.shop.trim() ? data.shop.trim().slice(0, 16) : '小饭桌';
      next.note = '';
      next.cart = [];
      next.cats = Array.isArray(data.cats) && data.cats.length ? data.cats.slice().map(catName) : DISH_CATS.slice();
      next.dishes = data.dishes.map((x) => Object.assign(
        { id: 'i' + uid(), name: '未命名', cat: '热炒', emoji: '🍽️', desc: '', minutes: 0, tags: [], ingredients: [], off: false, photo: false },
        x
      ));
      next.dishes.forEach((x) => {
        if (!Array.isArray(x.tags)) x.tags = [];
        if (!Array.isArray(x.ingredients)) x.ingredients = [];
        if (x.cat) x.cat = catName(x.cat);
        if (x.cat && next.cats.indexOf(x.cat) < 0) next.cats.push(x.cat);
      });
      next.cats = next.cats.filter((c, i) => next.cats.indexOf(c) === i);
      next.orders = Array.isArray(data.orders) ? data.orders : [];
      const maxNo = next.orders.reduce((m, o) => Math.max(m, Number(o.no) || 0), 0);
      next.seq = Math.max(Number(data.seq) || 0, maxNo);
      db = next;
      writeNow();
      closeSheet();
      render(false);
      toast('从备份回来啦');
      restorePhotos(data._photos);
    };
    reader.readAsText(file);
  }

  /* ================= 事件 ================= */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const id = el.dataset.id;

    switch (act) {
      case 'tab':
        ui.tab = el.dataset.tab;
        render(false);
        break;

      case 'cat':
        ui.cat = el.dataset.cat;
        render(false);
        break;

      case 'open-cart':
        openSheet({ type: 'cart' });
        break;

      case 'close-sheet':
        closeSheet();
        break;

      case 'add': {
        const inSheet = !!el.closest('.sheet');
        addToCart(id, 1, false);
        if (inSheet) { closeSheet(); toast('加进想吃啦 💗'); }
        break;
      }

      case 'inc':
        setQty(id, cartQty(id) + 1);
        break;

      case 'dec':
        setQty(id, cartQty(id) - 1);
        break;

      case 'submit':
        submitOrder();
        break;

      case 'dish':
        openSheet({ type: 'dish', id: id });
        break;

      case 'done': {
        const o = db.orders.find((x) => x.id === id);
        if (o) {
          o.status = o.status === 'done' ? 'todo' : 'done';
          writeNow();
          render(true);
          toast(o.status === 'done' ? '这顿吃上啦 🍚' : '改回等你做啦');
        }
        break;
      }

      case 'reorder': {
        const o = db.orders.find((x) => x.id === id);
        if (o) mergeOrder(o);
        break;
      }

      case 'shopping':
        openSheet({ type: 'shopping', id: id });
        break;

      case 'del-order': {
        const o = db.orders.find((x) => x.id === id);
        if (o && confirm('删掉「第 ' + o.no + ' 顿」的记录吗？')) {
          db.orders = db.orders.filter((x) => x.id !== id);
          writeNow();
          render(true);
        }
        break;
      }

      case 'new-dish':
        openEditor(null);
        break;

      case 'edit-dish':
        openEditor(id);
        break;

      case 'save-dish':
        saveDraft();
        break;

      case 'del-dish':
        deleteDraft();
        break;

      case 'clear-photo':
        if (draft) {
          syncDraftFromForm();
          draft.photo = false;
          photoDel(draft.id);
          renderSheet();
        }
        break;

      case 'pick-emoji': {
        const input = $('#emoji-input');
        if (input) {
          input.value = el.dataset.emoji;
          if (draft) draft.emoji = el.dataset.emoji;
          const prev = $('.photo-preview span');
          if (prev) prev.textContent = el.dataset.emoji;
        }
        break;
      }

      case 'toggle-off': {
        const d = dishById(id);
        if (d) {
          d.off = !d.off;
          writeNow();
          render(true);
          toast(d.off ? '先歇一天：' + d.name : '叫回来啦：' + d.name);
        }
        break;
      }

      case 'lucky':
        luckyPick();
        break;

      case 'export':
        exportData();
        break;

      case 'import': {
        const f = $('#import-file');
        if (f) f.click();
        break;
      }

      case 'reset-seed':
        if (confirm('把菜谱换回示例的 36 道菜？你自己加的那些会被覆盖（记录不受影响）。')) {
          db.dishes = SEED_DISHES.map((d) => Object.assign({}, d));
          db.cats = DISH_CATS.slice();
          db.cart = db.cart.filter((c) => db.dishes.some((d) => d.id === c.id));
          writeNow();
          render(false);
          toast('菜谱恢复成示例啦');
        }
        break;

      case 'wipe':
        if (confirm('清空所有菜、记录、照片和设置？这个不能撤销哦。')) {
          localStorage.removeItem(LS_KEY);
          photoClearAll();
          db = defaultData();
          writeNow();
          render(false);
          toast('清空啦，重新开始～');
        }
        break;

      default:
        break;
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.note !== undefined) {
      const c = cartLine(t.dataset.note);
      if (c) { c.note = t.value.slice(0, 40); save(); }
      return;
    }
    if (t.id === 'order-note') { db.note = t.value.slice(0, 60); save(); return; }
    if (t.id === 'shop-name') {
      db.shop = t.value.slice(0, 16) || '小饭桌';
      const h = $('.brand h1');
      if (h) h.textContent = db.shop;
      save();
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === 'dish-photo' && t.files && t.files[0]) {
      pickPhoto(t.files[0]);
      t.value = '';
      return;
    }

    if (t.id === 'import-file' && t.files && t.files[0]) {
      importData(t.files[0]);
      t.value = '';
      return;
    }

    if (t.dataset && t.dataset.act === 'check') {
      const o = db.orders.find((x) => x.id === t.dataset.order);
      if (!o) return;
      const set = new Set(o.shopping || []);
      if (t.checked) set.add(t.dataset.key); else set.delete(t.dataset.key);
      o.shopping = Array.from(set);
      save();
      const counter = $('#shop-count');
      if (counter) counter.textContent = set.size + '/' + $$('.check-row input').length;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet) closeSheet();
  });

  /* ================= 启动 ================= */
  render(false);

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0 && location.hostname !== 'app.local') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* 局域网 http 下不可用，无妨 */ });
    });
  }
})();
