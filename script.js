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
const testBtn = document.getElementById('test-btn');
const stopBtn = document.getElementById('stop-btn');
const exitBtn = document.getElementById('exit-btn');
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

const lobbySettingsBtn = document.getElementById('lobby-settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingVol = document.getElementById('setting-vol');
const settingDmg = document.getElementById('setting-dmg');
const settingVfx = document.getElementById('setting-vfx');
const settingCrosshair = document.getElementById('setting-crosshair');

const matchSettingsUI = document.getElementById('match-settings');
const ruleDuration = document.getElementById('rule-duration');
const ruleHp = document.getElementById('rule-hp');
const ruleItems = document.getElementById('rule-items');
const ruleSpeed = document.getElementById('rule-speed');

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
let isPaused = false;
let isTestMode = false;
let pauseTime = 0;
let animationFrameId;

const COLORS = { p1: '#ff2d55', p2: '#00e5ff', p3: '#ffd60a' };
const ITEM_EMOJIS = { heal: '💊', speed: '⚡', rapid: '🔫', shield: '🛡️', shotgun: '💥', laser: '✨' };
const ITEM_COLORS = { heal: '#00ff44', speed: '#0088ff', rapid: '#bb00ff', shield: '#ffffff', shotgun: '#ffd60a', laser: '#ff00ff' };
let BULLET_DMG = 15;

let MAX_HP = 200;
let BASE_SPEED = 200;
let PLAYER_SPEED = 200; 
let FIRE_COOLDOWN = 300; 
let GAME_DURATION = 180000;
let ITEM_SPAWN_RATE = 6000;

const BULLET_SPEED = 600;
const PLAYER_RADIUS = 15;
const BULLET_RADIUS = 4;
const ITEM_RADIUS = 12;

let buffs = { speedTime: 0, rapidTime: 0, shieldTime: 0, shotgunTime: 0, laserTime: 0 };
let dashState = { activeTime: 0, cooldown: 0, vx: 0, vy: 0 };

let clientSettings = {
    volume: 0.5,
    dmg: true,
    vfx: true,
    crosshair: true
};

let localBullets = []; 
let localItems = {}; 
let floatingTexts = []; 
let particles = [];
let players = {
    p1: { x: 400, y: 550, angle: 0, hp: MAX_HP, isAlive: false, name: '', kills: 0, respawnTime: 0 },
    p2: { x: 100, y: 100, angle: 0, hp: MAX_HP, isAlive: false, name: '', kills: 0, respawnTime: 0 },
    p3: { x: 700, y: 100, angle: 0, hp: MAX_HP, isAlive: false, name: '', kills: 0, respawnTime: 0 }
};

const SPAWN_POINTS = {
    p1: { x: 640, y: 650 },
    p2: { x: 100, y: 100 },
    p3: { x: 1180, y: 100 }
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
const rulesRef = ref(db, 'game/rules');
const eventsRef = ref(db, 'game/events');
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

canvas.addEventListener('mousedown', () => { 
    isMouseDown = true; 
    initAudio();
});
canvas.addEventListener('mouseup', () => { isMouseDown = false; });

lobbySettingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

settingVol.addEventListener('input', e => clientSettings.volume = parseFloat(e.target.value));
settingDmg.addEventListener('change', e => clientSettings.dmg = e.target.checked);
settingVfx.addEventListener('change', e => clientSettings.vfx = e.target.checked);
settingCrosshair.addEventListener('change', e => {
    clientSettings.crosshair = e.target.checked;
    if (clientSettings.crosshair) canvas.classList.add('custom-crosshair');
    else canvas.classList.remove('custom-crosshair');
});
canvas.classList.add('custom-crosshair');

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
    initAudio();
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
            
            if (myPlayerId === 'p1') {
                matchSettingsUI.style.display = 'block';
            }
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

testBtn.addEventListener('click', async () => {
    initAudio();
    isTestMode = true;
    myPlayerId = 'p1';
    myPlayerName = nameInput.value.trim() || "Tester";
    
    let hp = parseInt(ruleHp.value) || 200;
    
    players.p1.name = myPlayerName;
    players.p2.name = 'Dummy 1';
    players.p3.name = 'Dummy 2';

    await update(ref(db), {
        'game/players/p1': { x: SPAWN_POINTS.p1.x, y: SPAWN_POINTS.p1.y, angle: 0, hp: hp, isAlive: true, name: myPlayerName, kills: 0, respawnTime: 0 },
        'game/players/p2': { x: SPAWN_POINTS.p2.x, y: SPAWN_POINTS.p2.y, angle: 0, hp: hp, isAlive: true, name: 'Dummy 1', kills: 0, respawnTime: 0 },
        'game/players/p3': { x: SPAWN_POINTS.p3.x, y: SPAWN_POINTS.p3.y, angle: 0, hp: hp, isAlive: true, name: 'Dummy 2', kills: 0, respawnTime: 0 }
    });

    onDisconnect(ref(db, `game/players/${myPlayerId}`)).remove();
    startGameAsHost();
});

stopBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    stopBtn.innerText = isPaused ? "RESUME" : "PAUSE";
    if (isPaused) {
        pauseTime = Date.now();
    } else {
        let pausedDuration = Date.now() - pauseTime;
        gameEndTime += pausedDuration;
        if (myPlayerId === 'p1') {
            update(ref(db, 'game'), { endTime: gameEndTime });
        }
    }
});

