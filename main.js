import * as THREE from 'three';
import { Player } from './player.js';
import { Level } from './level.js';
import { Enemy } from './enemy.js';
import { UI } from './ui.js';
import { LootSystem } from './loot.js';
import { RelicSystem } from './relics.js';
import { Shop } from './shop.js';
import { Dialog } from './dialog.js';

// Game constants
const ROOM_SIZE = 800;

// Create crosshair mesh
let crosshair;

// Game state
let gameState = {
    level: 1,
    killStreak: 0,
    gameOver: false,
    isShopLevel: false,
    currentPickup: null,
    hoveredRelicIndex: -1,
    lastRelicSellTime: 0,  // Add this to track last sell time
    tutorialShown: false,
    isPaused: false, // Add flag to track if game is paused during tutorial
    blood: 0, // Add blood counter
    enemies: [] // Reference to enemies array
};

// Create game object to expose to window
const game = {
    player: null,
    keys: null,
    mouse: null,
    level: null,
    enemies: [],
    gameState: gameState
};

// Expose game object to window for mobile controls
window.game = game;

// Initialize Three.js
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x228B22); // Jungle green background

// Create camera with slightly larger view to include walls
const CAMERA_PADDING = 80; // Extra padding to view walls
const camera = new THREE.OrthographicCamera(
    (ROOM_SIZE + CAMERA_PADDING) / -2, 
    (ROOM_SIZE + CAMERA_PADDING) / 2, 
    (ROOM_SIZE + CAMERA_PADDING) / 2, 
    (ROOM_SIZE + CAMERA_PADDING) / -2, 
    0.1, 1000
);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Handle window resize
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Update camera aspect ratio and projection matrix if needed
    // This is simplified for an orthographic camera
});

// Input tracking
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    e: false,
    r: false,
    wasE: false,
    wasR: false
};

// Store keys in game object
game.keys = keys;

const mouse = {
    x: 0,
    y: 0,
    isDown: false
};

// Store mouse in game object
game.mouse = mouse;

// Make sellRelic function globally accessible
window.sellRelic = function(index) {
    if (player && player.relics[index]) {
        // Check if relic can be sold
        if (relicSystem.canSellRelic(player, player.relics[index])) {
            // Remove the relic and add HP
            if (relicSystem.sellRelic(player, index)) {
                player.hp = Math.min(player.maxHp, player.hp + 1);
                ui.updateStats(player, gameState);
                ui.showMessage("Relic sold for 1 HP!");
                
                // Reset hovered relic
                gameState.hoveredRelicIndex = -1;
            }
        } else {
            // Show message if relic can't be sold yet
            ui.showMessage("This relic cannot be sold yet!");
        }
    }
};

// Initialize game objects
let player;
let currentLevel;
let ui;
let enemies = [];
let lootSystem;
let relicSystem;
let shop;
let dialog;
let lastTime = 0; // For deltaTime calculation

function startGame() {
    init();
    animate();
}

// Make startGame globally accessible
window.startGame = startGame;

