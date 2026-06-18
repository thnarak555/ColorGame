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
    onChildAdded,
    onChildRemoved,
    remove,
    runTransaction
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==========================================
// 2. DOM Elements & Canvas Setup
// ==========================================
const lobbyModal = document.getElementById('lobby-modal');
const gameOverModal = document.getElementById('game-over-modal');
const joinBtn = document.getElementById('join-btn');
const nameInput = document.getElementById('player-name-input');
const playerCountSpan = document.getElementById('player-count');
const playerAssignedP = document.getElementById('player-assigned');
const myPlayerNumSpan = document.getElementById('my-player-num');
const myPlayerNameDisp = document.getElementById('my-player-name-disp');
const winnerText = document.getElementById('winner-text');
const winnerStatsText = document.getElementById('winner-stats-text');
const restartBtn = document.getElementById('restart-btn');
const leaderboardList = document.getElementById('leaderboard-list');

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const hpLabels = {
    p1: document.getElementById('label-p1'),
    p2: document.getElementById('label-p2'),
    p3: document.getElementById('label-p3')
};
const hpBars = {
    p1: document.getElementById('hp-p1'),
    p2: document.getElementById('hp-p2'),
    p3: document.getElementById('hp-p3')
};

// ==========================================
// 3. Game Variables & Constants
// ==========================================
let myPlayerId = null; 
let myPlayerName = "";
let isPlaying = false;
let animationFrameId;

const COLORS = {
    p1: '#ff003c',
    p2: '#00e5ff',
    p3: '#ffea00'
};

const ITEM_COLORS = {
    heal: '#00ff44',    // Green
    speed: '#0088ff',   // Blue
    rapid: '#bb00ff'    // Purple
};

const MAX_HP = 100;
let PLAYER_SPEED = 200; 
let FIRE_COOLDOWN = 300; 
const BULLET_SPEED = 500;
const PLAYER_RADIUS = 15;
const BULLET_RADIUS = 4;
const ITEM_RADIUS = 10;

let buffs = { speedTime: 0, rapidTime: 0 };

let localBullets = []; 
let localItems = {}; // id -> {type, x, y}
let players = {
    p1: { x: 400, y: 500, angle: 0, hp: MAX_HP, isAlive: false, name: '' },
    p2: { x: 150, y: 100, angle: 0, hp: MAX_HP, isAlive: false, name: '' },
    p3: { x: 650, y: 100, angle: 0, hp: MAX_HP, isAlive: false, name: '' }
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
let itemSpawnInterval = null;

// References
const stateRef = ref(db, 'game/state');
const playersRef = ref(db, 'game/players');
const bulletsRef = ref(db, 'game/bullets');
const itemsRef = ref(db, 'game/items');
const statsRef = ref(db, 'stats/wins');

// ==========================================
// 4. Input Handling
// ==========================================
window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') keys.w = true;
    if (k === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (k === 's' || e.key === 'ArrowDown') keys.s = true;
    if (k === 'd' || e.key === 'ArrowRight') keys.d = true;
});