exitBtn.addEventListener('click', () => {
    try {
        exitBtn.disabled = true;
        exitBtn.innerText = "EXITING...";
        isPlaying = false;
        
        if (isTestMode || myPlayerId === 'p1') {
            update(ref(db), {
                'game/state': 'waiting',
                'game/players': null,
                'game/bullets': null,
                'game/items': null
            }).finally(() => location.reload());
        } else if (myPlayerId) {
            remove(ref(db, `game/players/${myPlayerId}`)).finally(() => location.reload());
        }
        
        setTimeout(() => location.reload(), 800);
    } catch (e) {
        console.error("Exit error:", e);
        location.reload();
    }
});

onValue(playersRef, (snapshot) => {
    const data = snapshot.val() || {};
    playerCountSpan.innerText = Object.keys(data).length;

    for (let id of ['p1', 'p2', 'p3']) {
        if (data[id]) {
            if (id !== myPlayerId) {
                players[id].targetX = data[id].x;
                players[id].targetY = data[id].y;
                players[id].angle = data[id].angle;
                players[id].hp = data[id].hp;
                players[id].isAlive = data[id].isAlive;
                players[id].name = data[id].name;
                players[id].kills = data[id].kills || 0;
                players[id].respawnTime = data[id].respawnTime || 0;
                players[id].hasShield = data[id].hasShield || false;
                players[id].spawnProtectTime = data[id].spawnProtectTime || 0;
                players[id].lastKillerName = data[id].lastKillerName || '';
            } else {
                players[id].hp = data[id].hp;
                players[id].isAlive = data[id].isAlive;
                players[id].kills = data[id].kills || 0;
                players[id].respawnTime = data[id].respawnTime || 0;
                players[id].name = data[id].name;
                players[id].spawnProtectTime = data[id].spawnProtectTime || 0;
                players[id].lastKillerName = data[id].lastKillerName || '';
            }
            
            let colorName = id === 'p1' ? 'RED' : id === 'p2' ? 'BLUE' : 'YELLOW';
            hpLabels[id].innerText = `${data[id].name} (${colorName})`;
            hpBars[id].style.width = `${Math.max(0, (data[id].hp / MAX_HP) * 100)}%`;
            killsDisp[id].innerText = `${data[id].kills || 0} Kills`;
        } else {
            players[id].isAlive = false;
            players[id].name = ''; // Prevent ghost names
            hpLabels[id].innerText = `Waiting...`;
            hpBars[id].style.width = `0%`;
            killsDisp[id].innerText = `0 Kills`;
        }
    }

    // Any player can check to start the game
    get(stateRef).then(stateSnap => {
        const st = stateSnap.val();
        if (Object.keys(data).length === 3 && st !== 'playing' && st !== 'finished' && myPlayerId === 'p1') {
            startGameAsHost();
        }
    });
});

onValue(rulesRef, snap => {
    let r = snap.val();
    if (r) {
        GAME_DURATION = r.duration;
        MAX_HP = r.hp;
        ITEM_SPAWN_RATE = r.items;
        BASE_SPEED = r.speed;
        PLAYER_SPEED = BASE_SPEED;
    }
});

