'use strict';

const entries = [
    { id: 'posts-likes', scope: 'posts', name: 'likes_enabled', kind: 'flag', rollout: 100, include: [], exclude: [] },
    { id: 'posts-max-text', scope: 'posts', name: 'max_text_length', kind: 'config', value: 256 },
    { id: 'frontend-feed-title', scope: 'frontend', name: 'feed_title', kind: 'config', value: 'Лента' },
];

function listMockEntries(req, res) {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const scope = typeof req.query.scope === 'string' ? req.query.scope : '';
    const matchingEntries = entries.filter(entry =>
        (!scope || entry.scope === scope) && entry.name.toLowerCase().includes(query),
    );
    res.set('Cache-Control', 'private, no-store').json({ entries: matchingEntries });
}

module.exports = { listMockEntries };