function init() {
    // Reset game state
    gameState = {
        level: 1,
        killStreak: 0,
        gameOver: false,
        isShopLevel: false,
        currentPickup: null,
        hoveredRelicIndex: -1,
        lastRelicSellTime: 0,
        tutorialShown: false,
        isPaused: false,
        blood: 0, // Initialize blood counter
        enemies: [] // Reference to enemies array
    };
    
    // Clear previous game objects
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }
    
    enemies = [];
    
    // Create crosshair
    createCrosshair();
    
    // Initialize systems
    relicSystem = new RelicSystem();
    lootSystem = new LootSystem(scene);
    
    // Initialize level first so we know where the hatch is
    currentLevel = new Level(scene, ROOM_SIZE, gameState.level);
    
    // Initialize player
    player = new Player(scene);
    
    // Store player in game object for mobile controls
    game.player = player;
    
    // Position player at the hatch in the lower right corner
    player.mesh.position.x = ROOM_SIZE/2 - 80;
    player.mesh.position.y = -ROOM_SIZE/2 + 80;
    
    // Update shadow position if it exists
    if (player.shadow) {
        player.shadow.position.x = player.mesh.position.x + 12;
        player.shadow.position.y = player.mesh.position.y + 12;
    }
    
    // Make gameState globally accessible for relic effects
    window.gameState = gameState;
    
    // Reset UI elements instead of recreating them 
    if (ui) {
        ui.resetUIElements();
        ui.updateRequiredBlood(currentLevel.bloodRequired);
    } else {
        // Initialize UI after player is created if it doesn't exist
        ui = new UI();
        ui.updateRequiredBlood(currentLevel.bloodRequired);
    }
    
    // Show tutorial before spawning enemies
    if (!gameState.tutorialShown) {
        showControlsTutorial();
    }
    
    // Always start with a combat level (level 1)
    // Spawn enemies for the current level
    spawnEnemies();
    
    // Show level message and update UI after everything is initialized
    ui.showLevelMessage(gameState.level);
    ui.updateStats(player, gameState);
}

function spawnEnemies() {
    // For the first level, only spawn two basic enemies
    if (gameState.level === 1) {
        // Create exactly two basic enemies, far from the player
        const enemy1 = new Enemy(scene, -300, -300, 0, gameState.level); // Basic enemy type (0) in bottom left
        const enemy2 = new Enemy(scene, 300, 300, 0, gameState.level); // Basic enemy type (0) in top right
        
        enemies.push(enemy1);
        enemies.push(enemy2);
    } else if (gameState.level === 3) { // Second battle level
        console.log("Spawning enemies for battle level 2 (level 3)");
        
        // Level 3 gets exactly 4 specific enemies
        const enemySetup = [
            { type: 1, name: 'shooter' },    // Type 1: Shooter
            { type: 4, name: 'charger' },    // Type 4: Charger
            { type: 2, name: 'fast' },       // Type 2: Fast Enemy
            { type: 3, name: 'bomber' }      // Type 3: Bomber
        ];
        
        // Calculate hatch position
        const hatchX = ROOM_SIZE/2 - 80;
        const hatchY = -ROOM_SIZE/2 + 80;
        
        // Spawn each enemy at least 350 units from the hatch
        enemySetup.forEach((setup, index) => {
            let x, y;
            do {
                x = Math.random() * (ROOM_SIZE - 100) - (ROOM_SIZE / 2 - 50);
                y = Math.random() * (ROOM_SIZE - 100) - (ROOM_SIZE / 2 - 50);
                
                // Calculate distance to hatch
                const distanceToHatch = Math.sqrt(
                    Math.pow(x - hatchX, 2) + 
                    Math.pow(y - hatchY, 2)
                );
                
                // Keep trying until we find a position far enough from the hatch
            } while (Math.sqrt(Math.pow(x - hatchX, 2) + Math.pow(y - hatchY, 2)) < 350);
            
            console.log(`Creating enemy ${index}: type=${setup.type} (${setup.name}) at position (${x}, ${y})`);
            const enemy = new Enemy(scene, x, y, setup.type, gameState.level);
            enemies.push(enemy);
            console.log(`Enemy created with actual type: ${enemy.type}`);
        });
        
        console.log(`Total enemies spawned for level 3: ${enemies.length}`);
    } else if (gameState.level === 5) { // Third battle level
        // Spawn 7 random enemies
        const numEnemies = 7;
        spawnRandomEnemies(numEnemies);
    } else { // Fourth battle level and beyond
        // Spawn 10 random enemies (maximum)
        const numEnemies = 10;
        spawnRandomEnemies(numEnemies);
    }
}

