import * as THREE from 'three';
import { Player } from './player.js';
import { World } from './world.js';
import { Physics } from './physics.js';
import { EnemyManager } from './enemy.js';
import { UI } from './ui.js';
import { ItemManager } from './items.js';
import { calculateScore, getOrCreateUsername, calculatePlaytime, GAME_CONSTANTS } from './utils.js';

export class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.world = null;
        this.physics = null;
        this.enemyManager = null;
        this.itemManager = null;
        this.ui = null;
        this.clock = new THREE.Clock();
        this.isPlaying = false;
        this.isPaused = false;
        this.difficulty = 'medium';
        this.cachedPlayerStats = null;
        this.currentScore = 0;
        this.highestScore = 0;
        this.highestWave = 0;
        this.isViewingStats = false;
        this.isLeaderboardOverlayVisible = false;
        this.lastActiveBroadcastTime = 0;
        this.sessionStats = {
            startTime: null,
            playtime: 0,
            pausedTime: 0,
            pauseStartTime: null,
            kills: {
                zombies: 0,
                titans: 0
            },
            initialEnemyCounts: {
                zombies: 0,
                titans: 0
            }
        };
    }

    init() {
        this.setupScene();
        this.setupLighting();
        this.setupComponents();
        this.setupEventListeners();
        this.setupRealtime();
        this.loadPlayerStats();
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 40, 120);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').appendChild(this.renderer.domElement);
    }

    setupLighting() {
        this.scene.add(new THREE.AmbientLight(0x7a7a7a, 1.0));
        const directionalLight = new THREE.DirectionalLight(0xaaaaaa, 1.2);
        directionalLight.position.set(30, 50, 30);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }

    setupComponents() {
        this.physics = new Physics();
        this.world = new World(this.scene, this.physics);
        this.ui = new UI();
        this.itemManager = new ItemManager(this.scene);
        this.player = new Player(this.scene, this.camera, this.physics, this.ui);
        this.player.game = this;
        this.enemyManager = new EnemyManager(this.scene, this.physics, this.player, this.ui, this.itemManager, this.difficulty);
        this.player.onShoot = (raycaster) => {
            const hitResult = this.enemyManager.checkHit(raycaster);
            if (hitResult && hitResult.killed) {
                if (hitResult.type === 'zombie') {
                    this.sessionStats.kills.zombies++;
                } else if (hitResult.type === 'titan') {
                    this.sessionStats.kills.titans++;
                }
            }
        };
        this.world.generate();
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        document.getElementById('start-screen').addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!this.isPlaying && !this.isViewingStats && event.target.tagName !== 'BUTTON') this.start();
        });
        document.querySelectorAll('.difficulty-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.difficulty = button.dataset.difficulty;
                document.querySelectorAll('.difficulty-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });
        document.getElementById('restart-btn').addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.restart();
        });
        const quitBtn = document.getElementById('quit-btn');
        if (quitBtn) {
            quitBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.quitToMainMenu();
            });
        }
        const viewStatsBtn = document.getElementById('view-stats-btn');
        if (viewStatsBtn) {
            viewStatsBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.showStatsFromStart();
            });
        }
        const closeStatsBtn = document.getElementById('close-stats-btn');
        if (closeStatsBtn) {
            closeStatsBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.hideStatsScreen();
            });
        }
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && !this.isPlaying && !this.isPaused) {
                event.preventDefault();
                this.player.health > 0 ? this.start() : this.restart();
            }
            if (event.code === 'KeyP') {
                event.preventDefault();
                event.stopPropagation();
                if (this.isPlaying) {
                    this.pause();
                } else if (this.isPaused) {
                    this.player.pendingShot = true;
                    this.resume();
                }
            }
            if (event.code === 'KeyL' && this.isPlaying) {
                event.preventDefault();
                event.stopPropagation();
                this.toggleLeaderboardOverlay();
            }
        });
        document.getElementById('pause-screen').addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (this.isPaused) {
                this.player.pendingShot = true;
                this.resume();
            }
        });
    }

    setupRealtime() {
        if (typeof io === 'undefined') return;
        this.socket = io();
        this.socket.on('leaderboard:update', (entries) => {
            this.ui.updateLeaderboard(entries);
        });
        
        this.socket.on('connect', () => {
            const username = getOrCreateUsername();
            this.socket.emit('player:playing', {
                username,
                score: 0,
                wave: 0
            });
        });
    }

    toggleLeaderboardOverlay() {
        this.isLeaderboardOverlayVisible = !this.isLeaderboardOverlayVisible;
        if (this.isLeaderboardOverlayVisible) {
            this.ui.showLeaderboardOverlay();
        } else {
            this.ui.hideLeaderboardOverlay();
        }
    }

    start() {
        this.isPlaying = true;
        this.isPaused = false;
        this.ui.hideStartScreen();
        this.enemyManager.setDifficulty(this.difficulty);
        this.sessionStats.startTime = Date.now();
        this.sessionStats.playtime = 0;
        this.sessionStats.pausedTime = 0;
        this.sessionStats.pauseStartTime = null;
        this.sessionStats.kills = { zombies: 0, titans: 0 };
        const initialCounts = this.enemyManager.getEnemyCounts();
        this.sessionStats.initialEnemyCounts = {
            zombies: initialCounts.zombies,
            titans: initialCounts.titans
        };
        this.currentScore = 0;
        this.resetGame();
        this.player.lockControls();
        this.ui.updateScore(0);
        
        if (this.socket) {
            const username = getOrCreateUsername();
            this.socket.emit('player:playing', {
                username,
                score: 0,
                wave: this.enemyManager?.wave || 1
            });
            this.lastActiveBroadcastTime = performance.now();
        }
    }
    
    pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.isPaused = true;
        this.sessionStats.pauseStartTime = Date.now();
        
        const currentPlaytime = calculatePlaytime(
            this.sessionStats.startTime,
            this.sessionStats.pausedTime,
            null
        );
        
        this.ui.displaySessionStats({
            wave: this.enemyManager.wave,
            kills: this.sessionStats.kills,
            playtime: currentPlaytime
        });
        
        this.loadPlayerStats();
        
        if (this.socket) {
            const username = getOrCreateUsername();
            const currentWave = this.enemyManager?.wave || 1;
            this.socket.emit('player:playing', {
                username,
                score: this.currentScore || 0,
                wave: currentWave
            });
        }
        
        this.ui.showPauseScreen();
        this.player.unlockControls();
    }
    
    async loadPlayerStats() {
        try {
            const username = getOrCreateUsername();
            const encodedUsername = encodeURIComponent(username);
            const response = await fetch(`/api/stats/${encodedUsername}`, {
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
                const stats = await response.json();
                this.cachedPlayerStats = stats;
                this.ui.displayOverallStats(stats);
            } else if (response.status === 404) {
                this.cachedPlayerStats = null;
                this.ui.displayOverallStats(null);
            } else {
                await response.text();
                if (this.cachedPlayerStats) {
                    this.ui.displayOverallStats(this.cachedPlayerStats);
                } else {
                    this.ui.displayOverallStats(null);
                }
            }
        } catch {
            if (this.cachedPlayerStats) {
                this.ui.displayOverallStats(this.cachedPlayerStats);
            } else {
                this.ui.displayOverallStats(null);
            }
        }
    }

    resume() {
        if (!this.isPaused) return;
        if (this.sessionStats.pauseStartTime) {
            this.sessionStats.pausedTime += Date.now() - this.sessionStats.pauseStartTime;
            this.sessionStats.pauseStartTime = null;
        }
        this.isPlaying = true;
        this.isPaused = false;
        
        if (this.socket) {
            const username = getOrCreateUsername();
            const currentWave = this.enemyManager?.wave || 1;
            this.socket.emit('player:playing', {
                username,
                score: this.currentScore || 0,
                wave: currentWave
            });
            this.lastActiveBroadcastTime = performance.now();
        }
        
        this.ui.hidePauseScreen();
        this.player.lockControls();
        this.clock.getDelta();
    }
    
    restart() {
        this.enemyManager.setDifficulty(this.difficulty);
        this.resetGame();
        this.ui.reset();
        this.ui.hideGameOver();
        this.sessionStats.startTime = Date.now();
        this.sessionStats.playtime = 0;
        this.sessionStats.pausedTime = 0;
        this.sessionStats.pauseStartTime = null;
        this.sessionStats.kills = { zombies: 0, titans: 0 };
        const initialCounts = this.enemyManager.getEnemyCounts();
        this.sessionStats.initialEnemyCounts = {
            zombies: initialCounts.zombies,
            titans: initialCounts.titans
        };
        this.currentScore = 0;
        this.isPlaying = true;
        this.isPaused = false;
        this.player.lockControls();
        this.ui.updateScore(0);
    }

    resetGame() {
        this.player.reset();
        this.enemyManager.reset();
        this.itemManager.reset();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = Math.min(this.clock.getDelta(), 0.1);
        if (this.isPlaying) {
            this.physics.update(deltaTime);
            this.player.update(deltaTime);
            this.enemyManager.update(deltaTime);
            this.itemManager.update(deltaTime, this.player);
            this.ui.updateEnemyCounts(this.enemyManager.getEnemyCounts());
            
            const currentWave = this.enemyManager?.wave || 1;
            const zombieKills = this.sessionStats.kills?.zombies || 0;
            const titanKills = this.sessionStats.kills?.titans || 0;
            this.currentScore = calculateScore(zombieKills, titanKills, currentWave);
            
            if (this.currentScore > this.highestScore) {
                this.highestScore = this.currentScore;
            }
            if (currentWave > this.highestWave) {
                this.highestWave = currentWave;
            }
            
            this.ui.updateScore(this.currentScore);
            
            if (this.socket) {
                const now = performance.now();
                if (now - this.lastActiveBroadcastTime > GAME_CONSTANTS.LEADERBOARD_BROADCAST_INTERVAL) {
                    const username = getOrCreateUsername();
                    this.socket.emit('player:playing', {
                        username,
                        score: this.currentScore,
                        wave: currentWave
                    });
                    this.lastActiveBroadcastTime = now;
                }
            }
            
            if (this.player.health <= 0) this.gameOver();
        } else if (this.isPaused) {
            if (this.socket) {
                const now = performance.now();
                if (now - this.lastActiveBroadcastTime > GAME_CONSTANTS.LEADERBOARD_BROADCAST_INTERVAL) {
                    const username = getOrCreateUsername();
                    const currentWave = this.enemyManager?.wave || 1;
                    this.socket.emit('player:playing', {
                        username,
                        score: this.currentScore || 0,
                        wave: currentWave
                    });
                    this.lastActiveBroadcastTime = now;
                }
            }
        } else {
            if (this.socket) {
                const now = performance.now();
                if (now - this.lastActiveBroadcastTime > GAME_CONSTANTS.LEADERBOARD_BROADCAST_INTERVAL_IDLE) {
                    const username = getOrCreateUsername();
                    this.socket.emit('player:playing', {
                        username,
                        score: this.highestScore || 0,
                        wave: this.highestWave || 0
                    });
                    this.lastActiveBroadcastTime = now;
                }
            }
        }
        this.renderer.render(this.scene, this.camera);
    }
    
    gameOver() {
        this.isPlaying = false;
        this.isPaused = false;
        
        if (!this.sessionStats.kills) {
            this.sessionStats.kills = { zombies: 0, titans: 0 };
        }
        
        this.sessionStats.playtime = calculatePlaytime(
            this.sessionStats.startTime,
            this.sessionStats.pausedTime,
            this.sessionStats.pauseStartTime
        );
        
        const currentWave = this.enemyManager?.wave || 1;
        const zombieKills = this.sessionStats.kills.zombies || 0;
        const titanKills = this.sessionStats.kills.titans || 0;
        const score = calculateScore(zombieKills, titanKills, currentWave);
        
        this.saveGameStats(score, currentWave, zombieKills, titanKills, true);
        
        if (this.socket) {
            const username = getOrCreateUsername();
            this.socket.emit('player:stopped', { username });
        }
        
        this.player.unlockControls();
        this.ui.showGameOver();
    }
    
    async saveGameStats(score, wave, zombieKills, titanKills, didDie = true) {
        try {
            const username = getOrCreateUsername();
            
            const statsData = {
                username: username,
                score: score,
                wave: wave,
                kills: {
                    zombies: zombieKills,
                    titans: titanKills
                },
                playtime: this.sessionStats.playtime || 0,
                difficulty: this.difficulty || 'medium',
                didDie: didDie
            };

            const response = await fetch('/api/scores', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(statsData)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result?.stats) {
                    this.cachedPlayerStats = result.stats;
                    this.ui.displayOverallStats(result.stats);
                } else {
                    this.loadPlayerStats();
                }
            } else {
                await response.text();
            }
        } catch {
            // Ignore save errors
        }
    }

    quitToMainMenu() {
        if (this.isPlaying || this.isPaused) {
            if (!this.sessionStats.kills) {
                this.sessionStats.kills = { zombies: 0, titans: 0 };
            }

            this.sessionStats.playtime = calculatePlaytime(
                this.sessionStats.startTime,
                this.sessionStats.pausedTime,
                this.sessionStats.pauseStartTime
            );

            const currentWave = this.enemyManager?.wave || 1;
            const zombieKills = this.sessionStats.kills.zombies || 0;
            const titanKills = this.sessionStats.kills.titans || 0;
            const score = calculateScore(zombieKills, titanKills, currentWave);

            this.saveGameStats(score, currentWave, zombieKills, titanKills, false);

            if (this.socket) {
                const username = getOrCreateUsername();
                this.socket.emit('player:playing', {
                    username,
                    score: 0,
                    wave: 0
                });
            }

            this.resetGame();
            this.ui.reset();

            this.sessionStats.startTime = null;
            this.sessionStats.playtime = 0;
            this.sessionStats.pausedTime = 0;
            this.sessionStats.pauseStartTime = null;
            this.sessionStats.kills = { zombies: 0, titans: 0 };
            this.sessionStats.initialEnemyCounts = { zombies: 0, titans: 0 };
            this.currentScore = 0;
        }

        this.isPlaying = false;
        this.isPaused = false;
        this.player.unlockControls();
        this.ui.hidePauseScreen();
        this.isViewingStats = false;
        this.hideStatsScreen();
        this.ui.showStartScreen();
    }

    showStatsFromStart() {
        const statsScreen = document.getElementById('stats-screen');
        if (statsScreen) {
            statsScreen.classList.remove('hidden');
        }
        this.isViewingStats = true;
        this.ui.hideStartScreen();
        this.loadPlayerStatsForStart();
    }

    hideStatsScreen() {
        const statsScreen = document.getElementById('stats-screen');
        if (statsScreen) {
            statsScreen.classList.add('hidden');
        }
        this.isViewingStats = false;
        if (!this.isPlaying && !this.isPaused) {
            this.ui.showStartScreen();
        }
    }

    async loadPlayerStatsForStart() {
        try {
            const username = getOrCreateUsername();
            const encodedUsername = encodeURIComponent(username);
            const response = await fetch(`/api/stats/${encodedUsername}`, {
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                const stats = await response.json();
                this.cachedPlayerStats = stats;
                this.ui.displayOverallStatsOnStart(stats);
            } else if (response.status === 404) {
                this.cachedPlayerStats = null;
                this.ui.displayOverallStatsOnStart(null);
            } else {
                await response.text();
                if (this.cachedPlayerStats) {
                    this.ui.displayOverallStatsOnStart(this.cachedPlayerStats);
                } else {
                    this.ui.displayOverallStatsOnStart(null);
                }
            }
        } catch {
            if (this.cachedPlayerStats) {
                this.ui.displayOverallStatsOnStart(this.cachedPlayerStats);
            } else {
                this.ui.displayOverallStatsOnStart(null);
            }
        }
    }
}