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
const timeLeftSpan = document.getElementById('time-left');

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
const killsDisp = {
    p1: document.getElementById('kills-p1'),
    p2: document.getElementById('kills-p2'),
    p3: document.getElementById('kills-p3')
};

// ==========================================
// 3. Game Variables & Constants
// ==========================================
let myPlayerId = null; 
let myPlayerName = "";
let isPlaying = false;
let animationFrameId;

const COLORS = { p1: '#ff003c', p2: '#00e5ff', p3: '#ffea00' };
const ITEM_EMOJIS = { heal: '💊', speed: '⚡', rapid: '🔫' };
const ITEM_COLORS = { heal: '#00ff44', speed: '#0088ff', rapid: '#bb00ff' };

const MAX_HP = 200;
let PLAYER_SPEED = 200; 
let FIRE_COOLDOWN = 300; 
const BULLET_SPEED = 600;
const PLAYER_RADIUS = 15;
const BULLET_RADIUS = 4;
const ITEM_RADIUS = 12;

let buffs = { speedTime: 0, rapidTime: 0 };
let dashState = { activeTime: 0, cooldown: 0, vx: 0, vy: 0 };

let localBullets = []; 
let localItems = {}; 
let floatingTexts = []; 
let players = {
    p1: { x: 400, y: 550, angle: 0, hp: MAX_HP, isAlive: false, name: '', kills: 0, respawnTime: 0 },
    p2: { x: 100, y: 100, angle: 0, hp: MAX_HP, isAlive: false, name: '', kills: 0, respawnTime: 0 },
    p3: { x: 700, y: 100, angle: 0, hp: MAX_HP, isAlive: false, name: '', kills: 0, respawnTime: 0 }
};

const SPAWN_POINTS = {
    p1: { x: 400, y: 550 },
    p2: { x: 100, y: 100 },
    p3: { x: 700, y: 100 }
};

let keys = { w: false, a: false, s: false, d: false, space: false };
let mouseX = 0;
let mouseY = 0;
let isMouseDown = false;
let lastFireTime = 0;
let itemSpawnInterval = null;
let gameTimerInterval = null;
let gameEndTime = 0;

// References
const stateRef = ref(db, 'game/state');
const endTimeRef = ref(db, 'game/endTime');
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
    if (k === ' ') keys.space = true;
});