// Helper function to spawn random enemies
function spawnRandomEnemies(count) {
    // Calculate hatch position
    const hatchX = ROOM_SIZE/2 - 80;
    const hatchY = -ROOM_SIZE/2 + 80;
    
    for (let i = 0; i < count; i++) {
        // Random position away from player spawn, hatch, and statue
        let x, y;
        do {
            x = Math.random() * (ROOM_SIZE - 100) - (ROOM_SIZE / 2 - 50);
            y = Math.random() * (ROOM_SIZE - 100) - (ROOM_SIZE / 2 - 50);
            
            // Calculate distance to hatch
            const distanceToHatch = Math.sqrt(
                Math.pow(x - hatchX, 2) + 
                Math.pow(y - hatchY, 2)
            );
            
            // Calculate distance to statue (center of room)
            const distanceToStatue = Math.sqrt(x * x + y * y);
            
            // Keep trying until we find a position far enough from both hatch and statue
        } while (distanceToHatch < 350 || distanceToStatue < 150);
        
        // Random enemy type based on level
        let enemyType;
        if (gameState.level <= 2) {
            enemyType = 0; // Only basic enemies
        } else if (gameState.level <= 4) {
            enemyType = Math.random() < 0.7 ? 0 : 1; // 70% basic, 30% shooter
        } else if (gameState.level <= 6) {
            enemyType = Math.floor(Math.random() * 3); // Basic, shooter, or fast
        } else {
            enemyType = Math.floor(Math.random() * 4); // All types except nest
        }
        
        const enemy = new Enemy(scene, x, y, enemyType, gameState.level);
        enemies.push(enemy);
    }
}

function createShopLevel() {
    // Set shop level flag
    gameState.isShopLevel = true;
    
    // Create shop with current level number
    shop = new Shop(scene, gameState.level);
    
    // Activate portal immediately in the lower right corner (use default position)
    currentLevel.activatePortal();
}

function nextLevel() {
    // Clean up current level
    currentLevel.cleanup();
    
    // Clean up shop if it exists
    if (gameState.isShopLevel && shop) {
        shop.cleanup();
    }
    
    // Clean up loot
    lootSystem.cleanup();
    
    // Clean up tutorial message if moving from level 1
    if (gameState.level === 1) {
        const tutorialElement = document.getElementById('controls-tutorial');
        if (tutorialElement) {
            tutorialElement.remove();
        }
    }
    
    // Reset blood to zero when moving to a new level (since blood boost triggers on room clear)
    gameState.blood = 0;
    
    // Increment level
    gameState.level++;
    
    // Apply relic effects on room change
    relicSystem.onRoomChange(player);
    
    // Alternate between combat and shop levels (even levels are shops)
    if (gameState.level % 2 === 0) {
        // Create shop level
        gameState.isShopLevel = true;
        
        // Create new level
        currentLevel = new Level(scene, ROOM_SIZE, gameState.level);
        
        // Position player at the hatch
        player.mesh.position.x = ROOM_SIZE/2 - 80;
        player.mesh.position.y = -ROOM_SIZE/2 + 80;
        
        // Update shadow position
        if (player.shadow) {
            player.shadow.position.x = player.mesh.position.x + 12;
            player.shadow.position.y = player.mesh.position.y + 12;
        }
        
        // Create shop
        shop = new Shop(scene, gameState.level);
        
        // Activate portal immediately and position it next to the shop
        currentLevel.activatePortal(200, 0);
    } else {
        // Create normal level
        gameState.isShopLevel = false;
        
        // Create new level
        currentLevel = new Level(scene, ROOM_SIZE, gameState.level);
        
        // Display the required blood amount
        ui.updateRequiredBlood(currentLevel.bloodRequired);
        
        // Position player at the hatch
        player.mesh.position.x = ROOM_SIZE/2 - 80;
        player.mesh.position.y = -ROOM_SIZE/2 + 80;
        
        // Update shadow position
        if (player.shadow) {
            player.shadow.position.x = player.mesh.position.x + 12;
            player.shadow.position.y = player.mesh.position.y + 12;
        }
        
        // Spawn enemies
        enemies = [];
        spawnEnemies();
    }
    
    // Reset UI blood displays
    ui.resetUIElements();
    
    // Update required blood display
    if (!gameState.isShopLevel) {
        ui.updateRequiredBlood(currentLevel.bloodRequired);
    }
    
    // Show level message
    ui.showLevelMessage(gameState.level);
    ui.updateStats(player, gameState);
}

