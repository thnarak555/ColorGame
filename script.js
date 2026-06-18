import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    set, 
    onValue, 
    update, 
    get, 
    onDisconnect 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// 1. Firebase Configuration (PLACEHOLDER)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBfomDjhPSHnhC8v0TV8yH6EtzH9fBVJSc",
    authDomain: "aether-raid-63054.firebaseapp.com",
    databaseURL: "https://aether-raid-63054-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "aether-raid-63054",
    storageBucket: "aether-raid-63054.firebasestorage.app",
    messagingSenderId: "97677625343",
    appId: "1:97677625343:web:b9003ad22e46bc6e5449ca",
    measurementId: "G-SD9YB4H3XH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==========================================
// 2. DOM Elements
// ==========================================
const gridBoard = document.getElementById('grid-board');
const lobbyModal = document.getElementById('lobby-modal');
const gameOverModal = document.getElementById('game-over-modal');
const joinBtn = document.getElementById('join-btn');
const playerCountSpan = document.getElementById('player-count');
const playerAssignedP = document.getElementById('player-assigned');
const myPlayerNumSpan = document.getElementById('my-player-num');
const timeLeftSpan = document.getElementById('time-left');

const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const scoreP3 = document.getElementById('score-p3');

const finalP1 = document.getElementById('final-p1');
const finalP2 = document.getElementById('final-p2');
const finalP3 = document.getElementById('final-p3');
const winnerText = document.getElementById('winner-text');

// ==========================================
// 3. Game State Variables
// ==========================================
let myPlayerId = null; // 'p1', 'p2', or 'p3'
let isPlaying = false;
let cells = [];
let localTimerInterval = null;

// References
const gameRef = ref(db, 'game');
const playersRef = ref(db, 'game/players');
const stateRef = ref(db, 'game/state');
const boardRef = ref(db, 'game/board');
const endTimeRef = ref(db, 'game/endTime');

// ==========================================
// 4. Initialize Board UI
// ==========================================
function initBoardUI() {
    gridBoard.innerHTML = '';
    cells = [];
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        
        // Add click listener
        cell.addEventListener('click', () => handleCellClick(i));
        
        gridBoard.appendChild(cell);
        cells.push(cell);
    }
}
initBoardUI();

// ==========================================
// 5. Player Join Logic
// ==========================================
joinBtn.addEventListener('click', async () => {
    joinBtn.disabled = true;
    joinBtn.innerText = "JOINING...";

    try {
        const snapshot = await get(playersRef);
        const players = snapshot.val() || {};

        if (!players.p1) myPlayerId = 'p1';
        else if (!players.p2) myPlayerId = 'p2';
        else if (!players.p3) myPlayerId = 'p3';
        
        if (myPlayerId) {
            // Register player
            await set(ref(db, `game/players/${myPlayerId}`), true);
            
            // Remove player if they disconnect before game starts
            onDisconnect(ref(db, `game/players/${myPlayerId}`)).remove();

            // Update UI
            joinBtn.classList.add('hidden');
            playerAssignedP.classList.remove('hidden');
            
            let colorName = myPlayerId === 'p1' ? 'RED' : myPlayerId === 'p2' ? 'BLUE' : 'YELLOW';
            let colorClass = myPlayerId === 'p1' ? '#ff003c' : myPlayerId === 'p2' ? '#00e5ff' : '#ffea00';
            
            myPlayerNumSpan.innerText = `${myPlayerId.toUpperCase()} (${colorName})`;
            myPlayerNumSpan.style.color = colorClass;

            // Check if we need to start the game
            const newSnapshot = await get(playersRef);
            const newPlayers = newSnapshot.val() || {};
            if (newPlayers.p1 && newPlayers.p2 && newPlayers.p3) {
                startGame();
            }
        } else {
            alert("Lobby is full! Game might already be in progress.");
            joinBtn.disabled = false;
            joinBtn.innerText = "JOIN GAME";
        }
    } catch (error) {
        console.error("Error joining game:", error);
        joinBtn.disabled = false;
        joinBtn.innerText = "JOIN GAME";
    }
});

// Listen to player count
onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};
    const count = Object.keys(players).length;
    playerCountSpan.innerText = count;

    // If 3 players are ready and game is still waiting, start it
    // Any client can trigger this if they see 3 players.
    get(stateRef).then(stateSnap => {
        if (count === 3 && stateSnap.val() !== 'playing' && stateSnap.val() !== 'finished') {
            startGame();
        }
    });
});