window.addEventListener('keyup', e => {
    let k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (k === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (k === 's' || e.key === 'ArrowDown') keys.s = false;
    if (k === 'd' || e.key === 'ArrowRight') keys.d = false;
    if (k === ' ') keys.space = false;
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
    if (!name) { alert("Please enter a name first!"); return; }

    joinBtn.disabled = true;
    joinBtn.innerText = "JOINING...";

    try {
        const slots = ['p1', 'p2', 'p3'];
        let assigned = false;

        for (let slot of slots) {
            const slotRef = ref(db, `game/players/${slot}`);
            const result = await runTransaction(slotRef, (currentData) => {
                if (currentData === null) {
                    return {
                        x: SPAWN_POINTS[slot].x,
                        y: SPAWN_POINTS[slot].y,
                        angle: 0,
                        hp: MAX_HP,
                        isAlive: true,
                        name: name,
                        kills: 0,
                        respawnTime: 0
                    };
                }
                return; // Abort transaction if slot is taken
            });

            if (result.committed) {
                myPlayerId = slot;
                myPlayerName = name;
                assigned = true;
                break;
            }
        }
        
        if (assigned) {
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

    for (let id of ['p1', 'p2', 'p3']) {
        if (data[id]) {
            if (id !== myPlayerId) {
                players[id] = { ...players[id], ...data[id] };
            } else {
                players[id].hp = data[id].hp;
                players[id].isAlive = data[id].isAlive;
                players[id].kills = data[id].kills || 0;
                players[id].respawnTime = data[id].respawnTime || 0;
                players[id].name = data[id].name;
            }
            
            let colorName = id === 'p1' ? 'RED' : id === 'p2' ? 'BLUE' : 'YELLOW';
            hpLabels[id].innerText = `${data[id].name} (${colorName})`;
            hpBars[id].style.width = `${Math.max(0, (data[id].hp / MAX_HP) * 100)}%`;
            killsDisp[id].innerText = `${data[id].kills || 0} Kills`;
        } else {
            players[id].isAlive = false;
            hpLabels[id].innerText = `Waiting...`;
            hpBars[id].style.width = `0%`;
            killsDisp[id].innerText = `0 Kills`;
        }
    }

    // Any player can check to start the game
    get(stateRef).then(stateSnap => {
        const st = stateSnap.val();
        if (Object.keys(data).length === 3 && st !== 'playing' && st !== 'finished') {
            startGameAsHost();
        }
    });
});

// ==========================================
// 6. Game State & Host Logic
// ==========================================
async function startGameAsHost() {
    // Only one transaction needed to set state securely
    await runTransaction(stateRef, (current) => {
        if (current !== 'playing') return 'playing';
        return;
    });

    const updates = {
        'game/bullets': null,
        'game/items': null,
        'game/endTime': Date.now() + (3 * 60 * 1000) // 3 minutes
    };
    await update(ref(db), updates);
}

onValue(stateRef, (snapshot) => {
    const state = snapshot.val() || 'waiting';
    if (state === 'playing') {
        lobbyModal.classList.remove('active');
        isPlaying = true;
        hasProcessedWin = false;
        localBullets = [];
        localItems = {};
        floatingTexts = [];
        buffs = { speedTime: 0, rapidTime: 0 };
        dashState = { activeTime: 0, cooldown: 0, vx: 0, vy: 0 };
        lastTime = performance.now();
        
        get(endTimeRef).then(snap => {
            gameEndTime = snap.val() || Date.now() + 180000;
            if (gameTimerInterval) clearInterval(gameTimerInterval);
            gameTimerInterval = setInterval(updateTimerUI, 200);
        });

        if (!animationFrameId) gameLoop();
        
        if (myPlayerId === 'p1') {
            if (itemSpawnInterval) clearInterval(itemSpawnInterval);
            itemSpawnInterval = setInterval(spawnItem, 6000);
        }
    } else if (state === 'finished') {
        isPlaying = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        if (itemSpawnInterval) clearInterval(itemSpawnInterval);
        if (gameTimerInterval) clearInterval(gameTimerInterval);
        timeLeftSpan.innerText = "00:00";
    }
});

function updateTimerUI() {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((gameEndTime - now) / 1000));
    
    let m = Math.floor(remaining / 60).toString().padStart(2, '0');
    let s = (remaining % 60).toString().padStart(2, '0');
    timeLeftSpan.innerText = `${m}:${s}`;

    if (remaining <= 0 && isPlaying) {
        clearInterval(gameTimerInterval);
        endGame();
    }
}

function spawnItem() {
    if (Object.keys(localItems).length >= 4) return; 
    const types = ['heal', 'speed', 'rapid'];
    const type = types[Math.floor(Math.random() * types.length)];
    const item = {
        type: type,
        x: 50 + Math.random() * (canvas.width - 100),
        y: 50 + Math.random() * (canvas.height - 100)
    };
    push(itemsRef, item);
}

onChildAdded(itemsRef, snap => localItems[snap.key] = snap.val());
onChildRemoved(itemsRef, snap => delete localItems[snap.key]);

onChildAdded(bulletsRef, snap => {
    const b = snap.val();
    if (b) localBullets.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, owner: b.owner, color: COLORS[b.owner] });
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
    if (myPlayerId) {
        let me = players[myPlayerId];

        // Respawn Logic
        if (!me.isAlive) {
            if (me.respawnTime > 0 && Date.now() >= me.respawnTime) {
                update(ref(db, `game/players/${myPlayerId}`), {
                    x: SPAWN_POINTS[myPlayerId].x,
                    y: SPAWN_POINTS[myPlayerId].y,
                    hp: MAX_HP,
                    isAlive: true,
                    respawnTime: 0
                });
            }
        } 
        // Active Logic
        else {
            if (buffs.speedTime > 0) { PLAYER_SPEED = 300; buffs.speedTime -= dt; } else PLAYER_SPEED = 200;
            if (buffs.rapidTime > 0) { FIRE_COOLDOWN = 100; buffs.rapidTime -= dt; } else FIRE_COOLDOWN = 300;

            let dx = 0; let dy = 0;
            if (keys.w) dy -= 1;
            if (keys.s) dy += 1;
            if (keys.a) dx -= 1;
            if (keys.d) dx += 1;
            
            if (dx !== 0 && dy !== 0) {
                const len = Math.sqrt(dx*dx + dy*dy);
                dx /= len; dy /= len;
            }

            // Dash logic
            if (dashState.cooldown > 0) dashState.cooldown -= dt;
            if (keys.space && dashState.cooldown <= 0 && (dx !== 0 || dy !== 0)) {
                dashState.activeTime = 0.2;
                dashState.cooldown = 2.0;
                dashState.vx = dx * 800; // fast dash
                dashState.vy = dy * 800;
            }

            if (dashState.activeTime > 0) {
                me.x += dashState.vx * dt;
                me.y += dashState.vy * dt;
                dashState.activeTime -= dt;
            } else {
                me.x += dx * PLAYER_SPEED * dt;
                me.y += dy * PLAYER_SPEED * dt;
            }

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
                    addFloatingText(`+${item.type.toUpperCase()}!`, item.x, item.y, ITEM_COLORS[item.type]);
                    remove(ref(db, `game/items/${key}`)); 
                    delete localItems[key]; 
                }
            }
        }
    }

    // Bullets
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
                takeDamage(20, b.owner);
                continue;
            }
        }
    }

    // Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i];
        ft.y -= 30 * dt;
        ft.life -= dt;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
}

