// ============================================
// SUBDOMAIN FINDER PRO — SCRIPT
// by ryaakbar
// ============================================

let allSubdomains  = [];
let allCategories  = {};
let currentDomain  = '';
let activeCategory = 'all';
let toastTimer     = null;

// ── INIT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(el => { if (el.isIntersecting) el.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const navbar    = document.getElementById('navbar');
    const scrollBtns = document.getElementById('scrollBtns');
    window.addEventListener('scroll', () => {
        const s = window.scrollY > 20;
        navbar?.classList.toggle('scrolled', s);
        scrollBtns?.classList.toggle('visible', s);
    });
});

// ── INPUT ─────────────────────────────────
function onDomainInput(input) {
    document.getElementById('clearBtn').classList.toggle('show', input.value.length > 0);
}

function clearInput() {
    const input = document.getElementById('domainInput');
    input.value = '';
    document.getElementById('clearBtn').classList.remove('show');
    input.focus();
}

function setDomain(domain) {
    document.getElementById('domainInput').value = domain;
    document.getElementById('clearBtn').classList.add('show');
    document.getElementById('domainInput').focus();
}

// ── SCAN ──────────────────────────────────
async function startScan() {
    const domain = document.getElementById('domainInput').value.trim();
    if (!domain) {
        showToast('⚠️ Masukkan domain dulu bro!', 'error');
        document.getElementById('domainInput').focus();
        return;
    }

    setLoading(true);
    hideResult();
    hideError();

    document.getElementById('loadingDomain').textContent = domain;

    try {
        const res = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain }),
        });

        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            throw new Error(`Server error HTTP ${res.status}`);
        }

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        if (data.subdomains.length === 0) {
            showToast('🔍 Tidak ada subdomain ditemukan.', '');
            setLoading(false);
            return;
        }

        allSubdomains  = data.subdomains;
        allCategories  = data.categories || {};
        currentDomain  = data.domain;
        activeCategory = 'all';

        renderResult(data);
        setLoading(false);
        showToast(`🎯 ${data.total} subdomain ditemukan!`, 'success');

        setTimeout(() => {
            document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);

    } catch (err) {
        setLoading(false);
        showError(err.message);
        showToast('❌ ' + err.message, 'error');
    }
}

// ── RENDER RESULT ─────────────────────────
function renderResult(data) {
    // Header
    document.getElementById('resultDomain').textContent = data.domain;
    document.getElementById('resultCount').textContent = `${data.total} subdomain`;

    // Stats
    document.getElementById('statTotal').textContent     = data.total;
    document.getElementById('statUnique').textContent    = data.total;
    document.getElementById('statCategories').textContent = Object.keys(data.categories || {}).length;
    document.getElementById('statFiltered').textContent  = data.total;

    // Category tabs
    renderCatTabs(data.categories, data.total);

    // List
    renderList(data.subdomains);

    document.getElementById('resultCard').classList.remove('hidden');
    document.getElementById('filterInput').value = '';
}

function renderCatTabs(categories, total) {
    const tabs = document.getElementById('catTabs');

    const catIcons = {
        all:   '🌐', mail: '📧', api: '⚡', dev: '🧪',
        cdn:   '🗄️', admin: '🔐', auth: '🔑', vpn: '🛡️',
        db:    '🗃️', other: '📁',
    };

    const catLabels = {
        all: 'Semua', mail: 'Mail', api: 'API', dev: 'Dev/Staging',
        cdn: 'CDN/Static', admin: 'Admin', auth: 'Auth', vpn: 'VPN/Remote',
        db: 'Database', other: 'Lainnya',
    };

    let html = `
        <button class="cat-tab active" id="tab-all" onclick="switchCat('all')">
            ${catIcons.all} ${catLabels.all}
            <span class="cat-tab-count">${total}</span>
        </button>`;

    for (const [cat, items] of Object.entries(categories)) {
        html += `
            <button class="cat-tab" id="tab-${cat}" onclick="switchCat('${cat}')">
                ${catIcons[cat] || '📁'} ${catLabels[cat] || cat}
                <span class="cat-tab-count">${items.length}</span>
            </button>`;
    }

    tabs.innerHTML = html;
}

function switchCat(cat) {
    activeCategory = cat;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + cat)?.classList.add('active');

    const filterVal = document.getElementById('filterInput').value;
    filterSubdomains(filterVal);
}

