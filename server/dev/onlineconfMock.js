'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { json } = require('express');

const ENTRIES_PATH = '/api/onlineconf/admin/entries';
const MOCK_CSRF_TOKEN = 'onlineconf-mock-csrf';
const MOCK_VIEWER_UID = '11111111-1111-4111-8111-111111111111';
const MOCK_LIKES_BUCKET = Number(createHash('sha256').update('posts/likes_enabled:42').digest().readBigUInt64BE() % 100n);
const SCOPES = new Set(['frontend', 'auth', 'user', 'posts', 'community', 'backend']);
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const entries = [
    { uid: '11111111-1111-4111-8111-111111111111', scope: 'posts', name: 'likes_enabled', kind: 'flag', rollout: 100, include: [], exclude: [] },
    { uid: '22222222-2222-4222-8222-222222222222', scope: 'posts', name: 'max_text_length', kind: 'config', value: 256 },
    { uid: '33333333-3333-4333-8333-333333333333', scope: 'frontend', name: 'feed_title', kind: 'config', value: 'Лента' },
];

function listMockEntries(req, res) {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const scope = typeof req.query.scope === 'string' ? req.query.scope : '';
    const matchingEntries = entries.filter(entry =>
        (!scope || entry.scope === scope) && entry.name.toLowerCase().includes(query),
    );
    res.set('Cache-Control', 'private, no-store').json({ entries: matchingEntries });
}

function readUserIds(value, label) {
    if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !UUID_FORMAT.test(id))) {
        throw new Error('Списки включения и исключения должны содержать UUID');
    }
    const ids = value.map(id => id.toLowerCase());
    if (new Set(ids).size !== ids.length) {
        throw new Error('UUID повторяется в списке «' + label + '».');
    }
    return ids;
}

function readEntryValue({ scope, name, kind }, body) {
    if (!body || typeof body !== 'object') {
        throw new Error('Передайте данные ключа');
    }
    if (scope === 'posts' && name === 'likes_enabled' && kind !== 'flag') {
        throw new Error('posts.likes_enabled должен быть фича-флагом');
    }
    if (scope === 'posts' && name === 'max_text_length') {
        if (kind !== 'config' || !Number.isInteger(body.value) || body.value < 1 || body.value > 2048) {
            throw new Error('posts.max_text_length должен быть целым числом от 1 до 2048');
        }
    }

    if (kind === 'config') {
        if (!Object.hasOwn(body, 'value')) {
            throw new Error('Передайте значение конфига');
        }
        return { value: body.value };
    }

    const { rollout, include, exclude } = body;
    if (!Number.isInteger(rollout) || rollout < 0 || rollout > 100) {
        throw new Error('Процент раскатки должен быть целым числом от 0 до 100');
    }
    const includedIds = readUserIds(include, 'Принудительное включение');
    const excludedIds = readUserIds(exclude, 'Принудительное исключение');
    const excluded = new Set(excludedIds);
    const duplicate = includedIds.find(id => excluded.has(id));
    if (duplicate) {
        throw new Error('UUID ' + duplicate + ' указан в обоих списках. Оставьте его в одном списке.');
    }
    return { rollout, include: includedIds, exclude: excludedIds };
}

function createMockEntry(req, res) {
    const { scope, name, kind } = req.body ?? {};
    const keyName = typeof name === 'string' ? name.trim() : '';
    if (!SCOPES.has(scope) || !keyName || (kind !== 'config' && kind !== 'flag')) {
        res.status(400).json({ code: 'invalid_entry', message: 'Проверьте скоуп, имя и тип ключа' });
        return;
    }

    if (entries.some(entry => entry.scope === scope && entry.name === keyName)) {
        res.status(409).json({ code: 'entry_exists', message: 'Ключ с таким именем уже есть в этом скоупе' });
        return;
    }

    const metadata = { uid: randomUUID(), scope, name: keyName, kind };
    try {
        const entry = { ...metadata, ...readEntryValue(metadata, req.body) };
        entries.push(entry);
        res.status(201).json(entry);
    } catch (error) {
        res.status(400).json({ code: 'invalid_entry', message: error.message });
    }
}

function updateMockEntry(req, res) {
    const index = entries.findIndex(entry => entry.uid === req.params.uid);
    if (index === -1) {
        res.status(404).json({ code: 'entry_not_found', message: 'Ключ не найден' });
        return;
    }

    try {
        const entry = entries[index];
        entries[index] = { ...entry, ...readEntryValue(entry, req.body) };
        res.json(entries[index]);
    } catch (error) {
        res.status(400).json({ code: 'invalid_entry', message: error.message });
    }
}

function deleteMockEntry(req, res) {
    const index = entries.findIndex(entry => entry.uid === req.params.uid);
    if (index === -1) {
        res.status(404).json({ code: 'entry_not_found', message: 'Ключ не найден' });
        return;
    }

    entries.splice(index, 1);
    res.status(204).end();
}

function mockLikesEnabled() {
    const flag = entries.find(entry => entry.scope === 'posts' && entry.name === 'likes_enabled' && entry.kind === 'flag');
    return !flag || (!flag.exclude.includes(MOCK_VIEWER_UID) &&
        (flag.include.includes(MOCK_VIEWER_UID) || MOCK_LIKES_BUCKET < flag.rollout));
}

function rejectDisabledLike(_req, res, next) {
    if (mockLikesEnabled()) {
        next();
        return;
    }
    res.status(403).json({ code: 'feature_disabled', message: 'Лайки сейчас недоступны' });
}

function registerOnlineConfMock(app, mode) {
    app.get('/api/posts/runtime', (_req, res) => {
        res.set('Cache-Control', 'private, no-store');
        if (mode === 'guest') {
            res.status(401).json({ code: 'unauthorized', message: 'Требуется вход' });
            return;
        }
        const limit = entries.find(entry =>
            entry.scope === 'posts' && entry.name === 'max_text_length' && entry.kind === 'config',
        );
        res.json({ max_text_length: limit?.value ?? 256, likes_enabled: mockLikesEnabled() });
    });
    app.put('/api/posts/:uid/like', rejectDisabledLike);
    app.delete('/api/posts/:uid/like', rejectDisabledLike);
    app.get('/api/auth/me', (req, res, next) => {
        if (req.get('X-OnlineConf-Dev-Mock') !== '1') {
            next();
            return;
        }

        res.set('Cache-Control', 'private, no-store');
        if (mode === 'guest') {
            res.status(401).json({ code: 'unauthorized', message: 'Требуется вход' });
            return;
        }
        res.json({ csrf_token: MOCK_CSRF_TOKEN });
    });
    app.use(ENTRIES_PATH, (req, res, next) => {
        if (mode === 'guest') {
            res.status(401).json({ code: 'unauthorized', message: 'Требуется вход' });
            return;
        }
        if (mode === 'member') {
            res.status(403).json({ code: 'forbidden', message: 'Нет доступа к OnlineConf' });
            return;
        }
        if (['POST', 'PATCH', 'DELETE'].includes(req.method) && req.get('X-CSRF-Token') !== MOCK_CSRF_TOKEN) {
            res.status(403).json({ code: 'csrf_failed', message: 'Не прошла проверка CSRF. Повторите попытку.' });
            return;
        }
        next();
    });
    app.get(ENTRIES_PATH, listMockEntries);
    app.post(ENTRIES_PATH, json(), createMockEntry);
    app.patch(ENTRIES_PATH + '/:uid', json(), updateMockEntry);
    app.delete(ENTRIES_PATH + '/:uid', deleteMockEntry);
}

module.exports = { registerOnlineConfMock };