// ==========================================
// 6. Game State & Host Logic
// ==========================================
async function startGameAsHost() {
    let dur = parseInt(ruleDuration.value) || 180000;
    let hp = parseInt(ruleHp.value) || 200;
    let itm = parseInt(ruleItems.value) || 6000;
    let spd = parseInt(ruleSpeed.value) || 200;

    GAME_DURATION = dur;
    MAX_HP = hp;
    ITEM_SPAWN_RATE = itm;
    BASE_SPEED = spd;
    PLAYER_SPEED = spd;

    const updates = {
        'game/bullets': null,
        'game/items': null,
        'game/events': null,
        'game/rules': { duration: dur, hp: hp, items: itm, speed: spd },
        'game/endTime': dur > 0 ? Date.now() + dur : 0
    };
    
    // Reset everyone
    for (let id of ['p1', 'p2', 'p3']) {
        if (players[id] && players[id].name) {
            updates[`game/players/${id}/hp`] = hp;
            updates[`game/players/${id}/isAlive`] = true;
            updates[`game/players/${id}/kills`] = 0;
            updates[`game/players/${id}/respawnTime`] = 0;
            updates[`game/players/${id}/x`] = SPAWN_POINTS[id].x;
            updates[`game/players/${id}/y`] = SPAWN_POINTS[id].y;
            updates[`game/players/${id}/hasShield`] = false;
            updates[`game/players/${id}/spawnProtectTime`] = 0;
            updates[`game/players/${id}/lastKillerName`] = '';
        }
    }

    await update(ref(db), updates);

    await runTransaction(stateRef, (current) => {
        if (current !== 'playing') return 'playing';
        return;
    });
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
        buffs = { speedTime: 0, rapidTime: 0, shieldTime: 0, shotgunTime: 0, laserTime: 0 };
        dashState = { activeTime: 0, cooldown: 0, vx: 0, vy: 0 };
        lastTime = performance.now();
        
        get(endTimeRef).then(snap => {
            gameEndTime = snap.val() || (GAME_DURATION > 0 ? Date.now() + GAME_DURATION : 0);
            if (gameTimerInterval) clearInterval(gameTimerInterval);
            gameTimerInterval = setInterval(updateTimerUI, 200);
        });

        if (!animationFrameId) gameLoop();
        
        if (myPlayerId === 'p1' && ITEM_SPAWN_RATE > 0) {
            if (itemSpawnInterval) clearInterval(itemSpawnInterval);
            itemSpawnInterval = setInterval(spawnItem, ITEM_SPAWN_RATE);
        }
    } else if (state === 'finished' || state === 'waiting') {
        isPlaying = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        if (itemSpawnInterval) clearInterval(itemSpawnInterval);
        if (gameTimerInterval) clearInterval(gameTimerInterval);
        
        if (state === 'finished') {
            timeLeftSpan.innerText = "00:00";
        }
        
        if (state === 'waiting' && !lobbyModal.classList.contains('active')) {
            location.reload();
        }
    }
});

function updateTimerUI() {
    const now = isPaused ? pauseTime : Date.now();
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
    const types = ['heal', 'speed', 'rapid', 'shield', 'shotgun', 'laser'];
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

onChildAdded(eventsRef, snap => {
    let ev = snap.val();
    if (!ev) return;
    if (ev.type === 'kill' && Date.now() - ev.timestamp < 10000) {
        addKillFeed(`⚔️ ${ev.killerName} killed ${ev.targetName}`, ev.color);
    } else if (ev.type === 'item' && Date.now() - ev.timestamp < 10000) {
        addKillFeed(`${ev.emoji} ${ev.playerName} got ${ev.itemName}!`, ev.color);
    }
});

function addKillFeed(text, color) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'kill-feed-item';
    item.innerHTML = `<span style="color:${color}">${text}</span>`;
    feed.appendChild(item);
    setTimeout(() => {
        if (item.parentNode) item.parentNode.removeChild(item);
    }, 5000);
}

onChildAdded(bulletsRef, snap => {
    const b = snap.val();
    if (b) {
        if (!b.id || !localBullets.some(lb => lb.id === b.id)) {
            localBullets.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, owner: b.owner, color: COLORS[b.owner], dmg: b.dmg, pierce: b.pierce, id: b.id });
        }
    }
});

