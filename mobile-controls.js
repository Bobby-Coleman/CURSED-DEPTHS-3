// Mobile controls setup
window.addEventListener('load', () => {
    // Check if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile) {
        console.log("Mobile device detected: setting up mobile controls");
        
        // Give time for the game to fully initialize
        setTimeout(() => {
            try {
                // Create virtual joystick for movement ONLY
                const moveJoystick = nipplejs.create({
                    zone: document.getElementById('mobileControls'),
                    mode: 'static',
                    position: { left: '60px', bottom: '60px' },
                    color: 'white',
                    size: 120,
                    multitouch: true
                });

                // Create virtual joystick for aiming and firing ONLY
                const aimJoystick = nipplejs.create({
                    zone: document.getElementById('mobileControlsRight'),
                    mode: 'static',
                    position: { left: '60px', bottom: '60px' },
                    color: 'red',
                    size: 120,
                    multitouch: true
                });

                // LEFT NIPPLE - MOVEMENT ONLY
                moveJoystick.on('move', (evt, data) => {
                    try {
                        // Get joystick angle in degrees
                        const angle = data.angle.degree;
                        
                        // Reset all keys first
                        window.game.keys.w = false;
                        window.game.keys.a = false;
                        window.game.keys.s = false;
                        window.game.keys.d = false;
                        
                        // Set movement keys based on angle
                        // UP (reversed from before)
                        if (angle > 225 && angle < 315) {
                            window.game.keys.w = true;
                        }
                        // DOWN (reversed from before)
                        if (angle > 45 && angle < 135) {
                            window.game.keys.s = true;
                        }
                        // LEFT
                        if (angle > 135 && angle < 225) {
                            window.game.keys.a = true;
                        }
                        // RIGHT
                        if ((angle > 315 && angle <= 360) || (angle >= 0 && angle < 45)) {
                            window.game.keys.d = true;
                        }
                        
                        // Add diagonal movement
                        // Up-Right
                        if (angle > 315 && angle < 360) {
                            window.game.keys.w = true;
                            window.game.keys.d = true;
                        }
                        // Up-Left
                        if (angle > 225 && angle < 270) {
                            window.game.keys.w = true;
                            window.game.keys.a = true;
                        }
                        // Down-Left
                        if (angle > 135 && angle < 180) {
                            window.game.keys.s = true;
                            window.game.keys.a = true;
                        }
                        // Down-Right
                        if (angle > 45 && angle < 90) {
                            window.game.keys.s = true;
                            window.game.keys.d = true;
                        }
                    } catch (e) {
                        console.error("Error in move joystick handler:", e);
                    }
                });

                moveJoystick.on('end', () => {
                    // Reset all movement keys
                    window.game.keys.w = false;
                    window.game.keys.a = false;
                    window.game.keys.s = false;
                    window.game.keys.d = false;
                });

                // RIGHT NIPPLE - AIMING AND FIRING ONLY
                aimJoystick.on('move', (evt, data) => {
                    try {
                        // Get joystick angle in degrees
                        const angle = data.angle.degree;
                        
                        // Update cursor position based on aim direction
                        if (window.game && window.game.player) {
                            const cursorDistance = 100;
                            const radian = angle * Math.PI / 180;
                            
                            // Get player's current position
                            const playerX = window.game.player.mesh.position.x;
                            const playerY = window.game.player.mesh.position.y;
                            
                            // Calculate cursor position relative to player
                            const cursorX = playerX + Math.cos(radian) * cursorDistance;
                            const cursorY = playerY + Math.sin(radian) * cursorDistance;
                            
                            // Update mouse position with lerp for smooth movement
                            const lerpFactor = 0.2; // Adjust this value to control smoothing (0-1)
                            window.game.mouse.x += (cursorX - window.game.mouse.x) * lerpFactor;
                            window.game.mouse.y += (cursorY - window.game.mouse.y) * lerpFactor;
                        }
                    } catch (e) {
                        console.error("Error in aim joystick handler:", e);
                    }
                });

                aimJoystick.on('start', () => {
                    // Start shooting when aim joystick is touched
                    if (window.game && window.game.mouse) {
                        window.game.mouse.isDown = true;
                    }
                });

                aimJoystick.on('end', () => {
                    // Stop shooting when aim joystick is released
                    if (window.game && window.game.mouse) {
                        window.game.mouse.isDown = false;
                    }
                });
                
                // Remove the shoot button since we're using the right nipple for firing
                const shootButton = document.getElementById('shootButton');
                if (shootButton) {
                    shootButton.style.display = 'none';
                }
                
                console.log("Mobile controls initialized with dual joystick");
            } catch (e) {
                console.error("Error setting up mobile controls:", e);
            }
        }, 1500); // Give more time for initialization
    }
}); 