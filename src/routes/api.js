const express = require('express');
const router = express.Router();
const Score = require('../models/Score');
const PlayerStats = require('../models/PlayerStats');

router.get('/scores', async (req, res) => {
    try {
        const scores = await Score.find()
            .sort({ score: -1 })
            .limit(10);
        res.json(scores);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/scores', async (req, res) => {
    try {
        const username = (req.body.username || '').trim();
        if (!username) {
            return res.status(400).json({ message: 'Username is required.' });
        }

        const toNumber = (value, fallback = 0) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const validateDifficulty = (difficulty) => {
            const valid = ['easy', 'medium', 'hard'];
            return valid.includes(difficulty.toLowerCase()) ? difficulty.toLowerCase() : 'medium';
        };

        const scoreData = {
            username,
            score: toNumber(req.body.score),
            wave: Math.max(1, toNumber(req.body.wave, 1)),
            kills: {
                zombies: Math.max(0, toNumber(req.body.kills?.zombies, 0)),
                titans: Math.max(0, toNumber(req.body.kills?.titans, 0))
            },
            playtime: Math.max(0, toNumber(req.body.playtime, 0)),
            difficulty: validateDifficulty(req.body.difficulty || 'medium'),
            didDie: req.body.didDie !== false
        };

        const newScore = new Score(scoreData);
        const savedScore = await newScore.save();

        const playerStats = await PlayerStats.findOneAndUpdate(
            { username },
            {
                $inc: {
                    totalPlaytime: scoreData.playtime,
                    totalGamesPlayed: 1,
                    'totalKills.zombies': scoreData.kills.zombies,
                    'totalKills.titans': scoreData.kills.titans,
                    totalDeaths: scoreData.didDie ? 1 : 0
                },
                $max: {
                    highScore: scoreData.score,
                    bestWave: scoreData.wave
                },
                $setOnInsert: {
                    username
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                runValidators: true
            }
        );

        res.status(201).json({
            score: savedScore,
            stats: playerStats
        });
    } catch (err) {
        console.error('Error saving score/stats:', err);
        res.status(400).json({ message: err.message });
    }
});

router.get('/stats/:username', async (req, res) => {
    try {
        const username = decodeURIComponent(req.params.username || '').trim();
        if (!username) {
            return res.status(400).json({ message: 'Username is required.' });
        }

        const stats = await PlayerStats.findOne({ username }).lean();
        if (!stats) {
            return res.status(404).json({ message: 'Player stats not found' });
        }

        res.json(stats);
    } catch (err) {
        console.error('Error fetching player stats:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const stats = await PlayerStats.find()
            .sort({ highScore: -1 })
            .limit(100)
            .lean();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;