window.addEventListener('keyup', e => {
    let k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (k === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (k === 's' || e.key === 'ArrowDown') keys.s = false;
    if (k === 'd' || e.key === 'ArrowRight') keys.d = false;
});

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener('mousedown', () => { isMouseDown = true; });
canvas.addEventListener('mouseup', () => { isMouseDown = false; });

// ==========================================
// 5. Lobby & Leaderboard
// ==========================================
onValue(statsRef, snapshot => {
    const winsData = snapshot.val() || {};
    // Sort descending
    const sorted = Object.entries(winsData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    leaderboardList.innerHTML = '';
    if (sorted.length === 0) {
        leaderboardList.innerHTML = '<li>No games played yet.</li>';
    } else {
        sorted.forEach(([name, score], index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>#${index+1} ${name}</span> <span>${score} Wins</span>`;
            leaderboardList.appendChild(li);
        });
    }
});

joinBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
        alert("Please enter a name first!");
        return;
    }

    joinBtn.disabled = true;
    joinBtn.innerText = "JOINING...";

    try {
        const snapshot = await get(playersRef);
        const pData = snapshot.val() || {};

        if (!pData.p1) myPlayerId = 'p1';
        else if (!pData.p2) myPlayerId = 'p2';
        else if (!pData.p3) myPlayerId = 'p3';
        
        if (myPlayerId) {
            myPlayerName = name;
            const initialData = {
                x: SPAWN_POINTS[myPlayerId].x,
                y: SPAWN_POINTS[myPlayerId].y,
                angle: 0,
                hp: MAX_HP,
                isAlive: true,
                name: myPlayerName
            };
            
            await set(ref(db, `game/players/${myPlayerId}`), initialData);
            onDisconnect(ref(db, `game/players/${myPlayerId}`)).remove();

            nameInput.classList.add('hidden');
            joinBtn.classList.add('hidden');
            playerAssignedP.classList.remove('hidden');
            
            myPlayerNameDisp.innerText = myPlayerName;
            let colorName = myPlayerId === 'p1' ? 'RED' : myPlayerId === 'p2' ? 'BLUE' : 'YELLOW';
            myPlayerNumSpan.innerText = `${myPlayerId.toUpperCase()} (${colorName})`;
            myPlayerNumSpan.style.color = COLORS[myPlayerId];

        } else {
            alert("Lobby is full! Please wait for the next game.");
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

    // Sync state
    for (let id of ['p1', 'p2', 'p3']) {
        if (data[id]) {
            if (id !== myPlayerId) {
                players[id] = { ...players[id], ...data[id] };
            } else {
                // I only sync HP and isAlive from server, so others can damage me
                players[id].hp = data[id].hp;
                players[id].isAlive = data[id].isAlive;
                players[id].name = data[id].name;
            }
            
            // Update HUD text
            let colorName = id === 'p1' ? 'RED' : id === 'p2' ? 'BLUE' : 'YELLOW';
            hpLabels[id].innerText = `${data[id].name} (${colorName})`;
            hpBars[id].style.width = `${Math.max(0, data[id].hp)}%`;
        } else {
            players[id].isAlive = false;
            hpLabels[id].innerText = `Waiting...`;
            hpBars[id].style.width = `0%`;
        }
    }

    // Host checking to start game
    if (myPlayerId === 'p1') {
        get(stateRef).then(stateSnap => {
            const st = stateSnap.val() || 'waiting';
            if (Object.keys(data).length === 3 && st === 'waiting') {
                startGameAsHost();
            }
        });
    }

    checkWinCondition();
});

// ==========================================
// 6. Game State & Host Logic
// ==========================================
async function startGameAsHost() {
    const updates = {
        'game/state': 'playing',
        'game/bullets': null,
        'game/items': null
    };
    await update(ref(db), updates);
}

onValue(stateRef, (snapshot) => {
    const state = snapshot.val() || 'waiting';
    if (state === 'playing') {
        lobbyModal.classList.remove('active');
        isPlaying = true;
        localBullets = [];
        localItems = {};
        buffs = { speedTime: 0, rapidTime: 0 };
        PLAYER_SPEED = 200;
        FIRE_COOLDOWN = 300;
        lastTime = performance.now();
        
        if (!animationFrameId) gameLoop();
        
        // P1 handles item spawning
        if (myPlayerId === 'p1') {
            if (itemSpawnInterval) clearInterval(itemSpawnInterval);
            itemSpawnInterval = setInterval(spawnItem, 6000);
        }
    } else if (state === 'finished') {
        isPlaying = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        if (itemSpawnInterval) clearInterval(itemSpawnInterval);
    }
});

// Item Spawner (P1 only)
function spawnItem() {
    if (Object.keys(localItems).length >= 3) return; // Max 3 items
    
    const types = ['heal', 'speed', 'rapid'];
    const type = types[Math.floor(Math.random() * types.length)];
    const item = {
        type: type,
        x: 50 + Math.random() * (canvas.width - 100),
        y: 50 + Math.random() * (canvas.height - 100)
    };
    push(itemsRef, item);
}

// Listen for items
onChildAdded(itemsRef, (snapshot) => {
    localItems[snapshot.key] = snapshot.val();
});
onChildRemoved(itemsRef, (snapshot) => {
    delete localItems[snapshot.key];
});

// Listen for bullets
onChildAdded(bulletsRef, (snapshot) => {
    const b = snapshot.val();
    if (b) {
        localBullets.push({
            x: b.x, y: b.y, vx: b.vx, vy: b.vy, 
            owner: b.owner, color: COLORS[b.owner]
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
    
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    updatePhysics(dt);
    render();

    // Sync position
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
    if (myPlayerId && players[myPlayerId].isAlive) {
        let me = players[myPlayerId];
        
        // Handle Buffs
        if (buffs.speedTime > 0) {
            PLAYER_SPEED = 300;
            buffs.speedTime -= dt;
        } else PLAYER_SPEED = 200;

        if (buffs.rapidTime > 0) {
            FIRE_COOLDOWN = 100;
            buffs.rapidTime -= dt;
        } else FIRE_COOLDOWN = 300;

        // Movement
        let dx = 0; let dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
        
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx*dx + dy*dy);
            dx /= length; dy /= length;
        }

        me.x += dx * PLAYER_SPEED * dt;
        me.y += dy * PLAYER_SPEED * dt;

        me.x = Math.max(PLAYER_RADIUS, Math.min(canvas.width - PLAYER_RADIUS, me.x));
        me.y = Math.max(PLAYER_RADIUS, Math.min(canvas.height - PLAYER_RADIUS, me.y));

        me.angle = Math.atan2(mouseY - me.y, mouseX - me.x);

        if (isMouseDown && performance.now() - lastFireTime > FIRE_COOLDOWN) {
            fireBullet(me.x, me.y, me.angle);
            lastFireTime = performance.now();
        }

        // Item Collision
        for (let key in localItems) {
            let item = localItems[key];
            let dist = Math.hypot(item.x - me.x, item.y - me.y);
            if (dist < PLAYER_RADIUS + ITEM_RADIUS) {
                applyItemEffect(item.type);
                remove(ref(db, `game/items/${key}`)); // Remove from DB
                delete localItems[key]; // Remove locally to prevent multi-pickup
            }
        }
    }

    // Update Bullets
    for (let i = localBullets.length - 1; i >= 0; i--) {
        let b = localBullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            localBullets.splice(i, 1);
            continue;
        }

        if (myPlayerId && players[myPlayerId].isAlive && b.owner !== myPlayerId) {
            let me = players[myPlayerId];
            let dist = Math.hypot(b.x - me.x, b.y - me.y);
            if (dist < PLAYER_RADIUS + BULLET_RADIUS) {
                localBullets.splice(i, 1);
                takeDamage(20);
                continue;
            }
        }
    }
}

function applyItemEffect(type) {
    if (type === 'heal') {
        let newHp = Math.min(MAX_HP, players[myPlayerId].hp + 30);
        update(ref(db, `game/players/${myPlayerId}`), { hp: newHp });
    } else if (type === 'speed') {
        buffs.speedTime = 5; // 5 seconds
    } else if (type === 'rapid') {
        buffs.rapidTime = 5; // 5 seconds
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
    update(ref(db, `game/players/${myPlayerId}`), { hp, isAlive });
}

function render() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for(let i=0; i<canvas.height; i+=40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Draw Items
    for (let key in localItems) {
        let item = localItems[key];
        ctx.beginPath();
        ctx.arc(item.x, item.y, ITEM_RADIUS, 0, Math.PI*2);
        ctx.fillStyle = ITEM_COLORS[item.type];
        ctx.shadowColor = ITEM_COLORS[item.type];
        ctx.shadowBlur = 15;
        ctx.fill();

        // Draw letter inside
        ctx.fillStyle = '#000';
        ctx.shadowBlur = 0;
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let letter = item.type === 'heal' ? 'H' : (item.type === 'speed' ? 'S' : 'R');
        ctx.fillText(letter, item.x, item.y);
    }

    // Draw Players
    for (let id of ['p1', 'p2', 'p3']) {
        let p = players[id];
        if (p && p.isAlive) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            
            ctx.beginPath();
            ctx.moveTo(PLAYER_RADIUS, 0);
            ctx.lineTo(-PLAYER_RADIUS, -PLAYER_RADIUS/1.5);
            ctx.lineTo(-PLAYER_RADIUS/2, 0);
            ctx.lineTo(-PLAYER_RADIUS, PLAYER_RADIUS/1.5);
            ctx.closePath();
            
            // If they have buffs, add aura
            let hasAura = false;
            if (id === myPlayerId && buffs.speedTime > 0) { ctx.shadowColor = ITEM_COLORS.speed; hasAura = true; }
            if (id === myPlayerId && buffs.rapidTime > 0) { ctx.shadowColor = ITEM_COLORS.rapid; hasAura = true; }
            if (!hasAura) ctx.shadowColor = COLORS[id];
            
            ctx.fillStyle = COLORS[id];
            ctx.shadowBlur = 15;
            ctx.fill();
            
            ctx.rotate(-p.angle);
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 0;
            ctx.font = '10px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, 0, -25); // Show name instead of ID

            ctx.restore();
        } else if (p && !p.isAlive && p.hp <= 0 && p.name) {
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
// 8. Win Condition & Save Stats
// ==========================================
let hasProcessedWin = false;

async function checkWinCondition() {
    if (!isPlaying || hasProcessedWin) return;
    
    let alivePlayers = [];
    let totalReady = 0;

    for (let id of ['p1', 'p2', 'p3']) {
        if (players[id] && players[id].name) {
            totalReady++;
            if (players[id].isAlive) alivePlayers.push(players[id]);
        }
    }

    if (totalReady === 3 && alivePlayers.length <= 1) {
        hasProcessedWin = true;
        set(stateRef, 'finished');
        
        if (alivePlayers.length === 1) {
            let winner = alivePlayers[0];
            winnerText.innerText = `${winner.name} WINS!`;
            
            // Only the winner themselves updates their score to avoid duplicates
            if (winner.name === myPlayerName) {
                const statRef = ref(db, `stats/wins/${myPlayerName}`);
                await runTransaction(statRef, (currentWins) => {
                    return (currentWins || 0) + 1;
                });
            }

            // Read the updated stat to display
            setTimeout(() => {
                get(ref(db, `stats/wins/${winner.name}`)).then(snap => {
                    winnerStatsText.innerText = `Total Wins: ${snap.val() || 1}`;
                });
            }, 500);

        } else {
            winnerText.innerText = `NOBODY WINS!`;
            winnerText.style.color = '#fff';
            winnerStatsText.innerText = '';
        }

        gameOverModal.classList.add('active');
    }
}

// Restart button
restartBtn.addEventListener('click', () => {
    // Host cleans up
    if (myPlayerId === 'p1') {
        set(playersRef, null);
        set(stateRef, 'waiting');
        set(bulletsRef, null);
        set(itemsRef, null);
    } else {
        // Just remove myself if host is slow
        remove(ref(db, `game/players/${myPlayerId}`));
    }
    location.reload();
});
