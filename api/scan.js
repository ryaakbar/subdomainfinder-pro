// api/scan.js — Subdomain Finder via crt.sh
const axios = require('axios');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { domain } = req.body;

        if (!domain || !domain.trim()) {
            return res.status(400).json({ error: 'Domain wajib diisi.' });
        }

        // Sanitasi domain — hapus protokol, path, spasi
        const cleanDomain = domain.trim()
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./i, '')
            .split('/')[0]
            .split(':')[0]
            .toLowerCase();

        // Validasi format domain
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(cleanDomain)) {
            return res.status(400).json({ error: `"${cleanDomain}" bukan format domain yang valid.` });
        }

        const url = `https://crt.sh/?q=${encodeURIComponent('%.' + cleanDomain)}&output=json`;

        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
                'Accept': 'application/json',
            },
        });

        if (!Array.isArray(response.data)) {
            return res.status(200).json({
                domain: cleanDomain,
                subdomains: [],
                total: 0,
                message: 'Tidak ada subdomain ditemukan.',
            });
        }

        // Parse & deduplicate
        const raw = response.data
            .map(v => v.name_value)
            .flatMap(v => v.split('\n'))
            .map(v => v.trim().toLowerCase().replace(/^\*\./, ''))
            .filter(v => v.endsWith('.' + cleanDomain) || v === cleanDomain)
            .filter(v => !v.includes('*'));

        const unique = [...new Set(raw)].sort();

        // Kategorisasi
        const categories = categorize(unique, cleanDomain);

        return res.status(200).json({
            domain: cleanDomain,
            subdomains: unique,
            total: unique.length,
            categories,
            scannedAt: new Date().toISOString(),
        });

    } catch (error) {
        console.error('[scan] Error:', error.message);

        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return res.status(504).json({ error: 'Request timeout. crt.sh lagi lambat, coba lagi.' });
        }

        return res.status(500).json({ error: 'Gagal scan: ' + error.message });
    }
};

function categorize(subdomains, domain) {
    const cats = {
        mail:    [],
        api:     [],
        dev:     [],
        cdn:     [],
        admin:   [],
        auth:    [],
        vpn:     [],
        db:      [],
        other:   [],
    };

    const patterns = {
        mail:  /^(mail|smtp|imap|pop|mx|webmail|email)\./i,
        api:   /^(api|rest|graphql|ws|webhook|gateway)\./i,
        dev:   /^(dev|staging|test|beta|sandbox|preview|demo|qa|uat|local)\./i,
        cdn:   /^(cdn|static|assets|media|img|images|files|download|s3|storage)\./i,
        admin: /^(admin|dashboard|panel|cp|cpanel|wp-admin|manage|console|portal)\./i,
        auth:  /^(auth|login|sso|oauth|id|account|accounts|secure|ssl)\./i,
        vpn:   /^(vpn|remote|rdp|ssh|ftp|sftp)\./i,
        db:    /^(db|database|mysql|mongo|redis|postgres|sql|phpmyadmin)\./i,
    };

    for (const sub of subdomains) {
        let matched = false;
        for (const [cat, regex] of Object.entries(patterns)) {
            const prefix = sub.replace('.' + domain, '');
            if (regex.test(prefix + '.')) {
                cats[cat].push(sub);
                matched = true;
                break;
            }
        }
        if (!matched) cats.other.push(sub);
    }

    // Hapus kategori kosong
    return Object.fromEntries(Object.entries(cats).filter(([, v]) => v.length > 0));
}
