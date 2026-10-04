'use strict';

const express = require('express');
const http = require('http');
const morgan = require('morgan');
const path = require('path');
const app = express();

const publicDir = path.resolve(__dirname, '..', 'public');
const indexFile = path.join(publicDir, 'index.html');
const backendUrl = new URL(process.env.BACKEND_URL || 'http://localhost:8080');

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

app.use(express.static(publicDir));

app.use((req, res) => {
    if (req.method !== 'GET' || path.extname(req.path)) {
        res.status(404).end();
        return;
    }

    res.sendFile(indexFile);
});

const port = process.env.PORT || 8001;

app.listen(port, function () {
    console.log(`Listening on http://localhost:${port}`);
});
