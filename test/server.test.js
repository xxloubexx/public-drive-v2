// End-to-end: starts the real server and exercises every route, so a broken dependency fails here.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const DIR = `test-${Date.now()}`;
let server;

before(() => new Promise((resolve, reject) => {
    server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
        env: { ...process.env, PORT: String(PORT) },
    });
    const timer = setTimeout(() => reject(new Error('server did not start')), 10000);
    server.stdout.on('data', (d) => { if (d.includes('localhost')) { clearTimeout(timer); resolve(); } });
    server.on('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited (${code})`)); });
}));

after(() => server.kill());

function upload(name, content, folder) {
    const fd = new FormData();
    fd.append('folder', folder);
    fd.append('file', new Blob([content]), name);
    return fetch(`${BASE}/upload`, { method: 'POST', body: fd });
}

test('serves the frontend', async () => {
    for (const file of ['/', '/script.js', '/style.css']) {
        const res = await fetch(BASE + file);
        assert.strictEqual(res.status, 200, file);
    }
});

test('creates a folder', async () => {
    const post = (name) => fetch(`${BASE}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    assert.strictEqual((await post(DIR)).status, 200);
    assert.strictEqual((await post(DIR)).status, 400, 'duplicate folder');
    assert.strictEqual((await post('bad|name')).status, 400, 'invalid chars');
});

test('uploads a .txt and rejects other types', async () => {
    const ok = await upload('hello.txt', 'hello world', DIR);
    assert.strictEqual(ok.status, 200);
    assert.strictEqual((await ok.json()).file.name, 'hello.txt');

    assert.strictEqual((await upload('evil.exe', 'x', DIR)).status, 400);
});

test('lists, downloads and views the file', async () => {
    const list = await (await fetch(`${BASE}/files?path=${DIR}`)).json();
    assert.ok(list.items.some((i) => i.name === 'hello.txt'));

    const dl = await fetch(`${BASE}/files/${DIR}/hello.txt`);
    assert.strictEqual(await dl.text(), 'hello world');
    assert.match(dl.headers.get('content-disposition'), /^attachment/);

    const view = await fetch(`${BASE}/files/${DIR}/hello.txt?view=true`);
    assert.match(view.headers.get('content-disposition'), /^inline/);
});

test('blocks path traversal', async () => {
    const res = await fetch(`${BASE}/files/..%2Fserver.js`);
    assert.notStrictEqual(res.status, 200);
});

test('deletes the folder but never the root', async () => {
    assert.strictEqual((await fetch(`${BASE}/files/`, { method: 'DELETE' })).status, 403);
    assert.strictEqual((await fetch(`${BASE}/files/${DIR}`, { method: 'DELETE' })).status, 200);
    assert.strictEqual((await fetch(`${BASE}/files/${DIR}/hello.txt`)).status, 404);
});

test('frontend escapes file names (XSS)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'script.js'), 'utf8');
    const escapeHtml = new Function(`${src.match(/function escapeHtml[\s\S]*?\n}/)[0]}; return escapeHtml;`)();
    assert.strictEqual(escapeHtml(`<img onerror="a('b')">&`), '&#60;img onerror=&#34;a(&#39;b&#39;)&#34;&#62;&#38;');
    assert.doesNotMatch(src, /["'>]\$\{item\.name\}/, 'raw file name inserted in HTML');
    assert.doesNotMatch(src, /\son\w+="[^"]*\$\{/, 'data interpolated into an inline handler');
});

// Must stay last: it exhausts the per-IP quota for the rest of the run.
test('rate limits floods', async () => {
    let status;
    for (let i = 0; i < 400 && status !== 429; i++) status = (await fetch(BASE + '/')).status;
    assert.strictEqual(status, 429);
});
