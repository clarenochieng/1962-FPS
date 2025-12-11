import { calculateScore, GAME_CONSTANTS } from './utils.js';

export class UI {
    constructor() {
        this.healthElement = document.getElementById('health');
        this.ammoElement = document.getElementById('ammo');
        this.waveElement = document.getElementById('wave');
        this.zombiesElement = document.getElementById('zombies');
        this.titansElement = document.getElementById('titans');
        this.scoreElement = document.getElementById('score');
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over');
        this.pauseScreen = document.getElementById('pause-screen');
        this.leaderboardPanel = document.getElementById('leaderboard-panel');
        this.leaderboardList = document.getElementById('leaderboard-list');
        this.leaderboardOverlayList = document.getElementById('leaderboard-overlay-list');
        this.leaderboardOverlay = document.getElementById('leaderboard-overlay');
        this.usernameAliases = {};
        this.latestLeaderboardEntries = [];
    }

    hideStartScreen() {
        this.startScreen.classList.add('hidden');
    }

    showStartScreen() {
        this.startScreen.classList.remove('hidden');
        if (this.leaderboardPanel) {
            this.leaderboardPanel.classList.remove('hidden');
        }
    }

    showGameOver() {
        this.gameOverScreen.classList.remove('hidden');
    }
    
    hideGameOver() {
        this.gameOverScreen.classList.add('hidden');
    }

    showPauseScreen() {
        if (this.pauseScreen) {
            this.pauseScreen.classList.remove('hidden');
            this.pauseScreen.scrollTop = 0;
            const pauseStats = document.getElementById('pause-stats');
            if (pauseStats) pauseStats.scrollTop = 0;
        }
    }

    hidePauseScreen() {
        if (this.pauseScreen) this.pauseScreen.classList.add('hidden');
    }
    
    reset() {
        this.updateHealth(100);
        this.updateAmmo(100);
        this.updateWave(1);
        this.updateEnemyCounts({ zombies: 0, titans: 0 });
        this.updateScore(0);
    }

    updateHealth(health) {
        this.healthElement.textContent = `Health: ${health}`;
        this.healthElement.style.color = health < GAME_CONSTANTS.LOW_HEALTH_THRESHOLD ? 'red' : '#0f0';
    }

    updateAmmo(ammo) {
        this.ammoElement.textContent = `Ammo: ${ammo}`;
    }

    updateWave(wave) {
        this.waveElement.textContent = `Wave: ${wave}`;
    }

    updateEnemyCounts(counts) {
        if (this.zombiesElement) this.zombiesElement.textContent = `Zombies Left: ${counts.zombies}`;
        if (this.titansElement) this.titansElement.textContent = `Titans Left: ${counts.titans}`;
    }

    updateScore(score) {
        if (this.scoreElement) this.scoreElement.textContent = `Score: ${score}`;
    }

    getAlias(username, socketId = null) {
        const key = socketId ? `${username}-${socketId}` : username || 'Player';
        if (this.usernameAliases[key]) return this.usernameAliases[key];

        const adjectives = [
            'Brave', 'Swift', 'Silent', 'Fierce', 'Clever',
            'Mighty', 'Shadow', 'Crimson', 'Iron', 'Wild'
        ];
        const nouns = [
            'Falcon', 'Tiger', 'Wolf', 'Raven', 'Viper',
            'Panther', 'Blade', 'Ghost', 'Phoenix', 'Ranger'
        ];

        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const alias = `${adj} ${noun}`;
        this.usernameAliases[key] = alias;
        return alias;
    }