function checkGameOver() {
    if (player.hp <= 0) {
        endGame("You ran out of health!");
    } else if (player.ammo <= 0 && enemies.length > 0) {
        endGame("You ran out of ammo with enemies still remaining!");
    }
}

function endGame(reason) {
    gameState.gameOver = true;
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('game-over-reason').textContent = reason;
}

function updateUI() {
    // Use the complete UI update method that includes weapon stats
    ui.updateStats(player, gameState, enemies);
}

function animate() {
    requestAnimationFrame(animate);
    
    // Keep enemies reference updated in gameState for use by other components
    gameState.enemies = enemies;
    
    // Update the enemies reference in the game object for auto-aim
    game.enemies = enemies;
    
    if (!gameState.gameOver) {
        // Only update player and enemies if game is not paused
        if (!gameState.isPaused) {
            // Calculate delta time for animations
            const currentTime = performance.now();
            const deltaTime = currentTime - (lastTime || currentTime);
            lastTime = currentTime;
            
            // Store player's previous position for collision rollback
            const prevPlayerPosX = player.mesh.position.x;
            const prevPlayerPosY = player.mesh.position.y;
            
            // Update player
            player.update(keys, mouse, enemies);
            
            // Check tomb/wall collisions for player
            if (currentLevel.checkTombCollision(player)) {
                // Collision occurred, revert player position
                player.mesh.position.x = prevPlayerPosX;
                player.mesh.position.y = prevPlayerPosY;
                
                // Update shadow position
                if (player.shadow) {
                    player.shadow.position.x = prevPlayerPosX + 12;
                    player.shadow.position.y = prevPlayerPosY + 12;
                }
            }
            
            // Check exact wall collision
            const wallCollision = currentLevel.checkWallCollision(player);
            if (wallCollision) {
                // Handle collision based on which wall was hit
                if (wallCollision.axis === 'x') {
                    // X-axis collision (left/right walls)
                    player.mesh.position.x = prevPlayerPosX;
                    if (player.shadow) player.shadow.position.x = prevPlayerPosX + 12;
                } else if (wallCollision.axis === 'y') {
                    // Y-axis collision (top/bottom walls)
                    player.mesh.position.y = prevPlayerPosY;
                    if (player.shadow) player.shadow.position.y = prevPlayerPosY + 12;
                }
            }
            
            if (!gameState.isShopLevel) {
                // Update enemies
                for (let i = enemies.length - 1; i >= 0; i--) {
                    // Store enemy's position before updates
                    const prevEnemyPosX = enemies[i].mesh.position.x;
                    const prevEnemyPosY = enemies[i].mesh.position.y;
                    
                    enemies[i].update(player);
                    
                    // Check if the nest has spawned a new enemy
                    if (enemies[i].type === 5 && enemies[i].newSpawnedEnemy) {
                        // Add the newly spawned enemy to the main enemies array
                        enemies.push(enemies[i].newSpawnedEnemy);
                        // Reset the newSpawnedEnemy property
                        enemies[i].newSpawnedEnemy = null;
                    }
                    
                    // Check for tomb collision for enemies too
                    if (currentLevel.checkTombCollision(enemies[i])) {
                        // Collision occurred, revert enemy position
                        enemies[i].mesh.position.x = prevEnemyPosX;
                        enemies[i].mesh.position.y = prevEnemyPosY;
                        
                        // Update shadow position if it exists
                        if (enemies[i].shadow) {
                            enemies[i].shadow.position.x = prevEnemyPosX + 12;
                            enemies[i].shadow.position.y = prevEnemyPosY + 12;
                        }
                    }
                    
                    // Also check wall collision for enemies
                    const enemyWallCollision = currentLevel.checkWallCollision(enemies[i]);
                    if (enemyWallCollision) {
                        // Revert enemy position based on collision axis
                        if (enemyWallCollision.axis === 'x') {
                            enemies[i].mesh.position.x = prevEnemyPosX;
                            if (enemies[i].shadow) enemies[i].shadow.position.x = prevEnemyPosX + 12;
                        } else if (enemyWallCollision.axis === 'y') {
                            enemies[i].mesh.position.y = prevEnemyPosY;
                            if (enemies[i].shadow) enemies[i].shadow.position.y = prevEnemyPosY + 12;
                        }
                    }
                    
                    // Check if enemy is dead
                    if (enemies[i].hp <= 0) {
                        // Generate loot drop (including blood)
                        const dropX = enemies[i].mesh.position.x;
                        const dropY = enemies[i].mesh.position.y;
                        lootSystem.generateDrop(dropX, dropY);
                        
                        // Remove enemy
                        enemies[i].cleanup();
                        enemies.splice(i, 1);
                        
                        // Increment kill streak
                        gameState.killStreak++;

                        // If this was the last enemy and player has Blood Amplifier, add blood
                        if (enemies.length === 0) {
                            const bloodAmplifier = player.relics.find(r => r.id === 'bloodAmplifier');
                            if (bloodAmplifier) {
                                gameState.blood += 20;
                            }
                        }
                    }
                }
                
                // Update blood drops animation
                lootSystem.updateBloodDrops();
                
                // Check for blood pickups
                lootSystem.checkBloodPickup(player);
                
                // Check if all enemies are defeated - activate tomb but don't open portal automatically
                if (enemies.length === 0 && !currentLevel.tombActive) {
                    currentLevel.activateTomb();
                }
                
                // Update tomb glow effect
                currentLevel.updateTombGlow(deltaTime);
                
                // Check for blood offering at tomb
                currentLevel.checkBloodOffering(player, gameState, ui);
                
                // Check for portal collision
                if (currentLevel.portalActive && currentLevel.checkPortalCollision(player)) {
                    nextLevel();
                }
                
                // Check for item pickups
                gameState.currentPickup = lootSystem.checkPickup(player, ui);
                
                // Handle pickup button (E key)
                if (keys.e && gameState.currentPickup) {
                    const result = lootSystem.pickupDrop(player, gameState.currentPickup, gameState);
                    
                    if (result) {
                        // Show pickup message
                        console.log(result.message);
                        
                        // Hide popup
                        ui.hidePopup();
                        
                        // Reset pickup
                        gameState.currentPickup = null;
                        
                        // Update UI with new weapon stats
                        ui.updateStats(player, gameState);
                    }
                }
                
            } else {
                // Shop level logic
                // Check for shop item interaction
                const shopItem = shop.checkItemInteraction(player, mouse.x, mouse.y, gameState);
                
                if (shopItem) {
                    // Show item popup
                    ui.showItemPopup(shopItem, mouse.x, mouse.y);
                    
                    // Handle purchase with E key
                    if (keys.e && !keys.wasE) {
                        const result = shop.buyItem(player, shopItem, gameState);
                        
                        if (result) {
                            // Show purchase message
                            ui.showMessage(result.message);
                            
                            // Update UI
                            ui.updateStats(player, gameState);
                        }
                    }
                } else {
                    ui.hidePopup();
                }
                
                // Check for portal collision
                if (currentLevel.portalActive && currentLevel.checkPortalCollision(player)) {
                    nextLevel();
                }
            }
            
            // Track previous mouse state
            mouse.wasDown = mouse.isDown;
            
            // Check game over conditions
            checkGameOver();
        }
        
        // Update UI regardless of pause state
        updateUI();
    }
    
    // Update crosshair position to follow mouse
    if (crosshair) {
        crosshair.position.x = mouse.x;
        crosshair.position.y = mouse.y;
    }
    
    renderer.render(scene, camera);
}

