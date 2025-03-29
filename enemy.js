import * as THREE from 'three';

export class Enemy {
    constructor(scene, x, y, type = 0, level = 1) {
        this.scene = scene;
        this.type = type; // Store the original type
        this.level = level;
        
        console.log(`Enemy constructor called with type=${type}, level=${level}`);
        
        // Detect if on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        const mobileSpeedMultiplier = isMobile ? 0.75 : 1; // 1.33x slower on mobile (0.75 = 3/4)
        
        console.log(`Mobile detected: ${isMobile}, using speed multiplier: ${mobileSpeedMultiplier}`);
        
        // Set properties based on enemy type
        switch(type) {
            case 0: // Basic enemy (melee)
                this.hp = 8 + (level - 1) * 2; // Base 8 HP + 2 per level
                this.speed = 1.5 * mobileSpeedMultiplier; // 1.33x slower on mobile
                this.damage = 1;
                this.attackRange = 80;
                this.attackCooldown = 1000; // 1 second
                this.lastAttackTime = 0;
                this.behavior = 'chase';
                this.color = 0xFF0000; // Red
                break;
            case 1: // Ranged enemy (shooter)
                this.hp = 5 + (level - 1) * 1; // Base 5 HP + 1 per level
                this.speed = 1.3 * mobileSpeedMultiplier; // Slightly slower, 1.33x slower on mobile
                this.damage = 1;
                this.attackRange = 300;
                this.attackCooldown = 1500; // 1.5 seconds
                this.lastAttackTime = 0;
                this.lastShotTime = 0; // Initialize lastShotTime for shooter
                this.behavior = 'maintain-distance';
                this.bullets = [];
                this.preferredDistance = 250; // Stay this far from player if possible
                this.color = 0x00FF00; // Green
                break;
            case 2: // Fast enemy
                this.hp = 3 + (level - 1) * 1; // Base 3 HP + 1 per level
                this.speed = 2.5 * mobileSpeedMultiplier; // Fast, 1.33x slower on mobile
                this.damage = 1;
                this.attackRange = 80;
                this.attackCooldown = 800; // 0.8 seconds
                this.lastAttackTime = 0;
                this.behavior = 'chase';
                this.color = 0x0000FF; // Blue
                break;
            case 3: // Bomber (explodes when close to player)
                this.hp = 10 + (level - 1) * 3; // Base 10 HP + 3 per level
                this.speed = 1.0 * mobileSpeedMultiplier; // Slow, 1.33x slower on mobile
                this.damage = 3;
                this.attackRange = 100;
                this.attackCooldown = 2000; // 2 seconds
                this.lastAttackTime = 0;
                this.lastShotTime = 0; // Initialize lastShotTime for bomber
                this.behavior = 'suicide';
                this.color = 0xFF8800; // Orange
                this.explosionTriggered = false;
                this.explosionRadius = 150;
                
                // Create explosion mesh for bomber
                const explosionGeometry = new THREE.CircleGeometry(50, 16);
                const explosionMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xFF0000,
                    transparent: true,
                    opacity: 0.7
                });
                this.explosionMesh = new THREE.Mesh(explosionGeometry, explosionMaterial);
                this.explosionMesh.visible = false;
                scene.add(this.explosionMesh);
                this.explosionDamage = 3;
                break;
            case 4: // Charger (moves faster when attacking)
                this.hp = 8 + (level - 1) * 2; // Base 8 HP + 2 per level
                this.normalSpeed = 1.2 * mobileSpeedMultiplier; // Normal speed, 1.33x slower on mobile
                this.chargeSpeed = 3.5 * mobileSpeedMultiplier; // Charge speed, 1.33x slower on mobile
                this.speed = this.normalSpeed; // Start with normal speed
                this.damage = 2;
                this.attackRange = 200; // Longer attack range to start charge
                this.chargeRange = 250; // How far it charges
                this.attackCooldown = 3000; // 3 seconds between charges
                this.lastAttackTime = 0;
                this.lastChargeTime = 0; // Initialize lastChargeTime
                this.behavior = 'charge';
                this.isCharging = false;
                this.chargeTarget = null;
                this.color = 0xFF00FF; // Purple
                break;
            case 5: // Nest (spawns small enemies)
                this.hp = 15 + (level - 1) * 5; // Base 15 HP + 5 per level
                this.speed = 0.5 * mobileSpeedMultiplier; // Very slow, 1.33x slower on mobile
                this.damage = 0; // Doesn't directly damage
                this.attackRange = 0;
                this.spawnCooldown = 5000; // 5 seconds between spawns
                this.lastSpawnTime = 0;
                this.behavior = 'stationary';
                this.color = 0xFFFF00; // Yellow
                this.maxSpawns = 5; // Maximum number of spawns
                this.currentSpawns = 0;
                this.spawnType = 2; // Spawn fast enemies
                this.newSpawnedEnemy = null; // Track newly spawned enemies
                this.spawnedEnemies = []; // Initialize spawnedEnemies array
                break;
            default:
                this.hp = 5;
                this.speed = 1.5 * mobileSpeedMultiplier; // 1.33x slower on mobile
                this.damage = 1;
                this.attackRange = 80;
                this.attackCooldown = 1000;
                this.lastAttackTime = 0;
                this.behavior = 'chase';
                this.color = 0xFF0000;
        }
        
        this.isDead = false; // Flag to track if enemy is dead
        
        // Enemy stats scaling configuration
        const ENABLE_LEVEL_SCALING = false; // Set to true to re-enable level scaling
        const SCALING_FACTOR = 1.1; // How much stats increase per level (10%)
        const levelMultiplier = ENABLE_LEVEL_SCALING ? Math.pow(SCALING_FACTOR, level - 1) : 1;
        
        // Apply level scaling
        this.hp = Math.ceil(this.hp * levelMultiplier);
        this.maxHp = this.hp;
        this.damage = Math.ceil(this.damage * levelMultiplier);
        
        // Create mesh first
        const geometry = new THREE.PlaneGeometry(64, 64);
        const material = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: true
        });
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Load enemy sprite sheet based on type
        let texturePath = 'assets/sprites/basic_monster.png'; // Default
        
        // Set texture path based on enemy type
        switch(this.type) {
            case 1: // Shooter
                texturePath = 'assets/sprites/shooter_enemy.png';
                break;
            case 2: // Fast
                texturePath = 'assets/sprites/flying_enemy.png';
                break;
            case 4: // Charger
                texturePath = 'assets/sprites/ram.png';
                break;
            case 5: // Nest
                texturePath = 'assets/sprites/nest.png';
                break;
            case 6: // Small nest enemy
                texturePath = 'assets/sprites/nest_enemy.png';
                break;
            // Default (types 0 and 3) use basic_monster.png
        }
        
        console.log(`Loading texture for enemy type ${this.type}: ${texturePath}`);
        
        const texture = new THREE.TextureLoader().load(texturePath, 
            // Success callback
            (loadedTexture) => {
                console.log(`Texture loaded successfully for enemy type ${this.type}`);
                this.mesh.material.map = loadedTexture;
                this.mesh.material.needsUpdate = true;
                this.mesh.material.color.setHex(0xFFFFFF); // Reset to white when texture loads
            },
            // Progress callback
            undefined,
            // Error callback
            (error) => {
                console.error(`Error loading texture for enemy type ${this.type}:`, error);
            }
        );
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        
        // Animation setup for basic monster
        this.setupAnimationFrames();
        
        // Position mesh
        this.mesh.position.set(x, y, 1);
        scene.add(this.mesh);
        
        // Create shadow for the enemy
        this.createShadow();
        
        // Create health bar and UI elements
        this.createHealthUI();
        
        // Bullets array for shooter type
        this.bullets = [];
        this.bulletGeometry = new THREE.CircleGeometry(5, 8);
        this.bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        
        // Aggro state
        this.aggroRange = 350 * 0.85; // Reduced by 15%
        this.isAggro = false;
        
        // Add random movement properties
        this.randomMoveTimer = 0;
        this.randomMoveInterval = 3000; // Change direction every 3 seconds
        this.randomDirection = { x: 0, y: 0 };
        this.setNewRandomDirection();
        
        // Add position tracking for unstuck mechanism
        this.lastPositions = [];
        this.positionHistorySize = 30; // Store last 30 positions
        this.lastPositionUpdate = 0;
        this.stuckTime = 0;
        this.isStuck = false;
    }
    
    setupAnimationFrames() {
        this.frameCount = 4;
        this.currentFrame = 0;
        this.frameTime = 0;
        this.animationSpeed = 150;
        
        // Create UV coordinates for each frame
        this.frames = [];
        const frameWidth = 1/4;
        const frameHeight = 1/4;
        
        for (let dir = 0; dir < 4; dir++) {
            for (let frame = 0; frame < 4; frame++) {
                this.frames.push({
                    x: frame * frameWidth,
                    y: dir * frameHeight,
                    width: frameWidth,
                    height: frameHeight
                });
            }
        }
        
        // Set initial UV coordinates
        this.updateUVs(0);
    }
    
    createHealthUI() {
        // Create health bar
        const healthBarWidth = 64;
        const healthBarHeight = 6;
        const healthBarGeometry = new THREE.PlaneGeometry(healthBarWidth, healthBarHeight);
        const healthBarMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        this.healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
        this.healthBar.position.set(0, 48, 0);
        this.mesh.add(this.healthBar);
        
        // Create health bar background
        const healthBarBgGeometry = new THREE.PlaneGeometry(healthBarWidth, healthBarHeight);
        const healthBarBgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.healthBarBg = new THREE.Mesh(healthBarBgGeometry, healthBarBgMaterial);
        this.healthBarBg.position.set(0, 48, -0.1);
        this.mesh.add(this.healthBarBg);
        
        // Create health number display
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.hp}/${this.maxHp} ATK:${this.damage}`, 64, 16);
        
        const texture = new THREE.CanvasTexture(canvas);
        const healthNumberMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });
        const healthNumberGeometry = new THREE.PlaneGeometry(64, 16);
        this.healthNumber = new THREE.Mesh(healthNumberGeometry, healthNumberMaterial);
        this.healthNumber.position.set(0, 56, 0);
        this.mesh.add(this.healthNumber);
        
        // Store canvas context for updates
        this.canvas = canvas;
        this.ctx = ctx;
        
        // Update health bar initially
        this.updateHealthBar();
    }
    
    updateHealthBar() {
        const healthPercent = this.hp / this.maxHp;
        this.healthBar.scale.x = Math.max(0, healthPercent);
        this.healthBar.position.x = -32 * (1 - healthPercent);

        // Update health and attack number
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${this.hp}/${this.maxHp} ATK:${this.damage}`, 64, 16);
        this.healthNumber.material.map.needsUpdate = true;
    }
    
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.isDead = true; // Mark as dead
        }
        this.updateHealthBar();
    }
    
    cleanup() {
        // Remove bullets
        for (const bullet of this.bullets) {
            this.scene.remove(bullet.mesh);
        }
        this.bullets = [];
        
        // Remove shadow
        if (this.shadow) {
            this.scene.remove(this.shadow);
        }
        
        // Remove enemy mesh (which will also remove health bar, background, and text)
        this.scene.remove(this.mesh);
    }
    
    updateUVs(frameIndex) {
        const frame = this.frames[frameIndex];
        const uvs = this.mesh.geometry.attributes.uv;
        const uvArray = [
            frame.x, frame.y + frame.height,
            frame.x + frame.width, frame.y + frame.height,
            frame.x, frame.y,
            frame.x + frame.width, frame.y
        ];
        uvs.set(uvArray);
        uvs.needsUpdate = true;
        
        // Update shadow UVs to match the current frame if shadow exists
        if (this.shadow && this.shadow.geometry.attributes.uv) {
            const shadowUvs = this.shadow.geometry.attributes.uv;
            shadowUvs.set(uvArray);
            shadowUvs.needsUpdate = true;
        }
    }

    getDirectionFrame(dx, dy) {
        // Calculate angle to player
        const angle = Math.atan2(dy, dx);
        
        // Convert angle to direction index (0: down, 1: left, 2: right, 3: up)
        // Offset by PI/4 to create 90-degree segments centered on each direction
        const normalized = ((angle + Math.PI * 5/4) % (Math.PI * 2)) / (Math.PI * 2);
        const direction = Math.floor(normalized * 4);
        
        // Map angle to sprite sheet rows
        switch(direction) {
            case 0: return 0; // Down
            case 1: return 1; // Left
            case 2: return 2; // Right
            case 3: return 3; // Up
            default: return 0;
        }
    }

    setNewRandomDirection() {
        const angle = Math.random() * Math.PI * 2;
        this.randomDirection.x = Math.cos(angle);
        this.randomDirection.y = Math.sin(angle);
    }

    update(player) {
        // Store current position in history
        const positionUpdateTime = performance.now();
        if (positionUpdateTime - this.lastPositionUpdate > 100) { // Update every 100ms
            this.lastPositions.push({
                x: this.mesh.position.x,
                y: this.mesh.position.y
            });
            if (this.lastPositions.length > this.positionHistorySize) {
                this.lastPositions.shift();
            }
            this.lastPositionUpdate = positionUpdateTime;
        }
        
        // Check if enemy is stuck
        if (this.lastPositions.length >= this.positionHistorySize) {
            const oldestPos = this.lastPositions[0];
            const currentPos = this.lastPositions[this.lastPositions.length - 1];
            const distanceMoved = Math.sqrt(
                Math.pow(currentPos.x - oldestPos.x, 2) + 
                Math.pow(currentPos.y - oldestPos.y, 2)
            );
            
            if (distanceMoved < 5) { // If moved less than 5 units in 3 seconds
                this.stuckTime += 100;
                if (this.stuckTime >= 3000) { // If stuck for 3 seconds
                    this.isStuck = true;
                    this.stuckTime = 0;
                }
            } else {
                this.stuckTime = 0;
                this.isStuck = false;
            }
        }
        
        // Handle getting unstuck
        if (this.isStuck) {
            // Randomly change direction
            const angle = Math.random() * Math.PI * 2;
            this.direction = {
                x: Math.cos(angle),
                y: Math.sin(angle)
            };
            this.isStuck = false;
        }
        
        // Make text always face camera at the start of each update
        if (this.healthText) {
            this.healthText.rotation.copy(this.mesh.rotation);
            this.healthText.rotation.z = 0;
        }
        
        // Update stats display position
        this.updateHealthBar();
        
        // Update shadow position to follow the enemy
        if (this.shadow) {
            this.shadow.position.x = this.mesh.position.x + 12;
            this.shadow.position.y = this.mesh.position.y + 12;
        }
        
        // Nest enemy spawning logic
        if (this.type === 5) {
            const currentTime = performance.now();
            if (currentTime - this.lastSpawnTime > this.spawnCooldown) {
                this.lastSpawnTime = currentTime;
                
                // Only spawn if there are fewer than 5 spawned enemies from this nest
                if (this.spawnedEnemies.filter(e => !e.isDead).length < 5) {
                    // This just creates the enemy, it needs to be added to the main enemies array
                    // We'll return this and let the main game loop handle it
                    this.newSpawnedEnemy = this.spawnSmallEnemy();
                }
            }
            
            // Clean up any dead spawned enemies from our tracking array
            this.spawnedEnemies = this.spawnedEnemies.filter(e => !e.isDead);
            
            // Skip the rest of the update logic for nest (it doesn't move or attack)
            return;
        }
        
        // For non-nest enemies, proceed with normal update
        
        // Check aggro range
        const dx = player.mesh.position.x - this.mesh.position.x;
        const dy = player.mesh.position.y - this.mesh.position.y;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
        
        // Set aggro if player is within range, or de-aggro if player is too far
        const deAggroRange = this.aggroRange * 1.5; // De-aggro at 1.5x aggro range
        
        // For shooter monsters, always aggro regardless of distance
        if (this.type === 1) {
            this.isAggro = true;
        } else if (distanceToPlayer <= this.aggroRange) {
            this.isAggro = true;
        } else if (distanceToPlayer > deAggroRange) {
            this.isAggro = false;
        }
        
        const currentTime = performance.now();
        
        // Only take action if aggro
        if (this.isAggro) {
            if (this.type === 4) { // Charger
                // Remove rotation - use animation frames instead
                // this.mesh.rotation.z = Math.atan2(dy, dx);
                
                // Update animation for the ram
                if (currentTime - this.frameTime > this.animationSpeed) {
                    this.frameTime = currentTime;
                    this.currentFrame = (this.currentFrame + 1) % 4;
                    
                    // Calculate direction based on movement or charging
                    let direction;
                    const angle = this.isCharging ? 
                        Math.atan2(this.chargeDirection.y, this.chargeDirection.x) : 
                        Math.atan2(dy, dx);
                    const degrees = ((angle * 180 / Math.PI) + 360) % 360;
                    
                    // Map angles to directions (same as basic monster)
                    if (degrees >= 225 && degrees < 315) {
                        direction = 1; // Right (when going up)
                    } else if (degrees >= 315 || degrees < 45) {
                        direction = 2; // Down (when going right)
                    } else if (degrees >= 45 && degrees < 135) {
                        direction = 3; // Left (when going down)
                    } else {
                        direction = 0; // Up (when going left)
                    }
                    
                    // Update sprite frame - use frame 2 & 3 during charge (faster animation)
                    const frameOffset = this.isCharging ? (this.currentFrame % 2) + 2 : this.currentFrame;
                    this.updateUVs(direction * 4 + frameOffset);
                }
                
                if (this.isCharging) {
                    // Continue charge in the stored direction
                    this.mesh.position.x += this.chargeDirection.x * this.chargeSpeed;
                    this.mesh.position.y += this.chargeDirection.y * this.chargeSpeed;
                    
                    // Check if we hit the player
                    if (distanceToPlayer <= this.attackRange) {
                        player.takeDamage(this.damage);
                        this.isCharging = false;
                        this.lastChargeTime = currentTime;
                    }
                    
                    // End charge after 1 second regardless of hit
                    if (currentTime - this.lastChargeTime > 1000) {
                        this.isCharging = false;
                        this.lastChargeTime = currentTime;
                    }
                } else {
                    // Check if we should start charging (only if in aggro range)
                    if (distanceToPlayer <= this.aggroRange && currentTime - this.lastChargeTime > this.attackCooldown) {
                        this.isCharging = true;
                        this.lastChargeTime = currentTime;
                        // Store the charge direction when starting the charge
                        this.chargeDirection = {
                            x: dx / distanceToPlayer,
                            y: dy / distanceToPlayer
                        };
                    } else {
                        // Random movement when not charging
                        if (currentTime - this.randomMoveTimer > this.randomMoveInterval) {
                            this.setNewRandomDirection();
                            this.randomMoveTimer = currentTime;
                        }
                        
                        // Move in random direction at normal speed
                        this.mesh.position.x += this.randomDirection.x * this.speed;
                        this.mesh.position.y += this.randomDirection.y * this.speed;
                    }
                }
            } else if (this.type === 1) {
                // Update animation based on player direction for shooter enemy
                if (currentTime - this.frameTime > this.animationSpeed) {
                    this.frameTime = currentTime;
                    this.currentFrame = (this.currentFrame + 1) % 4;
                    
                    // Calculate direction based on player position
                    const directionFrame = this.getDirectionFrame(dx, dy);
                    
                    // Update sprite frame with correct direction
                    this.updateUVs(directionFrame * 4 + this.currentFrame);
                }
                
                // Move to maintain distance if too close or too far
                const optimalRange = 400; // Half screen distance (typical screen is ~800 units)
                if (distanceToPlayer < optimalRange - 50) {
                    // Move away from player
                    this.mesh.position.x -= (dx / distanceToPlayer) * this.speed * 0.5;
                    this.mesh.position.y -= (dy / distanceToPlayer) * this.speed * 0.5;
                } else if (distanceToPlayer > optimalRange + 50) {
                    // Move toward player
                    this.mesh.position.x += (dx / distanceToPlayer) * this.speed * 0.5;
                    this.mesh.position.y += (dy / distanceToPlayer) * this.speed * 0.5;
                }
                
                // Shoot at player if in range and cooldown is over
                if (distanceToPlayer <= this.attackRange) {
                    this.shoot(player);
                }
            } else if (this.type === 3) { // Bomber
                // Move to maintain distance if too close or too far
                const optimalRange = 200;
                if (distanceToPlayer < optimalRange - 50) {
                    // Move away from player, but check wall collision first
                    const newX = this.mesh.position.x - (dx / distanceToPlayer) * this.speed;
                    const newY = this.mesh.position.y - (dy / distanceToPlayer) * this.speed;
                    
                    // Only move if not hitting walls
                    const roomSize = 800;
                    const boundaryPadding = 70;
                    const halfWidth = this.mesh.geometry.parameters.width / 2;
                    const halfHeight = this.mesh.geometry.parameters.height / 2;
                    
                    if (newX - halfWidth >= -roomSize/2 + boundaryPadding && 
                        newX + halfWidth <= roomSize/2 - boundaryPadding) {
                        this.mesh.position.x = newX;
                    }
                    if (newY - halfHeight >= -roomSize/2 + boundaryPadding && 
                        newY + halfHeight <= roomSize/2 - boundaryPadding) {
                        this.mesh.position.y = newY;
                    }
                } else if (distanceToPlayer > optimalRange + 50) {
                    // Move toward player
                    this.mesh.position.x += (dx / distanceToPlayer) * this.speed;
                    this.mesh.position.y += (dy / distanceToPlayer) * this.speed;
                }
                
                // Shoot bombs at player if in range
                if (distanceToPlayer <= this.attackRange) {
                    this.shoot(player);
                }
            } else { // Melee types (basic and fast)
                // Move toward player if not in attack range
                if (distanceToPlayer > this.attackRange) {
                    this.mesh.position.x += (dx / distanceToPlayer) * this.speed;
                    this.mesh.position.y += (dy / distanceToPlayer) * this.speed;
                    
                    // Update animation for basic monster
                    if (this.type === 0) {
                        if (currentTime - this.frameTime > this.animationSpeed) {
                            this.frameTime = currentTime;
                            this.currentFrame = (this.currentFrame + 1) % 4;
                            
                            // Calculate direction based on movement
                            let direction;
                            const angle = Math.atan2(dy, dx);
                            const degrees = ((angle * 180 / Math.PI) + 360) % 360;
                            
                            // Map angles to directions:
                            // Up: 225-315 degrees (row 0)
                            // Right: 315-45 degrees (row 1)
                            // Down: 45-135 degrees (row 2)
                            // Left: 135-225 degrees (row 3)
                            if (degrees >= 225 && degrees < 315) {
                                direction = 1; // Right (when going up)
                            } else if (degrees >= 315 || degrees < 45) {
                                direction = 2; // Down (when going right)
                            } else if (degrees >= 45 && degrees < 135) {
                                direction = 3; // Left (when going down)
                            } else {
                                direction = 0; // Up (when going left)
                            }
                            
                            this.updateUVs(direction * 4 + this.currentFrame);
                        }
                    } else {
                        // For fast monster, don't rotate anymore
                        // this.mesh.rotation.z = Math.atan2(dy, dx);
                        
                        // Update animation for flying enemy
                        if (this.type === 2 && currentTime - this.frameTime > this.animationSpeed) {
                            this.frameTime = currentTime;
                            this.currentFrame = (this.currentFrame + 1) % 4;
                            
                            // Calculate direction based on movement
                            const angle = Math.atan2(dy, dx);
                            const degrees = ((angle * 180 / Math.PI) + 360) % 360;
                            
                            // Map angles to directions (same as basic monster)
                            let direction;
                            if (degrees >= 225 && degrees < 315) {
                                direction = 1; // Right (when going up)
                            } else if (degrees >= 315 || degrees < 45) {
                                direction = 2; // Down (when going right)
                            } else if (degrees >= 45 && degrees < 135) {
                                direction = 3; // Left (when going down)
                            } else {
                                direction = 0; // Up (when going left)
                            }
                            
                            this.updateUVs(direction * 4 + this.currentFrame);
                        }
                    }
                }
                
                // Attack player if in range
                if (distanceToPlayer <= this.attackRange) {
                    this.attack(player);
                }
            }
        } else if (this.type === 0 || this.type === 2 || this.type === 4) { // Random movement for non-aggro basic monster, yellow monster, and charger
            // Update random movement direction
            if (currentTime - this.randomMoveTimer > this.randomMoveInterval) {
                this.setNewRandomDirection();
                this.randomMoveTimer = currentTime;
            }
            
            // Move in random direction at half speed (quarter speed for yellow monster when not aggro'd)
            const nonAggroSpeed = this.type === 2 ? this.speed * 0.15 : this.speed * 0.5;
            this.mesh.position.x += this.randomDirection.x * nonAggroSpeed;
            this.mesh.position.y += this.randomDirection.y * nonAggroSpeed;
            
            // Update animation based on random movement (for basic monster and charger/ram)
            if ((this.type === 0 || this.type === 2 || this.type === 4) && currentTime - this.frameTime > this.animationSpeed) {
                this.frameTime = currentTime;
                this.currentFrame = (this.currentFrame + 1) % 4;
                
                // Calculate direction based on random movement
                const angle = Math.atan2(this.randomDirection.y, this.randomDirection.x);
                const degrees = ((angle * 180 / Math.PI) + 360) % 360;
                
                let direction;
                if (degrees >= 225 && degrees < 315) {
                    direction = 1; // Right (when going up)
                } else if (degrees >= 315 || degrees < 45) {
                    direction = 2; // Down (when going right)
                } else if (degrees >= 45 && degrees < 135) {
                    direction = 3; // Left (when going down)
                } else {
                    direction = 0; // Up (when going left)
                }
                
                this.updateUVs(direction * 4 + this.currentFrame);
            }
        }
        
        // Keep enemies within bounds (assuming room size of 800)
        const roomSize = 800;
        const roomHalfSize = roomSize / 2;
        const enemyHalfWidth = this.mesh.geometry.parameters.width / 2;
        const enemyHalfHeight = this.mesh.geometry.parameters.height / 2;
        
        if (this.mesh.position.x - enemyHalfWidth < -roomHalfSize || 
            this.mesh.position.x + enemyHalfWidth > roomHalfSize ||
            this.mesh.position.y - enemyHalfHeight < -roomHalfSize || 
            this.mesh.position.y + enemyHalfHeight > roomHalfSize) {
            
            // If near boundary, keep the enemy inside with proper offset for their size
            this.mesh.position.x = Math.max(-roomHalfSize + enemyHalfWidth, 
                Math.min(roomHalfSize - enemyHalfWidth, this.mesh.position.x));
            this.mesh.position.y = Math.max(-roomHalfSize + enemyHalfHeight, 
                Math.min(roomHalfSize - enemyHalfHeight, this.mesh.position.y));
            
            if (!this.isAggro) {
                // If not aggro'ed and hit boundary, set new random direction pointing away from boundary
                this.setNewRandomDirection();
                this.randomMoveTimer = currentTime; // Reset the movement timer
                
                // Ensure the new direction points away from the boundary
                if (this.mesh.position.x - enemyHalfWidth < -roomHalfSize && this.randomDirection.x < 0) {
                    this.randomDirection.x *= -1;
                }
                if (this.mesh.position.x + enemyHalfWidth > roomHalfSize && this.randomDirection.x > 0) {
                    this.randomDirection.x *= -1;
                }
                if (this.mesh.position.y - enemyHalfHeight < -roomHalfSize && this.randomDirection.y < 0) {
                    this.randomDirection.y *= -1;
                }
                if (this.mesh.position.y + enemyHalfHeight > roomHalfSize && this.randomDirection.y > 0) {
                    this.randomDirection.y *= -1;
                }
            }
        }
        
        // Update bullets
        this.updateBullets(player);
    }
    
    shoot(player) {
        const currentTime = performance.now();
        
        // Detect if on mobile for bullet speeds
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        const mobileBulletSpeedMultiplier = isMobile ? 0.75 : 1; // 1.33x slower bullets on mobile
        
        if (this.type === 1) { // Regular shooter
            if (currentTime - this.lastShotTime > this.attackCooldown) {
                // Shoot four times quickly
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => {
                        // Create bullet
                        const bullet = {
                            mesh: new THREE.Mesh(this.bulletGeometry, this.bulletMaterial),
                            dx: 0,
                            dy: 0,
                            speed: 5 * mobileBulletSpeedMultiplier, // 1.33x slower on mobile
                            damage: this.damage
                        };
                        
                        // Position bullet at enemy
                        bullet.mesh.position.copy(this.mesh.position);
                        
                        // Calculate direction to player
                        const dx = player.mesh.position.x - this.mesh.position.x;
                        const dy = player.mesh.position.y - this.mesh.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        // Set bullet velocity
                        bullet.dx = (dx / distance) * bullet.speed;
                        bullet.dy = (dy / distance) * bullet.speed;
                        
                        // Add to scene and bullets array
                        this.scene.add(bullet.mesh);
                        this.bullets.push(bullet);
                    }, i * 100); // Shoot every 100ms
                }
                
                // Update last shot time with a randomized cooldown between 1-3 seconds
                this.lastShotTime = currentTime;
                this.attackCooldown = 1000 + Math.floor(Math.random() * 2000); // Random between 1000-3000ms
            }
        } else if (this.type === 3) { // Bomber
            if (currentTime - this.lastShotTime > this.attackCooldown) {
                this.lastShotTime = currentTime;
                
                // Create bomb
                const bomb = {
                    mesh: new THREE.Mesh(this.bulletGeometry, this.bulletMaterial),
                    dx: 0,
                    dy: 0,
                    speed: 3 * mobileBulletSpeedMultiplier, // 1.33x slower on mobile
                    damage: this.damage,
                    explosionDamage: this.explosionDamage,
                    timeCreated: currentTime
                };
                
                // Position bomb at enemy
                bomb.mesh.position.copy(this.mesh.position);
                
                // Calculate direction to player
                const dx = player.mesh.position.x - this.mesh.position.x;
                const dy = player.mesh.position.y - this.mesh.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Set bomb velocity
                bomb.dx = (dx / distance) * bomb.speed;
                bomb.dy = (dy / distance) * bomb.speed;
                
                // Add to scene and bullets array
                this.scene.add(bomb.mesh);
                this.bullets.push(bomb);
            }
        }
    }
    
    updateBullets(player) {
        const roomSize = 800;
        const boundaryPadding = 70; // Same as in main.js for consistency
        
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // Move bullet
            bullet.mesh.position.x += bullet.dx;
            bullet.mesh.position.y += bullet.dy;
            
            if (this.type === 1) { // Regular shooter bullets
                // Check if bullet hits boundary
                if (bullet.mesh.position.x < -roomSize/2 + boundaryPadding || 
                    bullet.mesh.position.x > roomSize/2 - boundaryPadding ||
                    bullet.mesh.position.y < -roomSize/2 + boundaryPadding || 
                    bullet.mesh.position.y > roomSize/2 - boundaryPadding) {
                    // Remove bullet
                    this.scene.remove(bullet.mesh);
                    this.bullets.splice(i, 1);
                    continue;
                }

                // Check for collision with player
                const dx = player.mesh.position.x - bullet.mesh.position.x;
                const dy = player.mesh.position.y - bullet.mesh.position.y;
                const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
                
                if (distanceToPlayer < 20) { // Simple circle collision
                    player.takeDamage(bullet.damage);
                    this.scene.remove(bullet.mesh);
                    this.bullets.splice(i, 1);
                    continue;
                }
            } else if (this.type === 3) { // Bomber's bombs
                const currentTime = performance.now();
                
                // Check if bomb should stop (after 2 seconds of movement)
                const shouldStop = currentTime - bullet.timeCreated > 2000;
                
                // Check if bomb hits wall and should bounce
                const hitLeftWall = bullet.mesh.position.x < -roomSize/2 + boundaryPadding;
                const hitRightWall = bullet.mesh.position.x > roomSize/2 - boundaryPadding;
                const hitTopWall = bullet.mesh.position.y > roomSize/2 - boundaryPadding;
                const hitBottomWall = bullet.mesh.position.y < -roomSize/2 + boundaryPadding;
                
                // Bounce off walls if still moving
                if (!bullet.timeStopped) {
                    if (hitLeftWall || hitRightWall) {
                        bullet.dx *= -1;
                    }
                    if (hitTopWall || hitBottomWall) {
                        bullet.dy *= -1;
                    }
                    
                    // Keep bomb in bounds
                    bullet.mesh.position.x = Math.max(-roomSize/2 + boundaryPadding, 
                        Math.min(roomSize/2 - boundaryPadding, bullet.mesh.position.x));
                    bullet.mesh.position.y = Math.max(-roomSize/2 + boundaryPadding, 
                        Math.min(roomSize/2 - boundaryPadding, bullet.mesh.position.y));
                }
                
                // Stop the bomb after 2 seconds of movement
                if (shouldStop && !bullet.timeStopped) {
                    bullet.dx = 0;
                    bullet.dy = 0;
                    bullet.timeStopped = currentTime;
                }
                
                // Explode only after stopping and waiting 2 seconds
                if (bullet.timeStopped && currentTime - bullet.timeStopped > 2000) {
                    // Show explosion effect
                    this.explosionMesh.position.copy(bullet.mesh.position);
                    this.explosionMesh.visible = true;
                    
                    // Check for player in explosion radius
                    const dx = player.mesh.position.x - bullet.mesh.position.x;
                    const dy = player.mesh.position.y - bullet.mesh.position.y;
                    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distanceToPlayer < 50) {
                        player.takeDamage(3);
                        console.log("BOOM! Player took explosion damage!");
                    }
                    
                    // Remove bomb
                    this.scene.remove(bullet.mesh);
                    this.bullets.splice(i, 1);
                    
                    // Hide explosion effect after 200ms
                    setTimeout(() => {
                        this.explosionMesh.visible = false;
                    }, 200);
                    
                    continue;
                }
            }
        }
    }
    
    attack(player) {
        // Basic melee attack logic - attacks happen automatically when in range
        // We'll use a simple cooldown system for melee attacks too
        const currentTime = performance.now();
        
        if (!this.lastAttackTime || currentTime - this.lastAttackTime >= 1000) {
            player.takeDamage(this.damage);
            this.lastAttackTime = currentTime;
        }
    }

    // Create a shadow that follows the enemy
    createShadow() {
        // Determine the shadow size based on the enemy type
        let shadowSize = 64;
        
        // Nest enemy gets a larger shadow
        if (this.type === 5) {
            shadowSize = 120;
        } else if (this.type === 6) { // Small nest enemy gets a smaller shadow
            shadowSize = 40;
        }
        
        // Create a shadow mesh with the proper geometry size
        const shadowGeometry = new THREE.PlaneGeometry(shadowSize, shadowSize);
        const shadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.2,
            alphaTest: 0.01, // Lower alphaTest to show more of the texture
            side: THREE.DoubleSide
        });
        
        this.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        this.shadow.position.set(
            this.mesh.position.x + 12,
            this.mesh.position.y + 12,
            0.5
        );
        
        this.scene.add(this.shadow);
        
        // Use the same texture path logic as in the constructor
        let texturePath = 'assets/sprites/basic_monster.png'; // Default
        
        switch(this.type) {
            case 1: // Shooter
                texturePath = 'assets/sprites/shooter_enemy.png';
                break;
            case 2: // Fast
                texturePath = 'assets/sprites/flying_enemy.png';
                break;
            case 4: // Charger
                texturePath = 'assets/sprites/ram.png';
                break;
            case 5: // Nest
                texturePath = 'assets/sprites/nest.png';
                break;
            case 6: // Small nest enemy
                texturePath = 'assets/sprites/nest_enemy.png';
                break;
            // Default (types 0 and 3) use basic_monster.png
        }
        
        console.log(`Loading shadow texture for enemy type ${this.type}: ${texturePath}`);
        
        // Load the same texture for the shadow
        new THREE.TextureLoader().load(texturePath, 
            (texture) => {
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                this.shadow.material.map = texture;
                this.shadow.material.needsUpdate = true;
                console.log(`Shadow texture loaded for enemy type ${this.type}`);
            },
            undefined,
            (error) => {
                console.error(`Error loading shadow texture for enemy type ${this.type}:`, error);
            }
        );
    }

    // Method to spawn a small enemy from the nest
    spawnSmallEnemy() {
        // Calculate where the hatch is (lower right corner)
        const roomSize = 800; // Same as ROOM_SIZE in main.js
        const hatchX = roomSize/2 - 80;
        const hatchY = -roomSize/2 + 80;
        
        // Define playable area boundaries (inside the walls)
        const wallPadding = 60; // Match wall size
        const playableMinX = -roomSize/2 + wallPadding;
        const playableMaxX = roomSize/2 - wallPadding;
        const playableMinY = -roomSize/2 + wallPadding;
        const playableMaxY = roomSize/2 - wallPadding;
        
        // Create a small enemy at the nest's position with slight offset
        let offsetX, offsetY;
        let spawnX, spawnY;
        
        do {
            // Calculate random offset
            offsetX = (Math.random() - 0.5) * 40; // Random offset within 20 units
            offsetY = (Math.random() - 0.5) * 40;
            
            // Calculate spawn position
            spawnX = this.mesh.position.x + offsetX;
            spawnY = this.mesh.position.y + offsetY;
            
            // Ensure spawn position is within playable area
            spawnX = Math.max(playableMinX, Math.min(playableMaxX, spawnX));
            spawnY = Math.max(playableMinY, Math.min(playableMaxY, spawnY));
            
            // Calculate distance to hatch
            const distanceToHatch = Math.sqrt(
                Math.pow(spawnX - hatchX, 2) + 
                Math.pow(spawnY - hatchY, 2)
            );
            
            // Try again if too close to hatch
        } while (distanceToHatch < 325);
        
        // Using a special type (6) for the small spawned enemies
        const smallEnemy = new Enemy(
            this.scene, 
            spawnX,
            spawnY,
            6, // Type 6 - small nest enemy
            this.level
        );
        
        // Add to tracked enemies
        this.spawnedEnemies.push(smallEnemy);
        
        // Return the enemy so it can be added to the main enemies array
        return smallEnemy;
    }
}