function applyItemEffect(type) {
    if (type === 'heal') {
        let newHp = Math.min(MAX_HP, players[myPlayerId].hp + 50);
        update(ref(db, `game/players/${myPlayerId}`), { hp: newHp });
    } else if (type === 'speed') { buffs.speedTime = 5; }
    else if (type === 'rapid') { buffs.rapidTime = 5; }
}

function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text, x, y, life: 1.0, color });
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

function takeDamage(amount, killerId) {
    let hp = Math.max(0, players[myPlayerId].hp - amount);
    let isAlive = hp > 0;
    
    let updates = { hp, isAlive };
    
    if (!isAlive) {
        updates.respawnTime = Date.now() + 3000; // 3 sec respawn
        // Add kill to killer
        runTransaction(ref(db, `game/players/${killerId}/kills`), (kills) => {
            return (kills || 0) + 1;
        });
    }
    
    update(ref(db, `game/players/${myPlayerId}`), updates);
}

function render() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for(let i=0; i<canvas.height; i+=40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

    // Draw Items
    for (let key in localItems) {
        let item = localItems[key];
        ctx.beginPath();
        ctx.arc(item.x, item.y, ITEM_RADIUS, 0, Math.PI*2);
        ctx.fillStyle = '#111';
        ctx.shadowColor = ITEM_COLORS[item.type];
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.strokeStyle = ITEM_COLORS[item.type];
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ITEM_EMOJIS[item.type], item.x, item.y + 2);
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
            ctx.fillText(p.name, 0, -25); 
            ctx.restore();
        } 
        // Respawning state
        else if (p && !p.isAlive && p.respawnTime > 0) {
            let remain = Math.ceil((p.respawnTime - Date.now()) / 1000);
            if (remain > 0) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.fillStyle = COLORS[id];
                ctx.globalAlpha = 0.5;
                ctx.font = '16px Orbitron';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(remain, 0, 0);
                ctx.restore();
            }
        }
    }

    for (let b of localBullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fill();
    }

    for (let ft of floatingTexts) {
        ctx.fillStyle = ft.color;
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 5;
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'center';
        ctx.globalAlpha = ft.life;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }
}

// ==========================================
// 8. End Game & Save Stats
// ==========================================
let hasProcessedWin = false;

async function endGame() {
    if (hasProcessedWin) return;
    hasProcessedWin = true;

    // Find winner
    let maxKills = -1;
    let winners = [];
    
    for (let id of ['p1', 'p2', 'p3']) {
        if (players[id] && players[id].name) {
            if (players[id].kills > maxKills) {
                maxKills = players[id].kills;
                winners = [players[id]];
            } else if (players[id].kills === maxKills) {
                winners.push(players[id]);
            }
        }
    }

    if (winners.length === 1) {
        let winner = winners[0];
        winnerText.innerText = `${winner.name} WINS!`;
        
        if (winner.name === myPlayerName) {
            const statRef = ref(db, `stats/wins/${myPlayerName}`);
            await runTransaction(statRef, current => (current || 0) + 1);
        }

        setTimeout(() => {
            get(ref(db, `stats/wins/${winner.name}`)).then(snap => {
                winnerStatsText.innerText = `Total Wins: ${snap.val() || 1} (Score: ${maxKills} Kills)`;
            });
        }, 500);

    } else {
        winnerText.innerText = `DRAW!`;
        winnerStatsText.innerText = `Score: ${maxKills} Kills`;
    }

    if (myPlayerId === 'p1') {
        set(stateRef, 'finished');
    }
    gameOverModal.classList.add('active');
}

restartBtn.addEventListener('click', () => {
    set(playersRef, null);
    set(stateRef, 'waiting');
    set(bulletsRef, null);
    set(itemsRef, null);
    location.reload();
});