// Event listeners for keyboard
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = true;
    }
    
    // Handle relic selling
    if ((e.key === 'r' || e.key === 'R') && gameState.hoveredRelicIndex >= 0) {
        const currentTime = Date.now();
        // Add 500ms cooldown between sells
        if (currentTime - gameState.lastRelicSellTime > 500) {
            // Use the window.sellRelic function which properly handles onUnequip
            window.sellRelic(gameState.hoveredRelicIndex);
                gameState.lastRelicSellTime = currentTime;
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = false;
    }
    // Track previous key states
    if (e.key.toLowerCase() === 'e') {
        keys.wasE = false;
    }
    if (e.key.toLowerCase() === 'r') {
        keys.wasR = false;
    }
});

// Event listeners for mouse
window.addEventListener('mousemove', (e) => {
    // Convert mouse position to scene coordinates
    mouse.x = (e.clientX / window.innerWidth) * ROOM_SIZE - ROOM_SIZE / 2;
    mouse.y = -(e.clientY / window.innerHeight) * ROOM_SIZE + ROOM_SIZE / 2;
});

window.addEventListener('mousedown', () => {
    mouse.isDown = true;
});

window.addEventListener('mouseup', () => {
    mouse.isDown = false;
});

window.addEventListener('mouseout', () => {
    // Show cursor when mouse leaves the game window
    renderer.domElement.style.cursor = 'default';
    if (crosshair) crosshair.visible = false;
});

