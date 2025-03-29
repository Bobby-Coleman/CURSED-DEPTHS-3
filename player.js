import * as THREE from 'three';

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.hp = 8;
        this.maxHp = 8;
        this.ammo = 300;
        this.maxAmmo = 300;
        this.isDead = false;
        this.relics = [];
        this.canSellRelics = true; // Can sell relics by default
        this.canHeal = true; // Can pick up hearts by default
        this.baseDamage = 1; // Base weapon damage - can be affected by relics
        this.damageMultiplier = 1; // Applied to damage calculations
        this.damageTakenMultiplier = 1; // How much extra damage the player takes
        this.fireRate = 3; // Bullets per second
        this.lastFireTime = 0;
        this.weaponRange = 200; // Default weapon range
        this.healOnKill = 0; // Amount of health regained per kill
        
        // Detect if on mobile and adjust speed accordingly
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        this.speed = isMobile ? 2.5 : 5; // Half speed (2.5) on mobile, normal speed (5) on desktop
        
        // Invulnerability tracking
        this.isInvulnerable = false;
        this.invulnerabilityTime = 250; // 0.25 seconds in milliseconds (reduced from 1 second)
        this.lastDamageTime = 0;
        
        // Create player mesh with sprite sheet
        const geometry = new THREE.PlaneGeometry(80, 80);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: true
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, 0, 1); // Start at center
        scene.add(this.mesh);

        // Load player sprite sheet
        const texture = new THREE.TextureLoader().load('assets/sprites/player.png',
            // Success callback
            (loadedTexture) => {
                console.log('Player sprite sheet loaded successfully');
                this.mesh.material.map = loadedTexture;
                this.mesh.material.needsUpdate = true;
                
                // Create shadow after texture is loaded
                this.createShadow(scene, loadedTexture);
            },
            // Progress callback
            undefined,
            // Error callback
            (error) => {
                console.error('Error loading player sprite sheet:', error);
                this.mesh.material.color.setHex(0xFF0000); // Fallback to red if sprite fails to load
            }
        );
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        // Animation setup
        this.setupAnimationFrames();
        
        // Weapon direction indicator (hidden)
        const indicatorGeometry = new THREE.PlaneGeometry(25, 6);
        const indicatorMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFFFFFF,
            visible: false // Hide the indicator
        });
        this.indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        this.indicator.position.set(50, 0, 1.1); // Adjusted for 80x80 sprite
        this.mesh.add(this.indicator);
        
        // Player bullets
        this.bullets = [];
        this.bulletGeometry = new THREE.CircleGeometry(3, 8);
        this.bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    }
    
    // Create a shadow for the player
    createShadow(scene, texture) {
        // Create a shadow mesh with the same geometry as the player
        const shadowGeometry = new THREE.PlaneGeometry(80, 80);
        const shadowMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0x000000,
            transparent: true,
            opacity: 0.2,
            alphaTest: 0.1,
            side: THREE.DoubleSide
        });
        
        this.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        this.shadow.position.set(
            this.mesh.position.x + 12,
            this.mesh.position.y + 12,
            0.5
        );
        
        scene.add(this.shadow);
    }
    
    generateRandomDamage() {
        return 3; // Fixed damage of 3
    }
    
    generateRandomFireRate() {
        return 5; // Fixed fire rate of 5/s
    }
    
    generateRandomRange() {
        return 200; // Fixed range of 200
    }
    
    setupAnimationFrames() {
        this.frameCount = 4; // 4 frames per direction
        this.currentFrame = 0;
        this.frameTime = 0;
        this.animationSpeed = 150; // milliseconds per frame
        this.lastDirection = 0;
        
        // Create UV coordinates for each frame
        this.frames = [];
        const frameWidth = 1/4; // 4 frames horizontally
        const frameHeight = 1/4; // 4 directions vertically
        
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

    updateUVs(frameIndex) {
        if (!this.mesh.geometry.attributes.uv) return;
        
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
        
        // Update shadow UVs to match the current frame
        if (this.shadow && this.shadow.geometry.attributes.uv) {
            const shadowUvs = this.shadow.geometry.attributes.uv;
            shadowUvs.set(uvArray);
            shadowUvs.needsUpdate = true;
        }
    }

    update(keys, mouse, enemies) {
        // Check if invulnerability has expired
        if (this.isInvulnerable) {
            const currentTime = performance.now();
            if (currentTime - this.lastDamageTime > this.invulnerabilityTime) {
                this.isInvulnerable = false;
            } else {
                // Flash the player sprite during invulnerability (every 100ms)
                const flashInterval = 100;
                const flashPhase = Math.floor((currentTime - this.lastDamageTime) / flashInterval) % 2;
                this.mesh.visible = flashPhase === 0; // Toggle visibility for flashing effect
            }
        } else {
            // Ensure player is visible when not invulnerable
            this.mesh.visible = true;
        }
        
        // Movement
        let moveX = 0;
        let moveY = 0;
        
        if (keys.w) moveY -= this.speed;
        if (keys.s) moveY += this.speed;
        if (keys.a) moveX -= this.speed;
        if (keys.d) moveX += this.speed;
        
        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            const normalize = 1 / Math.sqrt(2);
            moveX *= normalize;
            moveY *= normalize;
        }
        
        // Update position
        this.mesh.position.x += moveX;
        this.mesh.position.y += moveY;
        
        // Update shadow position
        if (this.shadow) {
            this.shadow.position.x = this.mesh.position.x + 12;
            this.shadow.position.y = this.mesh.position.y + 12;
            this.shadow.rotation.z = this.mesh.rotation.z;
        }
        
        // Room boundary checks are now handled in main.js animation loop
        
        // Calculate aim angle once for both animation and shooting
        const dx = mouse.x - this.mesh.position.x;
        const dy = mouse.y - this.mesh.position.y;
        const angle = Math.atan2(dy, dx);
        const degrees = ((angle * 180 / Math.PI) + 360) % 360;
        
        // Store current aim angle for shooting
        this.currentAimAngle = angle;
        
        // Update animation based on movement and aim
        const currentTime = performance.now();
        if (currentTime - this.frameTime > this.animationSpeed) {
            this.frameTime = currentTime;
            
            // Only animate if moving
            if (moveX !== 0 || moveY !== 0) {
                this.currentFrame = (this.currentFrame + 1) % 4;
            }
            
            // Map angles to sprite sheet rows (up, right, down, left)
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
            
            // Update sprite direction
            this.updateUVs(direction * 4 + this.currentFrame);
            
            // Update indicator rotation to point at mouse
            this.indicator.rotation.z = angle;
        }
        
        // Shooting
        if (mouse.isDown) {
            this.shoot();
        }
        
        // Update bullets
        this.updateBullets(enemies);
    }
    
    shoot() {
        const currentTime = performance.now();
        const shootingInterval = 1000 / this.fireRate;
        
        if (currentTime - this.lastFireTime >= shootingInterval && this.ammo > 0) {
            // Create new bullet
            const bullet = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial);
            
            // Set bullet position
            bullet.position.copy(this.mesh.position);
            
            // Calculate velocity based on current aim angle
            const speed = 10;
            const velocityX = Math.cos(this.currentAimAngle) * speed;
            const velocityY = Math.sin(this.currentAimAngle) * speed;
            
            // Calculate damage for this bullet
            const bulletDamage = this.calculateDamage();
            
            // Add bullet to scene and tracking array
            this.scene.add(bullet);
            this.bullets.push({
                mesh: bullet,
                velocity: { x: velocityX, y: velocityY },
                damage: bulletDamage,
                range: this.weaponRange,
                distanceTraveled: 0
            });
            
            // Update last shot time and ammo
            this.lastFireTime = currentTime;
            this.ammo--;
        }
    }
    
    calculateDamage() {
        // Start with base damage
        let damage = this.baseDamage;
        console.log('Starting base damage:', damage);
        console.log('Current kill streak:', window.gameState?.killStreak);
        
        // First apply additive bonuses
        for (const relic of this.relics) {
            if (relic.id === 'ragingHeart' && window.gameState) {
                damage += window.gameState.killStreak * 2; // Add +2 damage per kill in streak
            }
            // Add other additive relic effects here
        }
        
        // Then apply multiplicative effects
        let multiplier = 1;
        for (const relic of this.relics) {
            console.log('Checking relic:', relic.id);
            if (relic.id === 'hemoclawCharm') {
                const missingHP = this.maxHp - this.hp;
                multiplier *= (1 + (missingHP * 0.25)); // Multiply by (1 + 0.25 per missing HP)
            }
            if (relic.id === 'infernalCore') {
                // +25% damage per equipped relic (including this one)
                multiplier *= (1 + (this.relics.length * 0.25));
            }
            if (relic.id === 'executionersSeal') {
                console.log('Found Executioners Seal');
                if (window.gameState && window.gameState.killStreak > 20) {
                    console.log('Kill streak > 20, applying 3x multiplier');
                    multiplier *= 3; // Triple damage when kill streak > 20
                }
            }
            // Add other multiplicative relic effects here
        }
        
        // Apply final multiplier
        console.log('Final multiplier:', multiplier);
        damage *= multiplier;
        console.log('Final damage after multiplier:', damage);
        
        return Math.floor(damage); // Round down to nearest integer
    }
    
    updateBullets(enemies) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // Update bullet position
            bullet.mesh.position.x += bullet.velocity.x;
            bullet.mesh.position.y += bullet.velocity.y;
            
            // Update distance traveled
            bullet.distanceTraveled += Math.sqrt(
                bullet.velocity.x * bullet.velocity.x + 
                bullet.velocity.y * bullet.velocity.y
            );
            
            // Check if bullet has exceeded its range
            if (bullet.distanceTraveled >= bullet.range) {
                this.scene.remove(bullet.mesh);
                this.bullets.splice(i, 1);
                continue;
            }
            
            // Check if bullet is out of bounds
            const roomSize = 800;
            if (
                bullet.mesh.position.x < -roomSize / 2 || 
                bullet.mesh.position.x > roomSize / 2 ||
                bullet.mesh.position.y < -roomSize / 2 || 
                bullet.mesh.position.y > roomSize / 2
            ) {
                this.scene.remove(bullet.mesh);
                this.bullets.splice(i, 1);
                continue;
            }
            
            // Check for collision with enemies
            for (const enemy of enemies) {
                const dx = bullet.mesh.position.x - enemy.mesh.position.x;
                const dy = bullet.mesh.position.y - enemy.mesh.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Collision detected (simple circle collision)
                if (distance < 80) {
                    // Apply damage to enemy
                    enemy.takeDamage(bullet.damage);
                    
                    // Remove bullet
                    this.scene.remove(bullet.mesh);
                    this.bullets.splice(i, 1);
                    break;
                }
            }
        }
    }
    
    takeDamage(amount) {
        // Check if player is currently invulnerable
        if (this.isInvulnerable) {
            return; // Skip damage if invulnerable
        }
        
        // Calculate total damage multiplier from curses
        let damageMultiplier = 1;
        for (const relic of this.relics) {
            if (relic.id === 'executionersSeal') {
                damageMultiplier *= 2; // Take x2 damage
            }
            if (relic.id === 'doomsPromise') {
                damageMultiplier *= 1.5; // Take +50% damage
            }
        }

        // Apply multiplied damage
        this.hp -= Math.ceil(amount * damageMultiplier);
        this.hp = Math.max(0, this.hp); // Ensure HP doesn't go below 0
        
        // Reset kill streak if hit
        if (window.gameState) {
            window.gameState.killStreak = 0;
        }
        
        // Visual damage effect - turn red
        this.mesh.material.color.set(0xFF0000); // Set to red
        
        // Reset color after a short delay
        setTimeout(() => {
            this.mesh.material.color.set(0xFFFFFF); // Reset to white
        }, 200);
        
        // Set invulnerability
        this.isInvulnerable = true;
        this.lastDamageTime = performance.now();
    }
    
    addRelic(relic) {
        // Add relic to player's collection
        this.relics.push(relic);
        
        // Call onEquip if it exists
        if (relic.onEquip) {
            relic.onEquip(this);
        }
        
        // Apply any static effects
        if (relic.apply) {
            relic.apply(this);
        }
    }
    
    removeRelic(index) {
        const relic = this.relics[index];
        if (relic) {
            // Call onUnequip if it exists
            if (relic.onUnequip) {
                relic.onUnequip(this);
            }
            // Remove the relic from the array
            this.relics.splice(index, 1);
        }
    }

    // Clean up player resources when needed
    cleanup() {
        // Remove bullets
        for (const bullet of this.bullets) {
            if (bullet.mesh) {
                this.scene.remove(bullet.mesh);
            }
        }
        this.bullets = [];
        
        // Remove shadow
        if (this.shadow) {
            this.scene.remove(this.shadow);
        }
        
        // Remove player mesh
        this.scene.remove(this.mesh);
    }
}