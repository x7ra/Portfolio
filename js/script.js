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

// News en direct — flux RSS KrebsOnSecurity
let newsLoaded = false;

function toggleNewsPanel() {
    const panel = document.getElementById('newsPanel');
    const btn   = document.getElementById('toggleNews');
    const isOpen = panel.classList.contains('open');

    if (isOpen) {
        panel.classList.remove('open');
        btn.innerHTML = '<i class="fas fa-rss"></i> News en direct — KrebsOnSecurity';
    } else {
        panel.classList.add('open');
        btn.innerHTML = '<i class="fas fa-times"></i> Fermer les news';
        if (!newsLoaded) loadKrebsNews();
    }
}

function getTagText(item, tag) {
    const el = item.getElementsByTagName(tag)[0];
    if (!el) return '';
    // <link> en RSS est un nœud texte entre balises, pas un élément enfant classique
    if (tag === 'link') {
        for (let node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
                return node.nodeValue.trim();
            }
        }
        // fallback : nœud texte suivant la balise link (RSS quirk)
        const next = el.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE && next.nodeValue.trim()) {
            return next.nodeValue.trim();
        }
        return el.textContent.trim();
    }
    return el.textContent.trim();
}

function loadKrebsNews() {
    const container = document.getElementById('newsContent');
    const rssUrl    = 'https://krebsonsecurity.com/feed/';
    const proxyUrl  = 'https://corsproxy.io/?' + encodeURIComponent(rssUrl);

    fetch(proxyUrl)
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        })
        .then(text => {
            const parser = new DOMParser();
            const xml    = parser.parseFromString(text, 'text/xml');

            if (xml.querySelector('parsererror')) throw new Error('XML invalide');

            const items = Array.from(xml.getElementsByTagName('item')).slice(0, 8);
            if (!items.length) throw new Error('Aucun article');

            newsLoaded = true;
            container.innerHTML = items.map(item => {
                const title   = getTagText(item, 'title');
                const link    = getTagText(item, 'link');
                const pubDate = getTagText(item, 'pubDate');
                const desc    = getTagText(item, 'description');
                const date    = pubDate
                    ? new Date(pubDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '';
                const snippet = desc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160) + '…';

                return `
                <div class="news-item">
                    <div class="news-item-meta">
                        <span class="krebs-badge">KrebsOnSecurity</span>
                        ${date ? `<span><i class="fas fa-calendar-alt"></i> ${date}</span>` : ''}
                    </div>
                    <a href="${link || 'https://krebsonsecurity.com'}" target="_blank" rel="noopener">${title}</a>
                    <p>${snippet}</p>
                </div>`;
            }).join('');
        })
        .catch(err => {
            container.innerHTML = `<div class="news-error"><i class="fas fa-exclamation-triangle"></i> Impossible de charger le flux (${err.message}). <a href="https://krebsonsecurity.com" target="_blank" rel="noopener">Voir directement sur krebsonsecurity.com</a></div>`;
        });
}