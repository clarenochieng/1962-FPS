const mongoose = require('mongoose');

const PlayerStatsSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    totalPlaytime: {
        type: Number,
        default: 0,
        min: 0
    },
    totalGamesPlayed: {
        type: Number,
        default: 0,
        min: 0
    },
    highScore: {
        type: Number,
        default: 0,
        min: 0
    },
    bestWave: {
        type: Number,
        default: 0,
        min: 0
    },
    totalKills: {
        zombies: {
            type: Number,
            default: 0,
            min: 0
        },
        titans: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    totalDeaths: {
        type: Number,
        default: 0,
        min: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

PlayerStatsSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('PlayerStats', PlayerStatsSchema);