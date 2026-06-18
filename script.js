import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    set, 
    onValue, 
    update, 
    get, 
    onDisconnect,
    push,
    onChildAdded
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// 1. Firebase Configuration
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
// 2. DOM Elements & Canvas Setup
// ==========================================
const lobbyModal = document.getElementById('lobby-modal');
const gameOverModal = document.getElementById('game-over-modal');
const joinBtn = document.getElementById('join-btn');
const playerCountSpan = document.getElementById('player-count');
const playerAssignedP = document.getElementById('player-assigned');
const myPlayerNumSpan = document.getElementById('my-player-num');
const winnerText = document.getElementById('winner-text');
const restartBtn = document.getElementById('restart-btn');

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const hpBars = {
    p1: document.getElementById('hp-p1'),
    p2: document.getElementById('hp-p2'),
    p3: document.getElementById('hp-p3')
};

// ==========================================
// 3. Game Variables & Constants
// ==========================================
let myPlayerId = null; 
let isPlaying = false;
let animationFrameId;

const COLORS = {
    p1: '#ff003c',
    p2: '#00e5ff',
    p3: '#ffea00'
};

const MAX_HP = 100;
const PLAYER_SPEED = 200; // pixels per second
const BULLET_SPEED = 500;
const PLAYER_RADIUS = 15;
const BULLET_RADIUS = 4;
const FIRE_COOLDOWN = 300; // ms

// Local game state
let localBullets = []; // {x, y, vx, vy, owner, color}
let players = {
    p1: { x: 400, y: 500, angle: 0, hp: MAX_HP, isAlive: false },
    p2: { x: 150, y: 100, angle: 0, hp: MAX_HP, isAlive: false },
    p3: { x: 650, y: 100, angle: 0, hp: MAX_HP, isAlive: false }
};

const SPAWN_POINTS = {
    p1: { x: 400, y: 500 },
    p2: { x: 150, y: 100 },
    p3: { x: 650, y: 100 }
};

let keys = { w: false, a: false, s: false, d: false };
let mouseX = 0;
let mouseY = 0;
let isMouseDown = false;
let lastFireTime = 0;

// References
const stateRef = ref(db, 'game/state');
const playersRef = ref(db, 'game/players');
const bulletsRef = ref(db, 'game/bullets');

// ==========================================
// 4. Input Handling
// ==========================================
window.addEventListener('keydown', e => {
    if (e.key === 'w' || e.key === 'ArrowUp') keys.w = true;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (e.key === 's' || e.key === 'ArrowDown') keys.s = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.d = true;
});

