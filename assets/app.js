/* 点菜 · 私人菜单 —— 单文件应用逻辑（无依赖） */
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
  const money = (n) => {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
  };

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
    me: '<path d="M4 7.5h7M16.5 7.5H20M4 16.5h3.5M13 16.5h7"/><circle cx="13.8" cy="7.5" r="2.3"/><circle cx="9.8" cy="16.5" r="2.3"/>'
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ================= 数据 ================= */
  function defaultData() {
    return {
      v: 1,
      shop: '小厨房',
      showPrice: true,
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
    d.cats = Array.isArray(raw.cats) && raw.cats.length ? raw.cats.slice() : DISH_CATS.slice();
    d.dishes.forEach((x) => {
      if (!x.id) x.id = uid();
      if (!Array.isArray(x.tags)) x.tags = [];
      if (!Array.isArray(x.ingredients)) x.ingredients = [];
      if (x.cat && d.cats.indexOf(x.cat) < 0) d.cats.push(x.cat);
    });
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
      toast('保存失败：浏览器存储空间可能满了');
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
      toast('图片保存失败，可能不支持本地存储');
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
  let draft = null;      // 正在编辑的菜

  /* ================= 选择器 ================= */
  const dishById = (id) => db.dishes.find((d) => d.id === id);
  const cartLine = (id) => db.cart.find((c) => c.id === id);
  const cartQty = (id) => (cartLine(id) || {}).qty || 0;
  const cartCount = () => db.cart.reduce((s, c) => s + c.qty, 0);
  const cartTotal = () => db.cart.reduce((s, c) => {
    const d = dishById(c.id);
    return s + (d ? (Number(d.price) || 0) * c.qty : 0);
  }, 0);

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
      '<div class="brand"><h1>' + esc(db.shop) + '</h1><span class="tag">私人菜单</span></div>' +
      '<button class="cart-btn" data-act="open-cart" aria-label="购物车">' + svg('bag') +
      '<span class="badge"' + (n ? '' : ' hidden') + '>' + n + '</span></button>';
  }

  function renderTabbar() {
    const tabs = [
      ['menu', '点菜', 'menu'],
      ['orders', '订单', 'orders'],
      ['manage', '菜单', 'manage'],
      ['me', '设置', 'me']
    ];
    $('#tabbar').innerHTML = tabs.map((t) =>
      '<button class="tab' + (ui.tab === t[0] ? ' active' : '') + '" data-act="tab" data-tab="' + t[0] + '">' +
      svg(t[2]) + '<span>' + t[1] + '</span></button>'
    ).join('');
  }

  function renderCartBar() {
    const wrap = $('#cartbar-wrap');
    if (!db.cart.length) { wrap.innerHTML = ''; return; }
    const n = cartCount();
    wrap.innerHTML =
      '<div class="cartbar">' +
      '<div class="cb-left">' +
      (db.showPrice
        ? '<span class="cb-count">' + n + ' 件</span><span class="cb-total"><small>¥</small>' + money(cartTotal()) + '</span>'
        : '<span class="cb-total" style="font-size:16px">' + n + ' 件</span>') +
      '</div>' +
      '<button class="cb-btn" data-act="open-cart">去下单</button></div>';
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

  /* ================= 视图：点菜 ================= */
  function menuView() {
    if (!db.dishes.length) return emptyBlock('🍽️', '菜单还是空的', '去「菜单」里加几道菜吧', 'tab', '去加菜');

    const counts = {};
    db.dishes.forEach((d) => { counts[d.cat] = (counts[d.cat] || 0) + 1; });
    const cats = ['全部'].concat(db.cats.filter((c) => counts[c]));
    // 分类条里没有的菜（历史数据）兜底
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
      '<p class="hero-kicker">TODAY · 私人菜单</p>' +
      '<h2 class="hero-title">点什么，<br>我做什么。</h2>' +
      '<p class="hero-sub">' + db.dishes.length + ' 道菜 · 挑好了就下单</p>' +
      '<button class="hero-dice" data-act="lucky">🎲 帮我配一桌</button>' +
      '</div>' +
      '<div class="catbar"><div class="catbar-inner">' + chips + '</div></div>' +
      (sections || emptyBlock('🍳', '这个分类还没有菜', '去「菜单」里加一道'));
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
        '<div class="dish-title"><h3>' + esc(d.name) + '</h3>' + (d.off ? '<span class="soldout">售罄</span>' : '') + '</div>' +
        (d.desc ? '<p class="dish-desc">' + esc(d.desc) + '</p>' : '') +
        '<div class="dish-meta">' +
          (db.showPrice && d.price ? '<span class="price">¥' + money(d.price) + '</span>' : '') +
          (d.minutes ? '<span class="mins">' + d.minutes + ' 分钟</span>' : '') +
          tags +
        '</div>' +
      '</div>' +
      '<div class="dish-act">' +
        (q ? '<span class="qbadge">' + q + '</span>' : '') +
        '<button class="add" data-act="add" data-id="' + d.id + '"' + (d.off ? ' disabled' : '') + ' aria-label="加入">+</button>' +
      '</div>' +
    '</article>';
  }

  /* ================= 视图：订单 ================= */
  function ordersView() {
    if (!db.orders.length) return emptyBlock('🧾', '还没有订单', '回「点菜」挑几道，下单后这里会记下来');
    const head = '<div class="page-head"><h2>我的订单</h2><span>' + db.orders.length + ' 单</span></div>';
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

    return '<article class="order">' +
      '<div class="order-head">' +
        '<span class="order-no">#' + String(o.no).padStart(3, '0') + '</span>' +
        '<span class="order-time">' + fmtTime(o.at) + '</span>' +
        '<span class="badge-status ' + (done ? 'done' : 'todo') + '">' + (done ? '已完成' : '待做') + '</span>' +
      '</div>' +
      '<ul class="order-items">' + items + '</ul>' +
      (o.note ? '<p class="order-note">整单备注：' + esc(o.note) + '</p>' : '') +
      '<div class="order-foot">' +
        (db.showPrice
          ? '<span class="order-total">合计<b>¥' + money(o.total) + '</b></span>'
          : '<span class="order-total">共 ' + o.items.reduce((s, i) => s + i.qty, 0) + ' 件</span>') +
        '<button class="mini ' + (done ? '' : 'green') + '" data-act="done" data-id="' + o.id + '">' +
          (done ? '撤回' : '做好了') + '</button>' +
      '</div>' +
      '<div class="order-acts">' +
        '<button class="link-btn" data-act="shopping" data-id="' + o.id + '">🧺 采购清单</button>' +
        '<button class="link-btn" data-act="reorder" data-id="' + o.id + '">🔁 再来一单</button>' +
        '<button class="link-btn" data-act="del-order" data-id="' + o.id + '">删除</button>' +
      '</div>' +
    '</article>';
  }

  /* ================= 视图：菜单管理 ================= */
  function manageView() {
    const rows = db.dishes.map((d) =>
      '<div class="mrow' + (d.off ? ' off' : '') + '">' +
        '<div class="m-emoji">' + esc(d.emoji || '🍽️') + '</div>' +
        '<div class="m-main"><div class="m-name">' + esc(d.name) + '</div>' +
          '<div class="m-sub">' + esc(d.cat) + (d.minutes ? ' · ' + d.minutes + ' 分钟' : '') +
          (db.showPrice && d.price ? ' · ¥' + money(d.price) : '') + '</div></div>' +
        '<div class="m-acts">' +
          '<button class="mini" data-act="toggle-off" data-id="' + d.id + '">' + (d.off ? '上架' : '下架') + '</button>' +
          '<button class="mini accent" data-act="edit-dish" data-id="' + d.id + '">编辑</button>' +
        '</div>' +
      '</div>'
    ).join('');

    return '<div class="page-head"><h2>菜单管理</h2><span>' + db.dishes.length + ' 道</span></div>' +
      '<p class="tip">「下架」的菜不出现在点菜页，但记录还在，随时可以再上架。</p>' +
      '<div class="mlist">' + rows + '</div>' +
      '<button class="btn primary block big" data-act="new-dish">＋ 新增一道菜</button>';
  }

  /* ================= 视图：设置 ================= */
  function meView() {
    const ordered = {};
    db.orders.forEach((o) => o.items.forEach((it) => { ordered[it.name] = (ordered[it.name] || 0) + it.qty; }));
    const top = Object.keys(ordered).sort((a, b) => ordered[b] - ordered[a])[0];

    return '<div class="page-head"><h2>设置</h2></div>' +
      '<div class="card">' +
        '<div class="field"><label>菜单名字</label>' +
          '<input id="shop-name" value="' + esc(db.shop) + '" maxlength="16" placeholder="比如：小厨房">' +
        '</div>' +
        '<div class="switch-row"><div><b>显示价格</b><small>关掉之后只看菜和食材</small></div>' +
          '<label class="switch"><input type="checkbox" id="show-price"' + (db.showPrice ? ' checked' : '') + '><span></span></label>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>统计</h3>' +
        '<div class="stat-grid">' +
          '<div class="stat-item"><b>' + db.dishes.length + '</b><span>道菜</span></div>' +
          '<div class="stat-item"><b>' + db.orders.length + '</b><span>个订单</span></div>' +
          '<div class="stat-item"><b style="font-size:15px;line-height:1.9">' + esc(top || '—') + '</b><span>点得最多</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>数据</h3>' +
        '<button class="btn ghost block" data-act="export">导出备份（JSON）</button>' +
        '<button class="btn ghost block" data-act="import">从备份恢复</button>' +
        '<button class="btn ghost block" data-act="reset-seed">恢复示例菜单</button>' +
        '<button class="btn danger block" data-act="wipe">清空全部数据</button>' +
        '<input type="file" id="import-file" accept=".json,application/json" hidden>' +
      '</div>' +
      '<p class="foot-note">数据只存在这台设备的浏览器里，不上传任何服务器。<br>换手机或清缓存前，记得先导出备份。</p>';
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

  /* -------- 购物车 -------- */
  function cartSheet() {
    if (!db.cart.length) {
      return sheetHead('购物车') + '<div class="sheet-body"><div class="empty" style="padding:36px 0">' +
        '<div class="ico">🛒</div><h3>还没点菜</h3><p>回去挑几道喜欢的</p></div></div>';
    }

    const lines = db.cart.map((c) => {
      const d = dishById(c.id);
      if (!d) return '';
      const linePrice = db.showPrice ? '¥' + money((Number(d.price) || 0) * c.qty) : '';
      return '<div class="cart-line">' +
        '<div class="cl-emoji">' + esc(d.emoji || '🍽️') + '</div>' +
        '<div class="cl-main">' +
          '<div class="cl-top"><span class="cl-name">' + esc(d.name) + '</span>' +
          (linePrice ? '<span class="cl-price">' + linePrice + '</span>' : '') + '</div>' +
          '<input class="cl-note" data-note="' + c.id + '" value="' + esc(c.note || '') + '"' +
            ' placeholder="口味备注，如：少辣、不要葱" maxlength="40" enterkeyhint="done">' +
        '</div>' +
        '<div class="qty">' +
          '<button data-act="dec" data-id="' + c.id + '" aria-label="减少">−</button>' +
          '<span>' + c.qty + '</span>' +
          '<button data-act="inc" data-id="' + c.id + '" aria-label="增加">+</button>' +
        '</div>' +
      '</div>';
    }).join('');

    return sheetHead('购物车', cartCount() + ' 件') +
      '<div class="sheet-body">' + lines +
        '<div class="field" style="margin-top:16px"><label>整单备注</label>' +
        '<input id="order-note" value="' + esc(db.note || '') + '" maxlength="60" placeholder="比如：七点开饭、米饭两碗">' +
        '</div>' +
      '</div>' +
      '<div class="sheet-foot">' +
        (db.showPrice
          ? '<div class="sum">合计<b>¥' + money(cartTotal()) + '</b></div>'
          : '<div class="sum">共 ' + cartCount() + ' 件</div>') +
        '<button class="btn primary" data-act="submit">下单</button>' +
      '</div>';
  }

  /* -------- 菜品详情 -------- */
  function dishSheet(d) {
    const q = cartQty(d.id);
    const ings = (d.ingredients || []).map((x) => '<span>' + esc(x) + '</span>').join('');
    return sheetHead('菜品详情') +
      '<div class="sheet-body">' +
        '<div class="dish-hero">' +
          '<div class="big-emoji">' +
            (d.photo ? '<img data-photo="' + d.id + '" alt="">' : '') +
            '<span>' + esc(d.emoji || '🍽️') + '</span>' +
          '</div>' +
          '<div><h2>' + esc(d.name) + '</h2>' +
            (d.desc ? '<p>' + esc(d.desc) + '</p>' : '') +
            (db.showPrice && d.price ? '<span class="price">¥' + money(d.price) + '</span>' : '') +
          '</div>' +
        '</div>' +
        (d.tags && d.tags.length
          ? '<div class="ing-list" style="margin-bottom:4px">' + d.tags.map((t) => '<span>' + esc(t) + '</span>').join('') + '</div>'
          : '') +
        (d.minutes ? '<p class="tip">大概需要 ' + d.minutes + ' 分钟</p>' : '') +
        (ings ? '<div class="block-title">用到的食材</div><div class="ing-list">' + ings + '</div>' : '') +
      '</div>' +
      '<div class="sheet-foot">' +
        (q ? '<div class="sum">已在购物车<b style="font-size:15px">×' + q + '</b></div>' : '<div class="sum">现点现做</div>') +
        '<button class="btn primary" data-act="add" data-id="' + d.id + '"' + (d.off ? ' disabled' : '') + '>' +
          (d.off ? '今天售罄' : '加入购物车') + '</button>' +
      '</div>';
  }

  /* -------- 编辑菜品 -------- */
  function editorSheet() {
    const d = draft;
    const emojis = ['🍲', '🍗', '🥩', '🍅', '🥬', '🍆', '🌶️', '🍤', '🍚', '🍜', '🥟', '🍄', '🥔', '🧊', '🍋', '🥤'];
    return sheetHead(d.isNew ? '新增一道菜' : '编辑菜品') +
      '<form class="sheet-body" id="dish-form" autocomplete="off" onsubmit="return false">' +
        '<div class="photo-row">' +
          '<div class="photo-preview">' +
            (d.photo ? '<img data-photo="' + d.id + '" alt="">' : '') +
            '<span>' + esc(d.emoji || '🍲') + '</span>' +
          '</div>' +
          '<div class="photo-acts">' +
            '<label class="btn ghost small">选张照片<input type="file" id="dish-photo" accept="image/*" hidden></label>' +
            (d.photo ? '<button type="button" class="btn ghost small" data-act="clear-photo">移除</button>'
                     : '<small class="hint">不传照片就用表情代替</small>') +
          '</div>' +
        '</div>' +
        '<div class="field"><label>菜名</label><input name="name" value="' + esc(d.name) + '" placeholder="例如：番茄炒蛋" maxlength="20"></div>' +
        '<div class="field"><label>分类</label><input name="cat" value="' + esc(d.cat) + '" list="cat-options" maxlength="8" placeholder="热菜">' +
          '<datalist id="cat-options">' + db.cats.map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist></div>' +
        '<div class="field"><label>一句话介绍</label><input name="desc" value="' + esc(d.desc || '') + '" placeholder="例如：汤汁拌饭一绝" maxlength="40"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>价格（元）</label><input name="price" type="number" inputmode="decimal" min="0" step="0.5" value="' + (d.price || '') + '" placeholder="0"></div>' +
          '<div class="field"><label>耗时（分钟）</label><input name="minutes" type="number" inputmode="numeric" min="0" step="5" value="' + (d.minutes || '') + '" placeholder="20"></div>' +
        '</div>' +
        '<div class="field"><label>标签</label><input name="tags" value="' + esc((d.tags || []).join('，')) + '" placeholder="下饭，快手，微辣"></div>' +
        '<div class="field"><label>食材（一行一样，用来生成采购清单）</label>' +
          '<textarea name="ingredients" rows="4" placeholder="番茄 2个&#10;鸡蛋 3个&#10;糖 1小勺">' + esc((d.ingredients || []).join('\n')) + '</textarea></div>' +
        '<div class="field"><label>表情</label>' +
          '<input name="emoji" id="emoji-input" value="' + esc(d.emoji || '🍲') + '" maxlength="4" placeholder="🍲">' +
          '<div class="emoji-row">' + emojis.map((e) => '<button type="button" class="emoji-btn" data-act="pick-emoji" data-emoji="' + e + '">' + e + '</button>').join('') + '</div>' +
        '</div>' +
      '</form>' +
      '<div class="sheet-foot">' +
        (d.isNew ? '' : '<button class="btn ghost" data-act="del-dish">删除</button>') +
        '<button class="btn primary grow" data-act="save-dish">保存</button>' +
      '</div>';
  }

  /* -------- 采购清单 -------- */
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
        ' <span>×' + it.qty + '</span></div>' + (lines || '<div class="check-row" style="opacity:.5">这道菜没记食材</div>') + '</div>';
    }).join('');

    return sheetHead('采购清单', '<span id="shop-count">' + done + '/' + total + '</span>') +
      '<div class="sheet-body">' +
        '<p class="tip" style="margin:6px 0 2px">照着买就行，买一样勾一样。</p>' + groups +
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
    if (d.off) { toast('这道菜今天不做了'); return; }
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
        price: Number(d.price) || 0,
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
      total: items.reduce((s, i) => s + i.price * i.qty, 0),
      status: 'todo',
      shopping: []
    });
    db.cart = [];
    db.note = '';
    writeNow();
    closeSheet();
    ui.tab = 'orders';
    render(false);
    toast('下单成功，开火 🔥');
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
    toast(added ? '已加入购物车 ' + added + ' 件' : '这些菜已经不在菜单里了');
  }

  function luckyPick() {
    const pool = db.dishes.filter((d) => !d.off);
    if (!pool.length) { toast('菜单还是空的'); return; }
    const pickFrom = (cats) => {
      const arr = pool.filter((d) => cats.indexOf(d.cat) >= 0);
      return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    };
    const picks = [];
    [pickFrom(['招牌', '热菜']), pickFrom(['素菜']), pickFrom(['汤羹']), pickFrom(['主食'])]
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
        id: 'p' + uid(), isNew: true, name: '', cat: ui.cat === '全部' ? '热菜' : ui.cat,
        desc: '', emoji: '🍲', price: '', minutes: '', tags: [], ingredients: [], off: false, photo: false
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
    if (!name) { toast('先给这道菜起个名字'); return null; }
    const price = parseFloat(get('price'));
    const minutes = parseInt(get('minutes'), 10);
    const tags = get('tags').split(/[，,、\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    const ings = get('ingredients').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20);
    return {
      id: draft.id,
      name: name,
      cat: (get('cat').trim() || '热菜').slice(0, 8),
      desc: get('desc').trim().slice(0, 40),
      emoji: (get('emoji').trim() || '🍲').slice(0, 4),
      price: isFinite(price) && price > 0 ? price : 0,
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
    draft.price = get('price');
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
    toast(wasNew ? '加进菜单了' : '改好了');
  }

  function deleteDraft() {
    if (!draft) return;
    if (!confirm('删除「' + (draft.name || '这道菜') + '」？')) return;
    db.dishes = db.dishes.filter((x) => x.id !== draft.id);
    db.cart = db.cart.filter((x) => x.id !== draft.id);
    photoDel(draft.id);
    writeNow();
    closeSheet();
    render(true);
    toast('已删除');
  }

  async function pickPhoto(file) {
    if (!file || !draft) return;
    if (!/^image\//.test(file.type)) { toast('请选择图片文件'); return; }
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
    const name = '点菜备份-' + stamp + '.json';

    // 安装包（Android 外壳）里没有下载目录权限，走原生保存对话框
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
    toast('备份已导出（含 ' + Object.keys(photos).length + ' 张照片）');
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
        toast('这个文件不是有效的备份');
        return;
      }
      if (!confirm('用备份覆盖当前菜单和订单？（现在是 ' + db.dishes.length + ' 道菜）')) return;

      const next = defaultData();
      next.shop = typeof data.shop === 'string' && data.shop.trim() ? data.shop.trim().slice(0, 16) : '小厨房';
      next.showPrice = data.showPrice !== false;
      next.note = '';
      next.cart = [];
      next.cats = Array.isArray(data.cats) && data.cats.length ? data.cats.slice() : DISH_CATS.slice();
      next.dishes = data.dishes.map((x) => Object.assign(
        { id: 'i' + uid(), name: '未命名', cat: '热菜', emoji: '🍽️', desc: '', price: 0, minutes: 0, tags: [], ingredients: [], off: false, photo: false },
        x
      ));
      next.dishes.forEach((x) => {
        if (!Array.isArray(x.tags)) x.tags = [];
        if (!Array.isArray(x.ingredients)) x.ingredients = [];
        if (x.cat && next.cats.indexOf(x.cat) < 0) next.cats.push(x.cat);
      });
      next.orders = Array.isArray(data.orders) ? data.orders : [];
      const maxNo = next.orders.reduce((m, o) => Math.max(m, Number(o.no) || 0), 0);
      next.seq = Math.max(Number(data.seq) || 0, maxNo);
      db = next;
      writeNow();
      closeSheet();
      render(false);
      toast('已从备份恢复');
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
        if (inSheet) { closeSheet(); toast('已加入购物车'); }
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
          toast(o.status === 'done' ? '这桌吃上了 🍚' : '已改回待做');
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
        if (o && confirm('删除订单 #' + String(o.no).padStart(3, '0') + '？')) {
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
          toast(d.off ? '已下架：' + d.name : '已上架：' + d.name);
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
        if (confirm('把菜单换回示例的 36 道菜？你自己加的菜会被覆盖（订单不受影响）。')) {
          db.dishes = SEED_DISHES.map((d) => Object.assign({}, d));
          db.cats = DISH_CATS.slice();
          db.cart = db.cart.filter((c) => db.dishes.some((d) => d.id === c.id));
          writeNow();
          render(false);
          toast('菜单已恢复成示例');
        }
        break;

      case 'wipe':
        if (confirm('清空所有菜品、订单、照片和设置？这个操作不能撤销。')) {
          localStorage.removeItem(LS_KEY);
          photoClearAll();
          db = defaultData();
          writeNow();
          render(false);
          toast('已清空');
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
      db.shop = t.value.slice(0, 16) || '小厨房';
      const h = $('.brand h1');
      if (h) h.textContent = db.shop;
      save();
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === 'show-price') {
      db.showPrice = !!t.checked;
      writeNow();
      render(true);
      return;
    }

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
