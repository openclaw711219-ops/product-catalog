// ===== 設定 =====
// 夫人的 Google Sheets 發布連結（CSV 格式）
// 使用方式：Google Sheets → 檔案 → 發布到網路 → 選 CSV → 發布 → 貼連結到這裡
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQQSXFcyk5gC3v2UyDdx8Zxc5nyU39JtMm-P6lasFiKio1cppEMZ84LyA0JXFTQQ/pub?gid=1493491304&single=true&output=csv';

// 如果還沒設定 Google Sheets，使用示範資料
const DEMO_DATA = [
  { name: '碎花雪紡洋裝', category: '女裝', image: '', desc: '輕柔雪紡材質，碎花圖案設計，適合春夏穿搭。腰部鬆緊帶設計，穿著舒適不緊繃。\n\n尺寸：均碼（適合 S-L）\n顏色：粉色、藍色' },
  { name: '棉質條紋上衣', category: '女裝', image: '', desc: '100% 純棉材質，經典條紋設計，百搭實穿。\n\n尺寸：M / L / XL\n顏色：黑白條紋、藍白條紋' },
  { name: '高腰牛仔寬褲', category: '女裝', image: '', desc: '高腰修身設計，寬褲版型修飾腿型。彈性牛仔布料，久坐也舒適。\n\n尺寸：S / M / L / XL\n顏色：深藍、淺藍' },
  { name: '兒童恐龍T恤', category: '童裝', image: '', desc: '可愛恐龍印花，100% 純棉，親膚透氣。\n\n尺寸：90 / 100 / 110 / 120 / 130\n顏色：綠色、灰色' },
  { name: '兒童防曬外套', category: '童裝', image: '', desc: '輕薄防曬材質，UPF 50+ 防曬係數。連帽設計，方便收納。\n\n尺寸：100 / 110 / 120 / 130 / 140\n顏色：粉色、藍色、白色' },
  { name: '卡通圖案童襪（3入）', category: '童裝', image: '', desc: '可愛卡通圖案，棉質混紡，吸汗透氣。一組三雙不同圖案。\n\n尺寸：S(15-18cm) / M(19-22cm)\n顏色：隨機出貨' },
  { name: '北歐風保溫杯', category: '生活用品', image: '', desc: '304不鏽鋼內膽，真空雙層保溫。北歐簡約設計，容量 500ml。保溫效果約 6-8 小時。\n\n顏色：白色、綠色、粉色' },
  { name: '棉麻收納籃', category: '生活用品', image: '', desc: '棉麻材質，手工編織，可折疊收納。適合放置雜物、衣物、玩具。\n\n尺寸：小(20x15cm) / 大(30x25cm)\n顏色：米白、灰色' },
  { name: '香氛擴香瓶', category: '生活用品', image: '', desc: '天然植物精油，持久淡雅香氣。玻璃瓶身，附擴香竹。適合擺放客廳、臥室、浴室。\n\n容量：120ml\n香味：白茶、薰衣草、柑橘' },
];

// ===== 快取設定 =====
const CACHE_KEY = 'product_catalog_data';
const CACHE_TIME_KEY = 'product_catalog_time';
const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 分鐘內用快取，超過就背景更新

// ===== 全域變數 =====
let allProducts = [];
let currentCategory = 'all';
let currentSearch = '';

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // 清除舊版快取（圖片連結格式已更新）
  const CACHE_VER = 'v2';
  if (localStorage.getItem('cache_ver') !== CACHE_VER) {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    localStorage.setItem('cache_ver', CACHE_VER);
  }

  // 載入資料（優先用快取）
  if (SHEET_CSV_URL) {
    const cached = loadFromCache();
    if (cached) {
      // 有快取 → 先用快取顯示，背景更新
      allProducts = cached;
      console.log('📦 使用本地快取資料，背景更新中...');
      refreshInBackground();
    } else {
      // 沒快取 → 正常載入
      try {
        allProducts = await fetchSheetData(SHEET_CSV_URL);
        saveToCache(allProducts);
      } catch (e) {
        console.error('Google Sheets 載入失敗，使用示範資料', e);
        allProducts = DEMO_DATA;
      }
    }
  } else {
    allProducts = DEMO_DATA;
  }

  // 建立分類按鈕
  buildCategoryButtons();
  
  // 顯示產品
  renderProducts();
  
  // 綁定事件
  bindEvents();
  
  // 隱藏載入中
  document.getElementById('loading').style.display = 'none';

  // 註冊 Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ===== 快取功能 =====
function saveToCache(products) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(products));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
  } catch (e) {
    console.warn('快取儲存失敗', e);
  }
}

function loadFromCache() {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

async function refreshInBackground() {
  try {
    const freshData = await fetchSheetData(SHEET_CSV_URL);
    saveToCache(freshData);
    // 如果資料有變動，更新畫面
    if (JSON.stringify(freshData) !== JSON.stringify(allProducts)) {
      allProducts = freshData;
      buildCategoryButtons();
      renderProducts();
      console.log('✅ 資料已背景更新');
    }
  } catch (e) {
    console.warn('背景更新失敗，繼續使用快取', e);
  }
}

// ===== 從 Google Sheets 載入資料 =====
async function fetchSheetData(url) {
  const res = await fetch(url);
  const text = await res.text();
  
  // 正確解析 CSV（處理引號內的換行和逗號）
  const rows = parseCSV(text);
  if (rows.length < 2) return DEMO_DATA;
  
  const products = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length >= 4 && cols[0].trim()) {
      products.push({
        name: cols[0].trim(),
        category: cols[1].trim(),
        image: fixImageUrl(cols[2]),
        desc: cols[3].trim(),
        sort: cols[4] ? parseInt(cols[4]) : 999
      });
    }
  }
  
  products.sort((a, b) => (a.sort || 999) - (b.sort || 999));
  return products;
}