window.addEventListener('keyup', e => {
    if (e.key === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (e.key === 's' || e.key === 'ArrowDown') keys.s = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.d = false;
});

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    // Scale mouse coordinates to match canvas internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener('mousedown', () => { isMouseDown = true; });
canvas.addEventListener('mouseup', () => { isMouseDown = false; });

// ==========================================
// 5. Lobby & Player Join
// ==========================================
joinBtn.addEventListener('click', async () => {
    joinBtn.disabled = true;
    joinBtn.innerText = "JOINING...";

    try {
        const snapshot = await get(playersRef);
        const pData = snapshot.val() || {};

        if (!pData.p1) myPlayerId = 'p1';
        else if (!pData.p2) myPlayerId = 'p2';
        else if (!pData.p3) myPlayerId = 'p3';
        
        if (myPlayerId) {
            // Register player
            const initialData = {
                x: SPAWN_POINTS[myPlayerId].x,
                y: SPAWN_POINTS[myPlayerId].y,
                angle: 0,
                hp: MAX_HP,
                isAlive: true
            };
            await set(ref(db, `game/players/${myPlayerId}`), initialData);
            onDisconnect(ref(db, `game/players/${myPlayerId}`)).remove();

            joinBtn.classList.add('hidden');
            playerAssignedP.classList.remove('hidden');
            
            let colorName = myPlayerId === 'p1' ? 'RED' : myPlayerId === 'p2' ? 'BLUE' : 'YELLOW';
            myPlayerNumSpan.innerText = `${myPlayerId.toUpperCase()} (${colorName})`;
            myPlayerNumSpan.style.color = COLORS[myPlayerId];

            // Start game if 3 players
            const newSnapshot = await get(playersRef);
            const newPlayers = newSnapshot.val() || {};
            if (newPlayers.p1 && newPlayers.p2 && newPlayers.p3) {
                startGame();
            }
        } else {
            alert("Lobby is full!");
            joinBtn.disabled = false;
            joinBtn.innerText = "JOIN GAME";
        }
    } catch (error) {
        console.error(error);
        joinBtn.disabled = false;
        joinBtn.innerText = "JOIN GAME";
    }
});

onValue(playersRef, (snapshot) => {
    const data = snapshot.val() || {};
    playerCountSpan.innerText = Object.keys(data).length;

    // Sync remote players to local state
    for (let id in data) {
        if (id !== myPlayerId) {
            players[id] = { ...players[id], ...data[id] };
        }
        // Always sync HP and isAlive for everyone including myself (if hit by others)
        players[id].hp = data[id].hp;
        players[id].isAlive = data[id].isAlive;
    }

    // Update HP UI
    for (let id of ['p1', 'p2', 'p3']) {
        if (data[id]) {
            hpBars[id].style.width = `${Math.max(0, data[id].hp)}%`;
        } else {
            hpBars[id].style.width = `0%`;
        }
    }

    // Auto-start check for all clients
    get(stateRef).then(stateSnap => {
        if (Object.keys(data).length === 3 && stateSnap.val() === 'waiting') {
            startGame();
        }
    });

    checkWinCondition();
});

// ==========================================
// 6. Game State Sync
// ==========================================
async function startGame() {
    const snapshot = await get(stateRef);
    if (snapshot.val() !== 'playing') {
        const updates = {};
        updates['game/state'] = 'playing';
        updates['game/bullets'] = null; // clear bullets
        await update(ref(db), updates);
    }
}

onValue(stateRef, (snapshot) => {
    const state = snapshot.val() || 'waiting';
    if (state === 'playing') {
        lobbyModal.classList.remove('active');
        isPlaying = true;
        localBullets = [];
        lastTime = performance.now();
        if (!animationFrameId) gameLoop();
    } else if (state === 'finished') {
        isPlaying = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
});

// Listen for new bullets fired by anyone
onChildAdded(bulletsRef, (snapshot) => {
    const b = snapshot.val();
    if (b) {
        localBullets.push({
            x: b.x,
            y: b.y,
            vx: b.vx,
            vy: b.vy,
            owner: b.owner,
            color: COLORS[b.owner]
        });
    }
});

// ==========================================
// 7. Main Game Loop (Physics & Rendering)
// ==========================================
let lastTime = 0;
let lastSyncTime = 0;

function gameLoop(timestamp = performance.now()) {
    if (!isPlaying) return;
    
    const dt = (timestamp - lastTime) / 1000; // delta time in seconds
    lastTime = timestamp;

    updatePhysics(dt);
    render();

    // Sync my position to Firebase at 20fps (every 50ms)
    if (timestamp - lastSyncTime > 50 && myPlayerId && players[myPlayerId].isAlive) {
        update(ref(db, `game/players/${myPlayerId}`), {
            x: players[myPlayerId].x,
            y: players[myPlayerId].y,
            angle: players[myPlayerId].angle
        });
        lastSyncTime = timestamp;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

function updatePhysics(dt) {
    // 1. Update My Player
    if (myPlayerId && players[myPlayerId].isAlive) {
        let me = players[myPlayerId];
        
        // Movement
        let dx = 0; let dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
        
        // Normalize vector
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx*dx + dy*dy);
            dx /= length; dy /= length;
        }

        me.x += dx * PLAYER_SPEED * dt;
        me.y += dy * PLAYER_SPEED * dt;

        // Boundaries
        me.x = Math.max(PLAYER_RADIUS, Math.min(canvas.width - PLAYER_RADIUS, me.x));
        me.y = Math.max(PLAYER_RADIUS, Math.min(canvas.height - PLAYER_RADIUS, me.y));

        // Aiming
        me.angle = Math.atan2(mouseY - me.y, mouseX - me.x);

        // Shooting
        if (isMouseDown && performance.now() - lastFireTime > FIRE_COOLDOWN) {
            fireBullet(me.x, me.y, me.angle);
            lastFireTime = performance.now();
        }
    }

    // 2. Update Bullets
    for (let i = localBullets.length - 1; i >= 0; i--) {
        let b = localBullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Remove if off-screen
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            localBullets.splice(i, 1);
            continue;
        }

        // Collision detection (Only I detect hits on MYSELF to avoid double damage)
        if (myPlayerId && players[myPlayerId].isAlive && b.owner !== myPlayerId) {
            let me = players[myPlayerId];
            let dist = Math.hypot(b.x - me.x, b.y - me.y);
            if (dist < PLAYER_RADIUS + BULLET_RADIUS) {
                // I got hit!
                localBullets.splice(i, 1);
                takeDamage(20);
                continue;
            }
        }
    }
}

function fireBullet(x, y, angle) {
    const b = {
        x: x + Math.cos(angle) * (PLAYER_RADIUS + 5),
        y: y + Math.sin(angle) * (PLAYER_RADIUS + 5),
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        owner: myPlayerId
    };
    push(bulletsRef, b);
}

function takeDamage(amount) {
    let hp = Math.max(0, players[myPlayerId].hp - amount);
    let isAlive = hp > 0;
    
    update(ref(db, `game/players/${myPlayerId}`), {
        hp: hp,
        isAlive: isAlive
    });
}

function render() {
    // Clear canvas
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines (Neon Arena feel)
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for(let i=0; i<canvas.height; i+=40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Draw Players
    for (let id of ['p1', 'p2', 'p3']) {
        let p = players[id];
        if (p && p.isAlive) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            
            // Draw Ship
            ctx.beginPath();
            ctx.moveTo(PLAYER_RADIUS, 0);
            ctx.lineTo(-PLAYER_RADIUS, -PLAYER_RADIUS/1.5);
            ctx.lineTo(-PLAYER_RADIUS/2, 0);
            ctx.lineTo(-PLAYER_RADIUS, PLAYER_RADIUS/1.5);
            ctx.closePath();
            
            ctx.fillStyle = COLORS[id];
            ctx.shadowColor = COLORS[id];
            ctx.shadowBlur = 15;
            ctx.fill();
            
            // Draw Player ID text
            ctx.rotate(-p.angle);
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 0;
            ctx.font = '10px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(id.toUpperCase(), 0, -25);

            ctx.restore();
        } else if (p && !p.isAlive && p.hp <= 0) {
            // Draw dead marker (x)
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, -10); ctx.lineTo(10, 10);
            ctx.moveTo(10, -10); ctx.lineTo(-10, 10);
            ctx.stroke();
            ctx.restore();
        }
    }

    // Draw Bullets
    for (let b of localBullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fill();
    }
}

