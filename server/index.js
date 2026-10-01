'use strict';

const express = require('express');
const morgan = require('morgan');
const path = require('path');
const app = express();

const publicDir = path.resolve(__dirname, '..', 'public');
const indexFile = path.join(publicDir, 'index.html');

app.use(morgan('dev'));
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