// 完整 CSV 解析器（正確處理引號內的換行）
function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\r' && next === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
        i++;
      } else if (ch === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  
  if (field || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  
  return rows;
}

// 自動修正 Google Drive 圖片連結
function fixImageUrl(url) {
  if (!url) return '';
  url = url.trim();
  
  // 從各種 Google Drive 連結格式中提取 file ID
  let fileId = null;
  
  // 格式1: https://drive.google.com/file/d/FILE_ID/...
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) fileId = match[1];
  
  // 格式2: https://drive.google.com/uc?id=FILE_ID...
  if (!fileId) {
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) fileId = match[1];
  }
  
  // 格式3: https://drive.google.com/open?id=FILE_ID
  if (!fileId) {
    match = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
    if (match) fileId = match[1];
  }

  // 格式4: https://drive.google.com/thumbnail?id=FILE_ID
  if (!fileId) {
    match = url.match(/thumbnail\?id=([a-zA-Z0-9_-]+)/);
    if (match) fileId = match[1];
  }
  
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
  }
  
  return url; // 非 Google Drive 連結，原樣返回
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ===== 建立分類按鈕 =====
function buildCategoryButtons() {
  const nav = document.querySelector('.category-nav');
  // 保留「全部」按鈕，移除其他分類按鈕
  const allBtn = nav.querySelector('.cat-btn[data-category="all"]');
  nav.innerHTML = '';
  if (allBtn) nav.appendChild(allBtn);
  
  const categories = [...new Set(allProducts.map(p => p.category))];
  
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    if (cat === currentCategory) btn.classList.add('active');
    btn.dataset.category = cat;
    btn.textContent = cat;
    nav.appendChild(btn);
  });
}

// ===== 篩選與渲染 =====
function getFilteredProducts() {
  return allProducts.filter(p => {
    const matchCat = currentCategory === 'all' || p.category === currentCategory;
    const matchSearch = !currentSearch || 
      p.name.includes(currentSearch) || 
      p.desc.includes(currentSearch) ||
      p.category.includes(currentSearch);
    return matchCat && matchSearch;
  });
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const filtered = getFilteredProducts();
  
  // 更新結果資訊
  const info = document.getElementById('resultInfo');
  if (currentSearch) {
    info.textContent = `搜尋「${currentSearch}」找到 ${filtered.length} 件商品`;
  } else if (currentCategory !== 'all') {
    info.textContent = `${currentCategory} - 共 ${filtered.length} 件`;
  } else {
    info.textContent = `共 ${filtered.length} 件商品`;
  }
  
  // 清空網格
  grid.innerHTML = '';
  
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="no-result">找不到相關產品 😕</div>';
    return;
  }
  
  filtered.forEach((product, idx) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => showDetail(product);
    
    const imgSrc = product.image || '';
    const imgHTML = imgSrc 
      ? `<img src="${imgSrc}" alt="${product.name}" loading="lazy" onerror="this.className='img-error';this.outerHTML='<div class=\\'img-error\\' style=\\'width:100%;aspect-ratio:1;\\'>📷</div>'">`
      : `<div class="img-error" style="width:100%;aspect-ratio:1;">📷</div>`;
    
    card.innerHTML = `
      ${imgHTML}
      <div class="card-info">
        <div class="card-name">${product.name}</div>
        <div class="card-category">${product.category}</div>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

// ===== 產品詳情 =====
function showDetail(product) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalImg').src = product.image || '';
  document.getElementById('modalImg').style.display = product.image ? 'block' : 'none';
  document.getElementById('modalTitle').textContent = product.name;
  document.getElementById('modalCategory').textContent = product.category;
  document.getElementById('modalDesc').textContent = product.desc;
  
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function hideDetail() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ===== 事件綁定 =====
function bindEvents() {
  // 搜尋
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');
  let searchTimer;
  
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearch = searchInput.value.trim();
      clearBtn.style.display = currentSearch ? 'flex' : 'none';
      renderProducts();
    }, 300);
  });
  
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    clearBtn.style.display = 'none';
    renderProducts();
    searchInput.focus();
  });
  
  // 分類
  document.querySelector('.category-nav').addEventListener('click', (e) => {
    if (e.target.classList.contains('cat-btn')) {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.dataset.category;
      renderProducts();
    }
  });
  
  // 詳情彈窗
  document.getElementById('modalClose').addEventListener('click', hideDetail);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideDetail();
  });
  
  // 返回鍵關閉彈窗
  window.addEventListener('popstate', () => {
    if (document.getElementById('modalOverlay').classList.contains('show')) {
      hideDetail();
    }
  });
  
  // 回到頂部按鈕
  const backBtn = document.getElementById('backToTop');
  window.addEventListener('scroll', () => {
    backBtn.classList.toggle('show', window.scrollY > 400);
  });
  backBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