window.addEventListener('mouseover', () => {
    // Hide cursor when mouse enters the game window
    renderer.domElement.style.cursor = 'none';
    if (crosshair) crosshair.visible = true;
});

// Restart button event listener
document.getElementById('restart-button').addEventListener('click', () => {
    document.getElementById('game-over').style.display = 'none';
    restartGame();
});

// Function to restart game from level 3 (second battle level)
function restartGame() {
    // Reset game state but start at level 3 (to skip tutorial and first shop)
    gameState = {
        level: 3, // Start at level 3 (second battle level)
        killStreak: 0,
        gameOver: false,
        isShopLevel: false,
        currentPickup: null,
        hoveredRelicIndex: -1,
        lastRelicSellTime: 0,
        tutorialShown: true,
        isPaused: false,
        blood: 0,
        enemies: []
    };
    
    // Clear previous game objects
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }
    
    enemies = [];
    
    // Create crosshair
    createCrosshair();
    
    // Initialize systems
    relicSystem = new RelicSystem();
    lootSystem = new LootSystem(scene);
    
    // Initialize level first
    currentLevel = new Level(scene, ROOM_SIZE, gameState.level);
    
    // Initialize player
    player = new Player(scene);
    
    // Position player at the hatch in the lower right corner
    player.mesh.position.x = ROOM_SIZE/2 - 80;
    player.mesh.position.y = -ROOM_SIZE/2 + 80;
    
    // Update shadow position if it exists
    if (player.shadow) {
        player.shadow.position.x = player.mesh.position.x + 12;
        player.shadow.position.y = player.mesh.position.y + 12;
    }
    
    // Make gameState globally accessible for relic effects
    window.gameState = gameState;
    
    // Reset UI elements instead of recreating them
    if (ui) {
        ui.resetUIElements();
        ui.updateRequiredBlood(currentLevel.bloodRequired);
    } else {
        // Initialize UI after player is created if it doesn't exist
        ui = new UI();
        ui.updateRequiredBlood(currentLevel.bloodRequired);
    }
    
    // Spawn enemies for level 3 (second battle level)
    spawnEnemies();
    
    // Show level message and update UI after everything is initialized
    ui.showLevelMessage(gameState.level);
    ui.updateStats(player, gameState);
}

// Initialize and start the game
dialog = new Dialog();
dialog.show();