    updateLeaderboard(entries) {
        this.latestLeaderboardEntries = entries || [];
        const all = this.latestLeaderboardEntries;
        const top5 = all.slice(0, 5);

        const renderList = (list) => {
            if (!list || list.length === 0) {
                return '<div style="color:#888;">No active players.</div>';
            }
            return list.map((entry, index) => {
                const rank = index + 1;
                const username = entry.username || 'Player';
                const parts = username.split('-');
                let displayUsername = username;
                if (parts.length > 1) {
                    const lastPart = parts[parts.length - 1];
                    if (lastPart.length <= 8 && /^[a-z0-9]+$/i.test(lastPart)) {
                        displayUsername = parts.slice(0, -1).join('-');
                    }
                }
                const alias = this.getAlias(displayUsername, entry.socketId);
                const score = entry.highScore ?? entry.score ?? 0;
                const wave = entry.bestWave ?? entry.wave ?? 0;
                const waveText = wave > 0 ? `Wave ${wave} • ` : '';
                return `
                    <div>
                        <strong>#${rank} ${alias}</strong>
                        <span>${waveText}Score ${score}</span>
                    </div>
                `;
            }).join('');
        };

        if (this.leaderboardList) {
            this.leaderboardList.innerHTML = renderList(all);
        }
        if (this.leaderboardOverlayList) {
            this.leaderboardOverlayList.innerHTML = renderList(top5);
        }
    }

    showLeaderboardOverlay() {
        if (this.leaderboardOverlay) {
            this.leaderboardOverlay.classList.remove('hidden');
        }
    }

    hideLeaderboardOverlay() {
        if (this.leaderboardOverlay) {
            this.leaderboardOverlay.classList.add('hidden');
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    displaySessionStats(sessionStats) {
        const sessionStatsElement = document.getElementById('session-stats');
        if (!sessionStatsElement) return;

        const playtime = sessionStats.playtime || 0;

        sessionStatsElement.innerHTML = `
            <div><strong>Wave:</strong> ${sessionStats.wave || 1}</div>
            <div><strong>Playtime:</strong> ${this.formatTime(playtime)}</div>
            <div><strong>Zombie Kills:</strong> ${sessionStats.kills?.zombies || 0}</div>
            <div><strong>Titan Kills:</strong> ${sessionStats.kills?.titans || 0}</div>
            <div><strong>Total Kills:</strong> ${(sessionStats.kills?.zombies || 0) + (sessionStats.kills?.titans || 0)}</div>
            <div><strong>Score:</strong> ${this.calculateScore(sessionStats)}</div>
        `;
    }

    calculateScore(sessionStats) {
        const zombieKills = sessionStats.kills?.zombies || 0;
        const titanKills = sessionStats.kills?.titans || 0;
        const wave = sessionStats.wave || 1;
        return calculateScore(zombieKills, titanKills, wave);
    }

    _renderStatsHTML(playerStats) {
        if (!playerStats) {
            return '<div style="grid-column: 1 / -1; text-align: center; color: #888;">No stats yet. Play a game to see your stats!</div>';
        }
        return `
            <div><strong>High Score:</strong> ${playerStats.highScore || 0}</div>
            <div><strong>Highest Wave Count:</strong> ${playerStats.bestWave || 0}</div>
            <div><strong>Total Playtime:</strong> ${this.formatTime(playerStats.totalPlaytime || 0)}</div>
            <div><strong>Games Played:</strong> ${playerStats.totalGamesPlayed || 0}</div>
            <div><strong>Total Zombie Kills:</strong> ${playerStats.totalKills?.zombies || 0}</div>
            <div><strong>Total Titan Kills:</strong> ${playerStats.totalKills?.titans || 0}</div>
            <div><strong>Total Kills:</strong> ${(playerStats.totalKills?.zombies || 0) + (playerStats.totalKills?.titans || 0)}</div>
            <div><strong>Total Deaths:</strong> ${playerStats.totalDeaths || 0}</div>
        `;
    }

    displayOverallStats(playerStats) {
        const overallStatsElement = document.getElementById('overall-stats');
        if (!overallStatsElement) return;
        overallStatsElement.innerHTML = this._renderStatsHTML(playerStats);
    }

    displayOverallStatsOnStart(playerStats) {
        const overallStatsElement = document.getElementById('overall-stats-start');
        if (!overallStatsElement) return;
        overallStatsElement.innerHTML = this._renderStatsHTML(playerStats);
    }
}