// ==========================================
// 7. Main Game Loop (Physics & Rendering)
// ==========================================
let lastTime = 0;
let lastSyncTime = 0;

function gameLoop(timestamp = performance.now()) {
    if (!isPlaying) return;
    
    if (isPaused) {
        lastTime = timestamp;
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
    }
    
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    updatePhysics(dt);
    render();

    if (timestamp - lastSyncTime > 50 && myPlayerId && players[myPlayerId].isAlive && isPlaying) {
        update(ref(db, `game/players/${myPlayerId}`), {
            x: players[myPlayerId].x,
            y: players[myPlayerId].y,
            angle: players[myPlayerId].angle,
            hasShield: (buffs.shieldTime > 0)
        });
        lastSyncTime = timestamp;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

function updatePhysics(dt) {
    // Enemy Lerping
    for (let id of ['p1', 'p2', 'p3']) {
        if (id !== myPlayerId && players[id] && players[id].isAlive) {
            let p = players[id];
            if (p.targetX !== undefined && p.targetY !== undefined) {
                if (Math.hypot(p.targetX - p.x, p.targetY - p.y) > 300) {
                    p.x = p.targetX;
                    p.y = p.targetY;
                } else {
                    p.x += (p.targetX - p.x) * 15 * dt;
                    p.y += (p.targetY - p.y) * 15 * dt;
                }
            }
        }
    }

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
                    respawnTime: 0,
                    spawnProtectTime: Date.now() + 1500
                });
            }
        } 
        // Active Logic
        else {
            if (buffs.speedTime > 0) { PLAYER_SPEED = BASE_SPEED * 1.5; buffs.speedTime -= dt; } else PLAYER_SPEED = BASE_SPEED;
            if (buffs.rapidTime > 0) { FIRE_COOLDOWN = 100; buffs.rapidTime -= dt; } else FIRE_COOLDOWN = 300;
            if (buffs.shieldTime > 0) buffs.shieldTime -= dt;
            if (buffs.shotgunTime > 0) buffs.shotgunTime -= dt;
            if (buffs.laserTime > 0) buffs.laserTime -= dt;

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
                if (clientSettings.vfx) spawnParticle(me.x, me.y, COLORS[myPlayerId], 0.3, PLAYER_RADIUS);
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
                    playSound('item');
                    applyItemEffect(item.type);
                    addFloatingText(`+${item.type.toUpperCase()}!`, item.x, item.y, ITEM_COLORS[item.type]);
                    remove(ref(db, `game/items/${key}`)); 
                    delete localItems[key]; 
                }
            }
        }
    }

    if (isTestMode) {
        for (let dummyId of ['p2', 'p3']) {
            let dummy = players[dummyId];
            if (dummy && !dummy.isAlive && dummy.respawnTime > 0 && Date.now() >= dummy.respawnTime) {
                update(ref(db, `game/players/${dummyId}`), {
                    x: SPAWN_POINTS[dummyId].x,
                    y: SPAWN_POINTS[dummyId].y,
                    hp: MAX_HP,
                    isAlive: true,
                    respawnTime: 0
                });
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

        let hitSomeone = false;
        for (let targetId of ['p1', 'p2', 'p3']) {
            if (b.owner !== targetId && players[targetId] && players[targetId].isAlive) {
                let target = players[targetId];
                let dist = Math.hypot(b.x - target.x, b.y - target.y);
                if (dist < PLAYER_RADIUS + BULLET_RADIUS) {
                    hitSomeone = true;
                    if (b.owner === myPlayerId || isTestMode) {
                        takeDamage(b.dmg || BULLET_DMG, b.owner, targetId);
                    }
                    break;
                }
            }
        }

        if (hitSomeone && !b.pierce) {
            localBullets.splice(i, 1);
            continue;
        }
    }

    // Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i];
        ft.y -= 30 * dt;
        ft.life -= dt;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].life -= dt;
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
}