// Display controls tutorial message on first level
function showControlsTutorial() {
    // Pause the game while tutorial is showing
    gameState.isPaused = true;
    
    // Create a full-screen overlay
    const tutorialOverlay = document.createElement('div');
    tutorialOverlay.id = 'controls-tutorial';
    tutorialOverlay.style.position = 'absolute';
    tutorialOverlay.style.top = '0';
    tutorialOverlay.style.left = '0';
    tutorialOverlay.style.width = '100%';
    tutorialOverlay.style.height = '100%';
    tutorialOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    tutorialOverlay.style.color = 'white';
    tutorialOverlay.style.fontFamily = 'monospace, sans-serif';
    tutorialOverlay.style.fontSize = '24px';
    tutorialOverlay.style.display = 'flex';
    tutorialOverlay.style.flexDirection = 'column';
    tutorialOverlay.style.justifyContent = 'center';
    tutorialOverlay.style.alignItems = 'center';
    tutorialOverlay.style.zIndex = '1000';
    
    // Create text containers
    const line1 = document.createElement('div');
    line1.style.marginBottom = '20px';
    line1.style.height = '30px';
    
    const line2 = document.createElement('div');
    line2.style.marginBottom = '20px';
    line2.style.height = '30px';
    line2.style.display = 'none'; // Initially hidden
    
    const line3 = document.createElement('div');
    line3.style.marginBottom = '20px';
    line3.style.height = '30px';
    line3.style.display = 'none'; // Initially hidden
    
    // Create next button 
    const createNextButton = () => {
        const nextButton = document.createElement('button');
        nextButton.textContent = "NEXT";
        nextButton.style.padding = '10px 20px';
        nextButton.style.fontSize = '20px';
        nextButton.style.backgroundColor = '#800000'; // Dark red
        nextButton.style.color = 'white';
        nextButton.style.border = '2px solid #ff0000';
        nextButton.style.borderRadius = '5px';
        nextButton.style.cursor = 'pointer';
        nextButton.style.fontFamily = 'monospace, sans-serif';
        nextButton.style.marginTop = '20px';
    
        // Button hover effect
        nextButton.addEventListener('mouseover', () => {
            nextButton.style.backgroundColor = '#ff0000';
        });
        nextButton.addEventListener('mouseout', () => {
            nextButton.style.backgroundColor = '#800000';
        });
        
        return nextButton;
    };
    
    // Create Start button
    const startButton = document.createElement('button');
    startButton.textContent = "START";
    startButton.style.padding = '10px 20px';
    startButton.style.fontSize = '20px';
    startButton.style.backgroundColor = '#800000';
    startButton.style.color = 'white';
    startButton.style.border = '2px solid #ff0000';
    startButton.style.borderRadius = '5px';
    startButton.style.cursor = 'pointer';
    startButton.style.fontFamily = 'monospace, sans-serif';
    startButton.style.marginTop = '20px';
    startButton.style.display = 'none';
    
    startButton.addEventListener('mouseover', () => {
        startButton.style.backgroundColor = '#ff0000';
    });
    startButton.addEventListener('mouseout', () => {
        startButton.style.backgroundColor = '#800000';
    });
    
    // Start button click handler
    startButton.addEventListener('click', () => {
        tutorialOverlay.style.transition = 'opacity 0.5s';
        tutorialOverlay.style.opacity = '0';
        setTimeout(() => {
            tutorialOverlay.remove();
            gameState.isPaused = false;
        }, 500);
    });
    
    // Next buttons for each line
    const nextButton1 = createNextButton();
    const nextButton2 = createNextButton();
    
    // Add all elements to the overlay
    tutorialOverlay.appendChild(line1);
    tutorialOverlay.appendChild(nextButton1);
    tutorialOverlay.appendChild(line2);
    tutorialOverlay.appendChild(nextButton2);
    tutorialOverlay.appendChild(line3);
    tutorialOverlay.appendChild(startButton);
    
    document.body.appendChild(tutorialOverlay);
    
    // Define text for each line
    const text1 = "Kill demons and collect their blood before it DISAPPEARS";
    const text2 = "Gather the required amount of blood each level and bring it to the altar statue to progress";
    const text3 = "Use WASD to move around. Point and click to shoot. Good luck, you'll need it";
    
    // Initially hide all buttons
    nextButton1.style.display = 'none';
    nextButton2.style.display = 'none';
    
    // Button click handlers
    nextButton1.addEventListener('click', () => {
        nextButton1.style.display = 'none';
        line2.style.display = 'block';
        typeOutText(line2, text2, () => {
            nextButton2.style.display = 'block';
        });
    });
    
    nextButton2.addEventListener('click', () => {
        nextButton2.style.display = 'none';
        line3.style.display = 'block';
        typeOutText(line3, text3, () => {
            startButton.style.display = 'block';
        });
    });
    
    // Function to type out text with a blinking effect
    function typeOutText(element, text, onComplete) {
        let index = 0;
        
        // Create a span for the text
        const textSpan = document.createElement('span');
        element.appendChild(textSpan);
        
        // If this is line 1, handle the "DISAPPEARS" in red
        if (text === text1) {
            const interval = setInterval(() => {
                if (index < text.length) {
                    // Check if we're at "DISAPPEARS"
                    if (index === text.indexOf("DISAPPEARS")) {
                        // Add the red text
                        const redText = document.createElement('span');
                        redText.style.color = '#ff0000';
                        redText.textContent = "DISAPPEARS";
                        element.appendChild(redText);
                        index += "DISAPPEARS".length;
                    } else {
                        textSpan.textContent += text.charAt(index);
                        index++;
                    }
                } else {
                    clearInterval(interval);
                    if (onComplete) onComplete();
                }
            }, 30);
        } else {
            const interval = setInterval(() => {
                if (index < text.length) {
                    textSpan.textContent += text.charAt(index);
                    index++;
                } else {
                    clearInterval(interval);
                    if (onComplete) onComplete();
                }
            }, 30);
        }
    }
    
    // Start typing the first line
    typeOutText(line1, text1, () => {
        nextButton1.style.display = 'block';
    });
    
    // Set flag that tutorial has been shown
    gameState.tutorialShown = true;
}

