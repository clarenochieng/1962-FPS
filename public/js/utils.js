export const SCORE_MULTIPLIERS = {
    ZOMBIE_KILL: 10,
    TITAN_KILL: 50,
    WAVE_BONUS: 100
};

export const GAME_CONSTANTS = {
    LEADERBOARD_BROADCAST_INTERVAL: 100,
    LEADERBOARD_BROADCAST_INTERVAL_IDLE: 200,
    LOW_HEALTH_THRESHOLD: 30,
    DAMAGE_FLASH_DURATION: 100
};

export function calculateScore(zombieKills, titanKills, wave) {
    return (zombieKills * SCORE_MULTIPLIERS.ZOMBIE_KILL) +
           (titanKills * SCORE_MULTIPLIERS.TITAN_KILL) +
           (wave * SCORE_MULTIPLIERS.WAVE_BONUS);
}

export function getOrCreateUsername() {
    const TAB_ID_KEY = 'tabId';
    const USERNAME_KEY = 'baseUsername';
    let tabId = null;
    let baseUsername = null;
    
    try {
        tabId = sessionStorage.getItem(TAB_ID_KEY);
        if (!tabId) {
            tabId = Math.random().toString(36).substring(2, 9);
            sessionStorage.setItem(TAB_ID_KEY, tabId);
        }
        
        baseUsername = sessionStorage.getItem(USERNAME_KEY);
        if (!baseUsername) {
            const legacyUsername = localStorage.getItem('username');
            if (legacyUsername && !legacyUsername.includes('-')) {
                baseUsername = legacyUsername;
            } else if (legacyUsername) {
                const parts = legacyUsername.split('-');
                baseUsername = parts.length > 1 ? parts.slice(0, -1).join('-') : legacyUsername;
            } else {
                if (window.crypto && window.crypto.randomUUID) {
                    baseUsername = 'Player-' + window.crypto.randomUUID().substring(0, 8);
                } else {
                    baseUsername = 'Player-' + Date.now().toString(36).substring(2, 10);
                }
            }
            sessionStorage.setItem(USERNAME_KEY, baseUsername);
            localStorage.setItem('username', baseUsername);
        }
    } catch {
        if (!tabId) {
            tabId = Math.random().toString(36).substring(2, 9);
        }
        if (!baseUsername) {
            baseUsername = 'Player-' + Date.now().toString(36).substring(2, 10);
        }
    }
    
    return `${baseUsername}-${tabId}`;
}

export function calculatePlaytime(startTime, pausedTime, pauseStartTime) {
    if (!startTime) return 0;
    const currentTime = Date.now();
    let totalElapsed = currentTime - startTime;
    let adjustedPausedTime = pausedTime;
    
    if (pauseStartTime) {
        adjustedPausedTime += currentTime - pauseStartTime;
    }
    
    return Math.floor((totalElapsed - adjustedPausedTime) / 1000);
}