// ==========================================
// 6. Game Start & Timer Logic
// ==========================================
async function startGame() {
    // Only one player needs to initialize the board and timer,
    // but doing it safely using transaction or just overwrite is fine for simple game.
    const snapshot = await get(stateRef);
    if (snapshot.val() !== 'playing') {
        // Reset Board
        const emptyBoard = new Array(100).fill(0);
        
        const updates = {};
        updates['game/state'] = 'playing';
        updates['game/board'] = emptyBoard;
        updates['game/endTime'] = Date.now() + 30000; // 30 seconds from now
        
        await update(ref(db), updates);
    }
}

// Listen to State Changes
onValue(stateRef, (snapshot) => {
    const state = snapshot.val();
    
    if (state === 'playing') {
        lobbyModal.classList.remove('active');
        gridBoard.classList.remove('disabled');
        isPlaying = true;
        
        // Start local countdown based on DB endTime
        get(endTimeRef).then(timeSnap => {
            const endTime = timeSnap.val();
            startLocalTimer(endTime);
        });
    } else if (state === 'finished') {
        endGame();
    } else {
        // "waiting" or null
        lobbyModal.classList.add('active');
        gameOverModal.classList.remove('active');
        gridBoard.classList.add('disabled');
        isPlaying = false;
    }
});

function startLocalTimer(endTime) {
    if (localTimerInterval) clearInterval(localTimerInterval);
    
    localTimerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        timeLeftSpan.innerText = remaining;

        if (remaining <= 0) {
            clearInterval(localTimerInterval);
            // If I am P1, I can be the one to update state to finished
            if (myPlayerId === 'p1') {
                set(stateRef, 'finished');
            }
        }
    }, 200); // Check frequently for smooth 0 stop
}

// ==========================================
// 7. Board Interaction & Real-time Sync
// ==========================================
function handleCellClick(index) {
    if (!isPlaying || !myPlayerId) return;

    // Optimistic UI update (optional, but makes it feel faster)
    cells[index].className = `cell ${myPlayerId}`;

    // Update Firebase
    set(ref(db, `game/board/${index}`), myPlayerId);
}

onValue(boardRef, (snapshot) => {
    const boardData = snapshot.val();
    if (!boardData) return;

    let scores = { p1: 0, p2: 0, p3: 0 };

    boardData.forEach((val, index) => {
        // Remove existing player classes
        cells[index].classList.remove('p1', 'p2', 'p3');
        
        if (val === 'p1' || val === 'p2' || val === 'p3') {
            cells[index].classList.add(val);
            scores[val]++;
        }
    });

    // Update Score UI
    scoreP1.innerText = scores.p1;
    scoreP2.innerText = scores.p2;
    scoreP3.innerText = scores.p3;
});

// ==========================================
// 8. Game Over Logic
// ==========================================
function endGame() {
    isPlaying = false;
    gridBoard.classList.add('disabled');
    if (localTimerInterval) clearInterval(localTimerInterval);
    timeLeftSpan.innerText = "0";

    // Read final scores
    const s1 = parseInt(scoreP1.innerText);
    const s2 = parseInt(scoreP2.innerText);
    const s3 = parseInt(scoreP3.innerText);

    finalP1.innerText = s1;
    finalP2.innerText = s2;
    finalP3.innerText = s3;

    // Determine winner
    let maxScore = Math.max(s1, s2, s3);
    let winners = [];
    if (s1 === maxScore) winners.push("Red");
    if (s2 === maxScore) winners.push("Blue");
    if (s3 === maxScore) winners.push("Yellow");

    if (winners.length > 1) {
        winnerText.innerText = `IT'S A TIE! (${winners.join(', ')})`;
        winnerText.style.color = '#fff';
        winnerText.style.textShadow = '0 0 15px #fff';
    } else {
        winnerText.innerText = `${winners[0]} Wins!`;
        if (winners[0] === 'Red') {
            winnerText.style.color = '#ff003c';
            winnerText.style.textShadow = '0 0 20px #ff003c';
        } else if (winners[0] === 'Blue') {
            winnerText.style.color = '#00e5ff';
            winnerText.style.textShadow = '0 0 20px #00e5ff';
        } else {
            winnerText.style.color = '#ffea00';
            winnerText.style.textShadow = '0 0 20px #ffea00';
        }
    }

    gameOverModal.classList.add('active');
    
    // Clean up players node so next game can start fresh
    // Only p1 cleans up to avoid race condition
    if (myPlayerId === 'p1') {
        setTimeout(() => {
            set(playersRef, null);
            set(stateRef, 'waiting');
        }, 5000); // wait 5 seconds before reset
    }
}