// Create a crosshair that follows the mouse
function createCrosshair() {
    // Create a group to hold the crosshair elements
    crosshair = new THREE.Group();
    
    // Create crosshair lines
    const lineThickness = 2;
    const lineLength = 12;
    const gapSize = 4;
    
    // Horizontal line (left and right parts)
    const horizontalLeft = new THREE.Mesh(
        new THREE.PlaneGeometry(lineLength, lineThickness),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
    );
    horizontalLeft.position.x = -gapSize - lineLength/2;
    
    const horizontalRight = new THREE.Mesh(
        new THREE.PlaneGeometry(lineLength, lineThickness),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
    );
    horizontalRight.position.x = gapSize + lineLength/2;
    
    // Vertical line (top and bottom parts)
    const verticalTop = new THREE.Mesh(
        new THREE.PlaneGeometry(lineThickness, lineLength),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
    );
    verticalTop.position.y = gapSize + lineLength/2;
    
    const verticalBottom = new THREE.Mesh(
        new THREE.PlaneGeometry(lineThickness, lineLength),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
    );
    verticalBottom.position.y = -gapSize - lineLength/2;
    
    // Center dot
    const centerDot = new THREE.Mesh(
        new THREE.CircleGeometry(2, 8),
        new THREE.MeshBasicMaterial({ color: 0xFF0000 })
    );
    
    // Add all parts to the crosshair group
    crosshair.add(horizontalLeft);
    crosshair.add(horizontalRight);
    crosshair.add(verticalTop);
    crosshair.add(verticalBottom);
    crosshair.add(centerDot);
    
    // Set crosshair position in front of everything
    crosshair.position.z = 5;
    
    // Add to scene
    scene.add(crosshair);
    
    // Only hide cursor on the canvas, not the entire page
    renderer.domElement.style.cursor = 'none';
}

// Start the game when DOM is loaded
document.addEventListener('DOMContentLoaded', startGame);

// Export game object for mobile controls
export { game };