function renderList(subdomains) {
    const list = document.getElementById('subdomainList');
    const filtered = document.getElementById('statFiltered');

    if (!subdomains.length) {
        list.innerHTML = `<div class="no-result">🔍 Tidak ada subdomain yang cocok</div>`;
        filtered.textContent = 0;
        return;
    }

    filtered.textContent = subdomains.length;

    list.innerHTML = subdomains.map((sub, i) => {
        const prefix = sub.replace('.' + currentDomain, '');
        const isRoot = sub === currentDomain;
        const displayText = isRoot
            ? `<span class="subdomain-prefix">${sub}</span>`
            : `<span class="subdomain-prefix">${prefix}</span><span class="subdomain-root">.${currentDomain}</span>`;

        return `
            <div class="subdomain-item" style="animation-delay:${Math.min(i * 20, 400)}ms">
                <div class="subdomain-text">${displayText}</div>
                <div class="subdomain-actions">
                    <button class="sub-action-btn" onclick="copySub('${sub}')" title="Copy">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button class="sub-action-btn open" onclick="openSub('${sub}')" title="Buka di tab baru">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                </div>
            </div>`;
    }).join('');
}

// ── FILTER ────────────────────────────────
function filterSubdomains(query) {
    let base = activeCategory === 'all'
        ? allSubdomains
        : (allCategories[activeCategory] || []);

    const filtered = query.trim()
        ? base.filter(s => s.includes(query.trim().toLowerCase()))
        : base;

    renderList(filtered);
}

// ── COPY & EXPORT ─────────────────────────
function copySub(sub) {
    navigator.clipboard.writeText(sub).then(() => {
        showToast('📋 Copied: ' + sub, 'success');
    });
}

function openSub(sub) {
    window.open('https://' + sub, '_blank');
}

function copyAll() {
    if (!allSubdomains.length) return;
    const text = allSubdomains.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        showToast(`📋 ${allSubdomains.length} subdomain copied!`, 'success');
    });
}

function exportTxt() {
    if (!allSubdomains.length) return;
    const content = [
        `# Subdomain Finder Pro — by ryaakbar`,
        `# Domain  : ${currentDomain}`,
        `# Total   : ${allSubdomains.length}`,
        `# Scanned : ${new Date().toLocaleString('id-ID')}`,
        `# WARNING : Gunakan dengan bijak dan bertanggung jawab`,
        '',
        ...allSubdomains,
    ].join('\n');

    download(`subdomains_${currentDomain}_${Date.now()}.txt`, content, 'text/plain');
    showToast('⬇️ Exported ke TXT!', 'success');
}

function exportJson() {
    if (!allSubdomains.length) return;
    const data = {
        meta: {
            tool: 'Subdomain Finder Pro by ryaakbar',
            domain: currentDomain,
            total: allSubdomains.length,
            scannedAt: new Date().toISOString(),
            warning: 'Gunakan dengan bijak dan bertanggung jawab',
        },
        subdomains: allSubdomains,
        categories: allCategories,
    };

    download(
        `subdomains_${currentDomain}_${Date.now()}.json`,
        JSON.stringify(data, null, 2),
        'application/json'
    );
    showToast('⬇️ Exported ke JSON!', 'success');
}

function download(filename, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
}

function clearResult() {
    allSubdomains  = [];
    allCategories  = {};
    currentDomain  = '';
    activeCategory = 'all';
    document.getElementById('resultCard').classList.add('hidden');
    document.getElementById('filterInput').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('🗑️ Result cleared', '');
}

// ── UI HELPERS ────────────────────────────
function setLoading(show) {
    const btn = document.getElementById('scanBtn');
    document.getElementById('loading').classList.toggle('hidden', !show);
    btn.disabled = show;
    btn.innerHTML = show
        ? '<i class="fa-solid fa-spinner fa-spin"></i><span>Scanning...</span>'
        : '<i class="fa-solid fa-magnifying-glass"></i><span>Mulai Scan</span><span class="btn-arrow">→</span>';
}
function hideResult()  { document.getElementById('resultCard').classList.add('hidden'); }
function hideError()   { document.getElementById('errorCard').classList.add('hidden'); }
function showError(msg) {
    document.getElementById('errorText').textContent = msg;
    document.getElementById('errorCard').classList.remove('hidden');
}

// ── TOAST ─────────────────────────────────
function showToast(msg, type = '') {
    clearTimeout(toastTimer);
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