function applyItemEffect(type) {
    push(ref(db, 'game/events'), {
        type: 'item',
        playerName: myPlayerName,
        itemName: type.toUpperCase(),
        emoji: ITEM_EMOJIS[type],
        color: ITEM_COLORS[type],
        timestamp: Date.now()
    });

    if (type === 'heal') {
        let newHp = Math.min(MAX_HP, players[myPlayerId].hp + 50);
        update(ref(db, `game/players/${myPlayerId}`), { hp: newHp });
    } else if (type === 'speed') { buffs.speedTime = 5; }
    else if (type === 'rapid') { buffs.rapidTime = 5; }
    else if (type === 'shield') { buffs.shieldTime = 5; }
    else if (type === 'shotgun') { buffs.shotgunTime = 8; }
    else if (type === 'laser') { buffs.laserTime = 6; }
}

function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text, x, y, life: 1.0, color });
}

function spawnParticle(x, y, color, life, size) {
    if (!clientSettings.vfx) return;
    particles.push({ x, y, color, life, maxLife: life, size });
}

function generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function fireBullet(x, y, angle) {
    if (clientSettings.vfx) {
        spawnParticle(x + Math.cos(angle)*(PLAYER_RADIUS), y + Math.sin(angle)*(PLAYER_RADIUS), '#fff', 0.1, 8);
    }
    if (buffs.shotgunTime > 0) {
        playSound('hit');
        for (let i = -1; i <= 1; i++) {
            let a = angle + (i * 0.25);
            let b = {
                id: generateId(),
                x: x + Math.cos(a) * (PLAYER_RADIUS + 5),
                y: y + Math.sin(a) * (PLAYER_RADIUS + 5),
                vx: Math.cos(a) * BULLET_SPEED * 0.9,
                vy: Math.sin(a) * BULLET_SPEED * 0.9,
                owner: myPlayerId,
                dmg: BULLET_DMG * 0.8
            };
            localBullets.push({ ...b, color: COLORS[myPlayerId] });
            push(bulletsRef, b);
        }
    } else if (buffs.laserTime > 0) {
        playSound('item');
        let b = {
            id: generateId(),
            x: x + Math.cos(angle) * (PLAYER_RADIUS + 5),
            y: y + Math.sin(angle) * (PLAYER_RADIUS + 5),
            vx: Math.cos(angle) * BULLET_SPEED * 2,
            vy: Math.sin(angle) * BULLET_SPEED * 2,
            owner: myPlayerId,
            dmg: BULLET_DMG * 1.5,
            pierce: true
        };
        localBullets.push({ ...b, color: COLORS[myPlayerId] });
        push(bulletsRef, b);
    } else {
        playSound('shoot');
        let b = {
            id: generateId(),
            x: x + Math.cos(angle) * (PLAYER_RADIUS + 5),
            y: y + Math.sin(angle) * (PLAYER_RADIUS + 5),
            vx: Math.cos(angle) * BULLET_SPEED,
            vy: Math.sin(angle) * BULLET_SPEED,
            owner: myPlayerId,
            dmg: BULLET_DMG
        };
        localBullets.push({ ...b, color: COLORS[myPlayerId] });
        push(bulletsRef, b);
    }
}

function takeDamage(amount, killerId, targetId = myPlayerId) {
    if (players[targetId].spawnProtectTime && Date.now() < players[targetId].spawnProtectTime) return; // Invincible
    
    playSound('hit');
    let targetHasShield = (targetId === myPlayerId) ? (buffs.shieldTime > 0) : (players[targetId].hasShield);
    if (targetHasShield) {
        amount *= 0.4; // Shield reduces damage
    }
    
    if (clientSettings.dmg && players[targetId]) {
        addFloatingText(`-${Math.round(amount)}`, players[targetId].x, players[targetId].y - 25, '#ff2d55');
    }
    
    if (killerId === myPlayerId && clientSettings.crosshair) {
        canvas.classList.add('hit-marker');
        setTimeout(() => canvas.classList.remove('hit-marker'), 150);
    }

    let hp = Math.max(0, players[targetId].hp - amount);
    let isAlive = hp > 0;
    
    let updates = { hp, isAlive };
    
    if (!isAlive) {
        updates.respawnTime = Date.now() + 3000; // 3 sec respawn
        updates.lastKillerName = players[killerId] ? players[killerId].name : 'Unknown';
        
        push(ref(db, 'game/events'), {
            type: 'kill',
            killerName: players[killerId] ? players[killerId].name : 'Unknown',
            targetName: players[targetId] ? players[targetId].name : 'Unknown',
            color: COLORS[killerId] || '#fff',
            timestamp: Date.now()
        });

        // Add kill to killer
        runTransaction(ref(db, `game/players/${killerId}/kills`), (kills) => {
            return (kills || 0) + 1;
        });
    }
    
    update(ref(db, `game/players/${targetId}`), updates);
}

