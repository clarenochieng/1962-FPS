const mongoose = require('mongoose');

const ScoreSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    score: {
        type: Number,
        required: true
    },
    wave: {
        type: Number,
        default: 1,
        min: 1
    },
    kills: {
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
    playtime: {
        type: Number,
        default: 0,
        min: 0
    },
    didDie: {
        type: Boolean,
        default: true
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Score', ScoreSchema);