// ==========================================
// 8. Win Condition Check
// ==========================================
function checkWinCondition() {
    if (!isPlaying) return;
    
    let alivePlayers = [];
    let deadPlayers = 0;
    let totalPlayers = 0;

    for (let id of ['p1', 'p2', 'p3']) {
        if (players[id]) {
            totalPlayers++;
            if (players[id].isAlive) alivePlayers.push(id);
            else deadPlayers++;
        }
    }

    // Game ends if only 1 player is alive (and we had 3 players originally)
    if (totalPlayers === 3 && alivePlayers.length <= 1) {
        set(stateRef, 'finished');
        
        let winnerStr = alivePlayers.length === 1 ? alivePlayers[0].toUpperCase() : "NOBODY";
        let colorStr = alivePlayers.length === 1 ? COLORS[alivePlayers[0]] : "#fff";

        winnerText.innerText = `${winnerStr} WINS!`;
        winnerText.style.color = colorStr;
        winnerText.style.textShadow = `0 0 20px ${colorStr}`;

        gameOverModal.classList.add('active');
    }
}

// Restart button
restartBtn.addEventListener('click', () => {
    // Only p1 can reset to avoid race conditions
    if (myPlayerId === 'p1') {
        set(playersRef, null);
        set(stateRef, 'waiting');
        set(bulletsRef, null);
    }
    location.reload();
});
