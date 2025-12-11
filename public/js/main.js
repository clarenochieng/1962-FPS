window.onerror = function(msg, url, line) {
    alert("Error: " + msg + "\nLine: " + line);
};

import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
    try {
        const game = new Game();
        game.init();
    } catch(e) {
        alert("Init Error: " + e.message);
        console.error(e);
    }
});
