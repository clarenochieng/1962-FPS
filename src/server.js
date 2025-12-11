const express = require('express');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
require('dotenv').config();

const apiRoutes = require('./routes/api');

const app = express();
const port = process.env.PORT || 1962;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(express.json());

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fpsgame';

mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use(express.static(path.join(__dirname, '../public')));
app.use('/build/', express.static(path.join(__dirname, '../node_modules/three/build')));
app.use('/jsm/', express.static(path.join(__dirname, '../node_modules/three/examples/jsm')));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const activePlayers = new Map();

function sortLeaderboard(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return (b.wave || 0) - (a.wave || 0);
}

function getSortedLeaderboard() {
    return Array.from(activePlayers.values()).sort(sortLeaderboard);
}

function broadcastActiveLeaderboard() {
    io.emit('leaderboard:update', getSortedLeaderboard());
}

io.on('connection', (socket) => {
    socket.emit('leaderboard:update', getSortedLeaderboard());

    socket.on('player:playing', (msg) => {
        if (!msg) return;
        const username = String(msg.username || 'Player').slice(0, 32);
        const score = Number.isFinite(Number(msg.score)) ? Number(msg.score) : 0;
        const wave = Number.isFinite(Number(msg.wave)) ? Number(msg.wave) : 0;

        socket.username = username;
        activePlayers.set(socket.id, {
            username,
            score,
            wave,
            lastUpdate: Date.now(),
            socketId: socket.id
        });
        broadcastActiveLeaderboard();
    });

    socket.on('player:stopped', () => {
        if (activePlayers.has(socket.id)) {
            activePlayers.delete(socket.id);
            broadcastActiveLeaderboard();
        }
    });

    socket.on('disconnect', () => {
        if (activePlayers.has(socket.id)) {
            activePlayers.delete(socket.id);
            broadcastActiveLeaderboard();
        }
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
