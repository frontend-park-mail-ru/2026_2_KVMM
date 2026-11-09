'use strict';

const express = require('express');
const fs = require('fs');
const http = require('http');
const morgan = require('morgan');
const path = require('path');
const app = express();

const distDir = path.resolve(__dirname, '..', 'dist');
const assetsDir = path.join(distDir, 'assets') + path.sep;
const indexFile = path.join(distDir, 'index.html');
const backendUrl = new URL(process.env.BACKEND_URL || 'http://localhost:8080');
const backPublicDir = path.resolve(process.env.BACK_PUBLIC_DIR || path.join(__dirname, '..', '..', 'back', 'pkg', 'public'));

if (!fs.existsSync(indexFile)) {
    console.error('Нет сборки в dist/: сначала выполните npm run build');
    process.exit(1);
}

app.use(morgan('dev'));

app.use('/api', (req, res) => {
    const proxyRequest = http.request(
        {
            hostname: backendUrl.hostname,
            port: backendUrl.port,
            path: req.originalUrl,
            method: req.method,
            headers: { ...req.headers, host: backendUrl.host },
        },
        (proxyResponse) => {
            res.writeHead(proxyResponse.statusCode, proxyResponse.headers);
            proxyResponse.pipe(res);
        },
    );

    proxyRequest.on('error', () => {
        if (!res.headersSent) {
            res.status(502).end();
        }
    });

    req.pipe(proxyRequest);
});

if (fs.existsSync(backPublicDir)) {
    app.use('/public', express.static(backPublicDir));
}

app.use(
    express.static(distDir, {
        setHeaders(res, filePath) {
            const isHashed = filePath.startsWith(assetsDir);
            res.setHeader('Cache-Control', isHashed ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
    }),
);

app.use((req, res) => {
    if (req.method !== 'GET' || path.extname(req.path)) {
        res.status(404).end();
        return;
    }

    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
});

const port = process.env.PORT || 8001;

const server = app.listen(port, function () {
    console.log(`Listening on http://localhost:${port}`);
});

server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/api/')) {
        socket.destroy();
        return;
    }

    const proxyRequest = http.request({
        hostname: backendUrl.hostname,
        port: backendUrl.port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: backendUrl.host },
    });

    proxyRequest.on('upgrade', (proxyResponse, proxySocket, proxyHead) => {
        const lines = [`HTTP/1.1 ${proxyResponse.statusCode} ${proxyResponse.statusMessage}`];
        for (let i = 0; i < proxyResponse.rawHeaders.length; i += 2) {
            lines.push(`${proxyResponse.rawHeaders[i]}: ${proxyResponse.rawHeaders[i + 1]}`);
        }
        socket.write(lines.join('\r\n') + '\r\n\r\n');
        if (proxyHead.length) {
            socket.write(proxyHead);
        }
        if (head.length) {
            proxySocket.write(head);
        }
        proxySocket.pipe(socket).pipe(proxySocket);
        proxySocket.on('error', () => socket.destroy());
        socket.on('error', () => proxySocket.destroy());
    });

    proxyRequest.on('response', (proxyResponse) => {
        socket.end(`HTTP/1.1 ${proxyResponse.statusCode} ${proxyResponse.statusMessage}\r\nConnection: close\r\n\r\n`);
        proxyResponse.resume();
    });

    proxyRequest.on('error', () => socket.destroy());
    proxyRequest.end();
});