function render() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#333';
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

    // Draw Particles
    for (let p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI*2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

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
            if (id === myPlayerId) {
                if (buffs.speedTime > 0) { ctx.shadowColor = ITEM_COLORS.speed; hasAura = true; }
                else if (buffs.rapidTime > 0) { ctx.shadowColor = ITEM_COLORS.rapid; hasAura = true; }
                else if (buffs.shieldTime > 0) { ctx.shadowColor = ITEM_COLORS.shield; hasAura = true; }
                else if (buffs.shotgunTime > 0) { ctx.shadowColor = ITEM_COLORS.shotgun; hasAura = true; }
                else if (buffs.laserTime > 0) { ctx.shadowColor = ITEM_COLORS.laser; hasAura = true; }
            }
            if (!hasAura) ctx.shadowColor = COLORS[id];
            
            // Spawn Protection Blink
            let isSpawnProtected = (p.spawnProtectTime && Date.now() < p.spawnProtectTime);
            if (isSpawnProtected) {
                ctx.globalAlpha = (Math.floor(Date.now() / 150) % 2 === 0) ? 0.3 : 0.8;
                ctx.shadowColor = '#fff';
            }
            
            ctx.fillStyle = COLORS[id];
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            
            ctx.rotate(-p.angle);
            
            if (id === myPlayerId) {
                // Dash CD
                if (dashState.cooldown > 0) {
                    let cdPercent = 1 - (dashState.cooldown / 2.0);
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + (cdPercent * 0.5)})`;
                    ctx.fillRect(-PLAYER_RADIUS, PLAYER_RADIUS + 10, (PLAYER_RADIUS*2) * cdPercent, 4);
                } else {
                    ctx.fillStyle = '#00e5ff';
                    ctx.fillRect(-PLAYER_RADIUS, PLAYER_RADIUS + 10, PLAYER_RADIUS*2, 4);
                }

                // Buff UI
                let activeBuffs = [];
                if (buffs.speedTime > 0) activeBuffs.push({icon: '⚡', time: buffs.speedTime, max: 5, color: ITEM_COLORS.speed});
                if (buffs.rapidTime > 0) activeBuffs.push({icon: '🔫', time: buffs.rapidTime, max: 5, color: ITEM_COLORS.rapid});
                if (buffs.shieldTime > 0) activeBuffs.push({icon: '🛡️', time: buffs.shieldTime, max: 5, color: ITEM_COLORS.shield});
                if (buffs.shotgunTime > 0) activeBuffs.push({icon: '💥', time: buffs.shotgunTime, max: 8, color: ITEM_COLORS.shotgun});
                if (buffs.laserTime > 0) activeBuffs.push({icon: '✨', time: buffs.laserTime, max: 6, color: ITEM_COLORS.laser});
                
                activeBuffs.forEach((b, idx) => {
                    let offsetY = PLAYER_RADIUS + 18 + (idx * 8);
                    ctx.fillStyle = b.color;
                    ctx.fillRect(-PLAYER_RADIUS, offsetY, (PLAYER_RADIUS*2) * (b.time / b.max), 3);
                    ctx.font = '10px sans-serif';
                    ctx.fillText(b.icon, -PLAYER_RADIUS - 10, offsetY + 2);
                });
            }

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
                
                if (id === myPlayerId && p.lastKillerName) {
                    ctx.fillStyle = '#ff2d55';
                    ctx.font = 'bold 16px Orbitron';
                    ctx.textAlign = 'center';
                    ctx.fillText(`KILLED BY ${p.lastKillerName.toUpperCase()}`, 0, -30);
                }
                
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
    ctx.shadowBlur = 0;

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
        
        if (winner.name === myPlayerName && !isTestMode) {
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

// --- AUDIO SYSTEM ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain).connect(audioCtx.destination);
    
    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
    } else if (type === 'item') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(1200, t + 0.15);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
    }
}

restartBtn.addEventListener('click', () => {
    set(playersRef, null);
    set(stateRef, 'waiting');
    set(bulletsRef, null);
    set(itemsRef, null);
    location.reload();
});
