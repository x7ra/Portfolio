// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// Flux RSS de veille 2026
const RSS_FEEDS = {
    'cert-complet': {
        label: 'CERT-FR',
        badge: 'CERT-FR',
        url: 'https://www.cert.ssi.gouv.fr/feed/',
        homepage: 'https://www.cert.ssi.gouv.fr/'
    },
    'cert-alertes': {
        label: 'CERT-FR Alertes',
        badge: 'CERT-FR',
        url: 'https://www.cert.ssi.gouv.fr/alerte/feed/',
        homepage: 'https://www.cert.ssi.gouv.fr/alerte/'
    },
    'cert-avis': {
        label: 'CERT-FR Avis',
        badge: 'CERT-FR',
        url: 'https://www.cert.ssi.gouv.fr/avis/feed/',
        homepage: 'https://www.cert.ssi.gouv.fr/avis/'
    },
    'cert-actus': {
        label: 'CERT-FR Actualités',
        badge: 'CERT-FR',
        url: 'https://www.cert.ssi.gouv.fr/actualite/feed/',
        homepage: 'https://www.cert.ssi.gouv.fr/actualite/'
    },
    'krebs': {
        label: 'KrebsOnSecurity',
        badge: 'Krebs',
        url: 'https://krebsonsecurity.com/feed/',
        homepage: 'https://krebsonsecurity.com/'
    }
};

let newsLoaded = false;
let currentFeed = 'cert-complet';
let loadedFeed = null;

function toggleNewsPanel() {
    const panel = document.getElementById('newsPanel');
    const btn = document.getElementById('toggleNews');
    if (!panel || !btn) return;

    const isOpen = panel.classList.contains('open');

    if (isOpen) {
        panel.classList.remove('open');
        btn.innerHTML = '<i class="fas fa-rss"></i> Voir les 4 derniers articles';
    } else {
        panel.classList.add('open');
        btn.innerHTML = '<i class="fas fa-times"></i> Masquer les articles';
        if (!newsLoaded || loadedFeed !== currentFeed) loadRssFeed(currentFeed);
    }
}

function setActiveFeed(feedKey) {
    if (!RSS_FEEDS[feedKey]) return;
    currentFeed = feedKey;
    newsLoaded = false;

    document.querySelectorAll('.rss-feed-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.feed === feedKey);
    });

    const panel = document.getElementById('newsPanel');
    if (panel && panel.classList.contains('open')) {
        loadRssFeed(feedKey);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.rss-feed-btn').forEach(btn => {
        btn.addEventListener('click', () => setActiveFeed(btn.dataset.feed));
    });

    const panel = document.getElementById('newsPanel');
    if (panel && panel.classList.contains('open')) {
        loadRssFeed(currentFeed);
    }
});

function getTagText(item, tag) {
    const el = item.getElementsByTagName(tag)[0];
    if (!el) return '';
    return el.textContent.trim();
}

function cleanText(value, maxLength = 190) {
    const text = (value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength).trim() + '…' : text;
}

async function fetchRssJson(url) {
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url);
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    if (data.status !== 'ok' || !Array.isArray(data.items)) {
        throw new Error(data.message || 'Flux JSON indisponible');
    }

    return data.items.slice(0, 4).map(item => ({
        title: item.title,
        link: item.link,
        date: item.pubDate,
        desc: item.description || item.content || ''
    }));
}

async function fetchWithFallback(url) {
    const attempts = [
        url,
        'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
        'https://corsproxy.io/?' + encodeURIComponent(url)
    ];

    let lastError = null;
    for (const attempt of attempts) {
        try {
            const response = await fetch(attempt);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return await response.text();
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('Flux indisponible');
}

async function getFeedItems(feed) {
    try {
        return await fetchRssJson(feed.url);
    } catch (jsonError) {
        const text = await fetchWithFallback(feed.url);
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        if (xml.querySelector('parsererror')) throw new Error('XML invalide');
        return parseItems(xml);
    }
}

function parseItems(xml) {
    const rssItems = Array.from(xml.getElementsByTagName('item'));
    if (rssItems.length) return rssItems.slice(0, 4).map(item => ({
        title: getTagText(item, 'title'),
        link: getTagText(item, 'link'),
        date: getTagText(item, 'pubDate') || getTagText(item, 'dc:date'),
        desc: getTagText(item, 'description')
    }));

    const atomItems = Array.from(xml.getElementsByTagName('entry'));
    return atomItems.slice(0, 4).map(entry => {
        const linkEl = entry.getElementsByTagName('link')[0];
        return {
            title: getTagText(entry, 'title'),
            link: linkEl ? (linkEl.getAttribute('href') || linkEl.textContent.trim()) : '',
            date: getTagText(entry, 'updated') || getTagText(entry, 'published'),
            desc: getTagText(entry, 'summary') || getTagText(entry, 'content')
        };
    });
}

function formatRssDate(dateValue) {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function loadRssFeed(feedKey = currentFeed) {
    const container = document.getElementById('newsContent');
    const title = document.getElementById('newsPanelTitle');
    const feed = RSS_FEEDS[feedKey] || RSS_FEEDS['cert-complet'];
    if (!container) return;

    if (title) {
        title.innerHTML = `<i class="fas fa-circle news-live-dot"></i> Flux en direct — ${feed.label}`;
    }

    container.innerHTML = '<div class="news-loading"><i class="fas fa-spinner fa-spin"></i> Chargement des articles...</div>';

    try {
        const items = await getFeedItems(feed);
        if (!items.length) throw new Error('Aucun article trouvé');

        newsLoaded = true;
        loadedFeed = feedKey;
        container.innerHTML = items.map(item => {
            const date = formatRssDate(item.date);
            const snippet = cleanText(item.desc, 140);
            const safeLink = item.link || feed.homepage;
            const safeTitle = cleanText(item.title, 120) || 'Article sans titre';

            return `
                <div class="news-item">
                    <div class="news-item-meta">
                        <span class="feed-badge">${feed.badge}</span>
                        ${date ? `<span><i class="fas fa-calendar-alt"></i> ${date}</span>` : ''}
                    </div>
                    <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>
                    ${snippet ? `<p>${snippet}</p>` : ''}
                </div>`;
        }).join('');
    } catch (error) {
        container.innerHTML = `<div class="news-error"><i class="fas fa-exclamation-triangle"></i> Le chargement automatique est temporairement indisponible. <br><a href="${feed.homepage}" target="_blank" rel="noopener noreferrer">Ouvrir directement ${feed.label}</a></div>`;
    }
}
