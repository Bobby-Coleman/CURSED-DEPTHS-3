import * as THREE from 'three';

// Play background music at the start of the game
const backgroundMusic = new Audio('assets/audio/background_music_enter.wav');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.7;
backgroundMusic.play();

class DrivingGame {
    constructor() {
        // Game settings
        this.settings = {
            roadWidth: 20, // Increased from 15 to accommodate 4 lanes
            roadLength: 300,
            carSpeed: 1.2,
            obstacleSpeed: 0.4,
            cameraHeight: 7,
            cameraDistance: 12,
            buildingCount: 20,
            maxObstacles: 10
        };

        // Game state
        this.playerCar = null;
        this.roadSegments = [];
        this.obstacles = [];
        this.buildings = [];
        this.headlights = [];
        this.boundaryWalls = []; // Store boundary walls
        this.collisionSparks = []; // Store collision spark particles
        this.gameOver = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.playerPosition = 0; // Horizontal position on the road
        this.distance = 0; // Total distance traveled
        this.time = 0; // For animation timing
        this.laneCounter = 0;
        
        // Road curve variables
        this.roadCurve = 0; // Current road curve amount (positive = right, negative = left)
        this.targetRoadCurve = 0; // Target curve to ease towards
        this.curveChangeTime = 0; // Time until next curve change
        
        // Lane distribution variables
        this.lastSpawnedLane = null; // Keep track of the last lane where a car was spawned
        
        // Initialize the scene
        this.initScene();
        this.initLights();
        this.createRoad();
        this.createBoundaryWalls(); // Add boundary walls
        this.createPlayerCar();
        this.createBuildings();
        this.setupControls();
        
        // Start the animation loop
        this.animate();
    }
    
    initScene() {
        // Create scene, camera, and renderer
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000022); // Dark blue night sky
        this.scene.fog = new THREE.Fog(0x000022, 40, 130); // Extended fog distance
        
        // Set up camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, this.settings.cameraHeight, this.settings.cameraDistance);
        this.camera.lookAt(0, 0, -30); // Look further ahead
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    initLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Moonlight (directional light)
        const moonlight = new THREE.DirectionalLight(0x8888ff, 0.5);
        moonlight.position.set(10, 20, 10);
        this.scene.add(moonlight);
    }
    
    createRoad() {
        // Create the road surface with segments for movement illusion
        const roadMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            roughness: 0.8
        });
        
        const segmentLength = 20;
        const segmentCount = Math.ceil(this.settings.roadLength / segmentLength);
        
        for (let i = 0; i < segmentCount; i++) {
            const roadSegment = new THREE.Mesh(
                new THREE.PlaneGeometry(this.settings.roadWidth, segmentLength),
                roadMaterial
            );
            
            roadSegment.rotation.x = -Math.PI / 2;
            roadSegment.position.z = -i * segmentLength;
            
            // Store the initial z position for curving calculations
            roadSegment.userData = { 
                initialZ: -i * segmentLength 
            };
            
            // Add lane markings - now with 4 lanes (5 lane markings)
            // Lanes will be at approximately: -6, -2, 2, 6
            
            // Create all five lane markings
            const laneMarkPositions = [-8, -4, 0, 4, 8]; // Adjusted for 4 lanes
            
            laneMarkPositions.forEach(xPos => {
                // Skip the center marking to create a dotted line
                const isDottedLine = xPos === 0;
                const markGeometry = isDottedLine ? 
                    new THREE.PlaneGeometry(0.3, 1.5) : // Dotted center line
                    new THREE.PlaneGeometry(0.3, 3);    // Solid side lines
                
                const laneMark = new THREE.Mesh(
                    markGeometry,
                    new THREE.MeshBasicMaterial({ color: 0xffffff })
                );
                
                laneMark.position.y = 0.01;
                laneMark.position.x = xPos;
                laneMark.rotation.x = -Math.PI / 2;
                
                // For the center line, make it dotted by alternating visibility
                if (isDottedLine) {
                    // Only add the dotted line every other segment
                    if (i % 2 === 0) {
                        roadSegment.add(laneMark);
                    }
                } else {
                    roadSegment.add(laneMark);
                }
            });
            
            this.scene.add(roadSegment);
            this.roadSegments.push(roadSegment);
        }
    }
    
    createBoundaryWalls() {
        // Create boundary walls on both sides of the road
        const roadHalfWidth = this.settings.roadWidth / 2;
        const wallHeight = 1.5; // Lower height for guardrails
        const wallThickness = 0.5;
        const wallLength = 10; // Shorter segments to better follow curves
        const segmentCount = Math.ceil(this.settings.roadLength / wallLength);
        
        // Create wall segments
        for (let i = 0; i < segmentCount; i++) {
            const z = -i * wallLength - wallLength/2;
            
            // Create materials for the walls
            const concreteMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x999999,
                roughness: 0.8
            });
            
            const metalMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xcccccc,
                roughness: 0.3,
                metalness: 0.7
            });
            
            // Create left wall (guardrail style)
            const leftGuardrailGroup = new THREE.Group();
            
            // Concrete base
            const leftBase = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness, 0.5, wallLength),
                concreteMaterial
            );
            leftBase.position.y = 0.25;
            leftGuardrailGroup.add(leftBase);
            
            // Metal top rail
            const leftRail = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness/2, 0.1, wallLength),
                metalMaterial
            );
            leftRail.position.y = wallHeight - 0.05;
            leftGuardrailGroup.add(leftRail);
            
            // Posts
            for (let p = 0; p < 3; p++) {
                const post = new THREE.Mesh(
                    new THREE.BoxGeometry(wallThickness/2, wallHeight, 0.1),
                    metalMaterial
                );
                post.position.set(0, wallHeight/2, -wallLength/2 + p * (wallLength/2));
                leftGuardrailGroup.add(post);
            }
            
            // Position the guardrail
            leftGuardrailGroup.position.set(-roadHalfWidth - 0.5, 0, z);
            this.scene.add(leftGuardrailGroup);
            this.boundaryWalls.push(leftGuardrailGroup);
            
            // Create right wall (guardrail style) - clone from left
            const rightGuardrailGroup = leftGuardrailGroup.clone();
            rightGuardrailGroup.position.set(roadHalfWidth + 0.5, 0, z);
            this.scene.add(rightGuardrailGroup);
            this.boundaryWalls.push(rightGuardrailGroup);
            
            // Add reflectors on both guardrails
            for (let side = 0; side < 2; side++) {
                const guardrail = side === 0 ? leftGuardrailGroup : rightGuardrailGroup;
                const reflectorMaterial = new THREE.MeshBasicMaterial({ color: side === 0 ? 0xff0000 : 0xffffff });
                
                // Add reflectors along the guardrail
                for (let r = 0; r < 5; r++) {
                    const reflector = new THREE.Mesh(
                        new THREE.BoxGeometry(0.1, 0.1, 0.05),
                        reflectorMaterial
                    );
                    const xPos = side === 0 ? 0.25 : -0.25; // Facing inward
                    reflector.position.set(xPos, 0.3, -wallLength/2 + r * (wallLength/4));
                    guardrail.add(reflector);
                }
            }
        }
    }
    
    createPlayerCar() {
        // Create a simple car using basic shapes
        const carGroup = new THREE.Group();
        
        // Car body
        const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
        carBody.position.y = 0.5;
        carGroup.add(carBody);
        
        // Car roof
        const roofGeometry = new THREE.BoxGeometry(1.5, 0.7, 2);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xdd0000 });
        const carRoof = new THREE.Mesh(roofGeometry, roofMaterial);
        carRoof.position.y = 1.35;
        carRoof.position.z = 0.5;
        carGroup.add(carRoof);
        
        // Car wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
        
        const wheelPositions = [
            [-1, 0.5, -1.3],  // front-left
            [1, 0.5, -1.3],   // front-right
            [-1, 0.5, 1.3],   // back-left
            [1, 0.5, 1.3]     // back-right
        ];
        
        wheelPositions.forEach(position => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(...position);
            wheel.rotation.z = Math.PI / 2;
            carGroup.add(wheel);
        });
        
        // Headlights
        const headlightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        
        const headlightPositions = [
            [-0.6, 0.7, -2],  // left headlight
            [0.6, 0.7, -2]    // right headlight
        ];
        
        headlightPositions.forEach(position => {
            const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
            headlight.position.set(...position);
            carGroup.add(headlight);
            
            // Create headlight beams
            const spotLight = new THREE.SpotLight(0xffffcc, 1.5);
            spotLight.position.set(position[0], position[1], position[2]);
            spotLight.angle = 0.5; // Wider angle
            spotLight.penumbra = 0.7;
            spotLight.distance = 50; // Increased visibility distance
            spotLight.target.position.set(position[0], 0, -50);
            spotLight.castShadow = true;
            carGroup.add(spotLight);
            carGroup.add(spotLight.target);
            this.headlights.push(spotLight);
        });
        
        // Add a higher spotlight to see further ahead
        const highBeamLight = new THREE.SpotLight(0xaaaaff, 0.7);
        highBeamLight.position.set(0, 3, 0);
        highBeamLight.angle = 0.6;
        highBeamLight.penumbra = 0.5;
        highBeamLight.distance = 80;
        highBeamLight.target.position.set(0, 0, -80);
        carGroup.add(highBeamLight);
        carGroup.add(highBeamLight.target);
        this.headlights.push(highBeamLight);
        
        // Position the car
        carGroup.position.y = 0.5;
        carGroup.position.z = -5;
        this.scene.add(carGroup);
        this.playerCar = carGroup;
    }
    
    createBuildings() {
        // Create simple buildings on both sides of the road
        const buildingColors = [0x444444, 0x555555, 0x666666, 0x777777];
        const roadHalfWidth = this.settings.roadWidth / 2;
        const buildingMargin = 2;
        
        for (let i = 0; i < this.settings.buildingCount; i++) {
            for (let side = -1; side <= 1; side += 2) {
                if (Math.random() < 0.7) { // 70% chance to place a building
                    const height = 3 + Math.random() * 10;
                    const width = 3 + Math.random() * 5;
                    const depth = 3 + Math.random() * 5;
                    
                    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
                    const buildingMaterial = new THREE.MeshStandardMaterial({
                        color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
                        roughness: 0.8
                    });
                    
                    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
                    
                    const x = side * (roadHalfWidth + buildingMargin + width / 2);
                    const z = -i * 20 - Math.random() * 10;
                    
                    building.position.set(x, height / 2, z);
                    this.scene.add(building);
                    this.buildings.push(building);
                    
                    // Add simple windows (just a pattern on the building)
                    if (Math.random() > 0.3) {
                        const windowPattern = this.createWindowPattern(width, height, depth);
                        // Add as child of building instead of separate object
                        building.add(windowPattern);
                    }
                }
            }
        }
    }
    
    createWindowPattern(width, height, depth) {
        const group = new THREE.Group();
        const windowGeometry = new THREE.PlaneGeometry(0.6, 0.8);
        const windowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffcc, 
            opacity: 0.7, 
            transparent: true 
        });
        
        // Calculate rows and columns based on building size
        const rows = Math.floor(height / 1.5);
        const cols = Math.floor(width / 1.2);
        
        // Front windows
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (Math.random() < 0.7) { // Some windows are dark
                    const window = new THREE.Mesh(windowGeometry, windowMaterial);
                    window.position.x = -width/2 + 0.7 + col * 1.2;
                    window.position.y = -height/2 + 1.2 + row * 1.5;
                    window.position.z = depth/2 + 0.01;
                    group.add(window);
                }
            }
        }
        
        // Side windows (fewer)
        const sideRows = Math.floor(height / 2);
        const sideCols = Math.floor(depth / 1.5);
        
        for (let row = 0; row < sideRows; row++) {
            for (let col = 0; col < sideCols; col++) {
                if (Math.random() < 0.5) { // Even fewer windows on sides
                    const window = new THREE.Mesh(windowGeometry, windowMaterial);
                    window.position.z = -depth/2 + 0.7 + col * 1.5;
                    window.position.y = -height/2 + 1.5 + row * 2;
                    window.position.x = width/2 + 0.01;
                    window.rotation.y = Math.PI / 2;
                    group.add(window);
                }
            }
        }
        
        return group;
    }
    
    spawnObstacle() {
        if (this.obstacles.length >= this.settings.maxObstacles) return;
        
        // Only spawn a new obstacle with a higher probability for more frequent spawning
        if (Math.random() > 0.25) return;
        
        // Get all current obstacle lane positions at a similar distance
        const farDistance = -this.settings.roadLength * 0.4; // Spawn much closer to player
        
        // Four lanes: -1.5, -0.5, 0.5, 1.5
        // Convert to lane positions: -6, -2, 2, 6
        const lanes = [-1.5, -0.5, 0.5, 1.5];
        
        // Initialize lane weights with equal probabilities
        let laneWeights = [0.25, 0.25, 0.25, 0.25];
        
        // If we've spawned a car before, adjust weights to favor different lanes
        if (this.lastSpawnedLane !== null) {
            // Find index of last spawned lane
            const lastIndex = lanes.indexOf(this.lastSpawnedLane);
            if (lastIndex !== -1) {
                // Reduce probability of the last lane by 60%
                laneWeights[lastIndex] *= 0.4;
                
                // Distribute the remaining probability to other lanes
                const remainingProbability = 1 - laneWeights[lastIndex];
                const otherLaneCount = lanes.length - 1;
                
                for (let i = 0; i < lanes.length; i++) {
                    if (i !== lastIndex) {
                        laneWeights[i] = remainingProbability / otherLaneCount;
                    }
                }
            }
        }
        
        // Generate a cumulative probability distribution
        const cumulativeProbabilities = [];
        let sum = 0;
        for (const weight of laneWeights) {
            sum += weight;
            cumulativeProbabilities.push(sum);
        }
        
        // Choose a lane based on the weighted probabilities
        const random = Math.random();
        let laneIndex = 0;
        for (let i = 0; i < cumulativeProbabilities.length; i++) {
            if (random <= cumulativeProbabilities[i]) {
                laneIndex = i;
                break;
            }
        }
        
        const lane = lanes[laneIndex];
        
        // Update the last spawned lane
        this.lastSpawnedLane = lane;
        
        // Check if there's enough space in this lane
        let canSpawn = true;
        const minSafeDistance = 30; // Doubled from 15 to provide much more space between cars
        
        // Apply road curve to the spawn position
        const distanceFactor = (farDistance + this.settings.roadLength) / this.settings.roadLength;
        const curveAmount = this.roadCurve * distanceFactor * 40;
        
        // Check if there's enough space around this potential new car
        this.obstacles.forEach(obstacle => {
            const zDistance = Math.abs(obstacle.position.z - farDistance);
            const xDistance = Math.abs(obstacle.position.x - ((lane * 4) + curveAmount));
            
            // If another car is too close (in any direction), don't spawn in this lane
            if (zDistance < minSafeDistance && xDistance < 6) {
                canSpawn = false;
            }
        });
        
        // If we can't spawn safely, try again later
        if (!canSpawn) return;
        
        // Debug log
        console.log("Spawning car in lane:", lane);
        
        // Create a simple car as an obstacle
        const obstacleGroup = new THREE.Group();
        
        // Random car color
        const carColors = [0x0000ff, 0x00ff00, 0xffff00, 0x00ffff, 0xff00ff];
        const carColor = carColors[Math.floor(Math.random() * carColors.length)];
        
        // Car body
        const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: carColor });
        const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
        carBody.position.y = 0.5;
        obstacleGroup.add(carBody);
        
        // Car roof
        const roofGeometry = new THREE.BoxGeometry(1.5, 0.7, 2);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: carColor });
        const carRoof = new THREE.Mesh(roofGeometry, roofMaterial);
        carRoof.position.y = 1.35;
        carRoof.position.z = 0.5;
        obstacleGroup.add(carRoof);
        
        // Car wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
        
        const wheelPositions = [
            [-1, 0.5, -1.3],  // front-left
            [1, 0.5, -1.3],   // front-right
            [-1, 0.5, 1.3],   // back-left
            [1, 0.5, 1.3]     // back-right
        ];
        
        wheelPositions.forEach(position => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(...position);
            wheel.rotation.z = Math.PI / 2;
            obstacleGroup.add(wheel);
        });
        
        // Add brake lights
        const brakeLightGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.1);
        const brakeLightMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        
        const leftBrakeLight = new THREE.Mesh(brakeLightGeometry, brakeLightMaterial);
        leftBrakeLight.position.set(-0.6, 0.7, 1.9);
        obstacleGroup.add(leftBrakeLight);
        
        const rightBrakeLight = new THREE.Mesh(brakeLightGeometry, brakeLightMaterial);
        rightBrakeLight.position.set(0.6, 0.7, 1.9);
        obstacleGroup.add(rightBrakeLight);
        
        // Position the obstacle with some random variation in distance
        // Apply the curve amount to the x position
        obstacleGroup.position.set((lane * 4) + curveAmount, 0.5, farDistance - (Math.random() * 10));
        
        // Rotate to follow the curve
        const curveDirection = Math.sign(this.roadCurve);
        const rotationFactor = distanceFactor * Math.abs(this.roadCurve) * 1.5;
        obstacleGroup.rotation.y = Math.PI - curveDirection * rotationFactor;
        
        // Add some random movement behavior - most cars won't change lanes
        obstacleGroup.userData = {
            lane: lane,
            speed: this.settings.obstacleSpeed * (0.7 + Math.random() * 0.6), // Random speed variation
            changeLaneCounter: 0,
            changeLaneInterval: Math.floor(Math.random() * 300) + 100, // Random interval for lane changes
            isBlinking: false,
            // Only 15% of cars can change lanes to ensure plenty of clear paths
            canChangeLane: Math.random() > 0.85
        };
        
        // Add blinkers to the car
        this.addBlinkers(obstacleGroup);
        
        this.scene.add(obstacleGroup);
        this.obstacles.push(obstacleGroup);
    }
    
    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            switch (event.key.toLowerCase()) {
                case 'a':
                case 'arrowleft':
                    this.moveLeft = true;
                    break;
                case 'd':
                case 'arrowright':
                    this.moveRight = true;
                    break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch (event.key.toLowerCase()) {
                case 'a':
                case 'arrowleft':
                    this.moveLeft = false;
                    break;
                case 'd':
                case 'arrowright':
                    this.moveRight = false;
                    break;
            }
        });
    }
    
    updatePlayerPosition() {
        // Update player's horizontal position based on input
        const moveSpeed = 0.15;
        
        // Calculate road curve at player position
        const playerCurveAmount = this.roadCurve * 40;
        
        // Calculate the maximum lane positions accounting for guardrails
        const minLanePosition = -1.5; // Leftmost lane
        const maxLanePosition = 1.5;  // Rightmost lane
        
        // Adjust left/right movement accounting for road boundaries
        if (this.moveLeft) {
            this.playerPosition = Math.max(this.playerPosition - moveSpeed, minLanePosition);
        }
        
        if (this.moveRight) {
            this.playerPosition = Math.min(this.playerPosition + moveSpeed, maxLanePosition);
        }
        
        // Apply the position to the car, including road curve
        const targetX = (this.playerPosition * 4) + playerCurveAmount;
        this.playerCar.position.x += (targetX - this.playerCar.position.x) * 0.1;
        
        // Add rotation when turning for fluid driving effect
        const maxRotation = 0.3; // Maximum rotation in radians (about 17 degrees)
        
        if (this.moveLeft && !this.moveRight) {
            // Turning left - rotate on Y axis
            const targetRotationY = maxRotation;
            this.playerCar.rotation.y += (targetRotationY - this.playerCar.rotation.y) * 0.1;
            
            // Add a slight tilt for visual effect
            this.playerCar.rotation.z = 0.1;
        } else if (this.moveRight && !this.moveLeft) {
            // Turning right - rotate on Y axis
            const targetRotationY = -maxRotation;
            this.playerCar.rotation.y += (targetRotationY - this.playerCar.rotation.y) * 0.1;
            
            // Add a slight tilt for visual effect
            this.playerCar.rotation.z = -0.1;
        } else {
            // Return to straight, but follow the road curve
            const curveDirection = -Math.sign(this.roadCurve); // Negative to turn in the curve direction
            const curveRotation = curveDirection * Math.abs(this.roadCurve) * 1.5;
            
            // Ease towards the curve rotation
            this.playerCar.rotation.y += (curveRotation - this.playerCar.rotation.y) * 0.1;
            this.playerCar.rotation.z *= 0.9; // Return to upright
        }
        
        // Update camera to follow the car, staying centered on the curved road
        this.camera.position.x = this.playerCar.position.x;
        
        // Check if player hit guardrails
        this.checkGuardrailCollision();
    }
    
    checkGuardrailCollision() {
        // Calculate road width and player position
        const roadHalfWidth = this.settings.roadWidth / 2;
        const carHalfWidth = 1; // Half width of the car
        
        // Calculate the current road curve at player position
        const playerZ = this.playerCar.position.z;
        const distanceFactor = (playerZ + this.settings.roadLength) / this.settings.roadLength;
        const curveAmount = this.roadCurve * distanceFactor * 40;
        
        // Calculate the left and right guardrail positions
        const leftGuardrailX = -roadHalfWidth + curveAmount;
        const rightGuardrailX = roadHalfWidth + curveAmount;
        
        // Check if car is hitting left guardrail
        if (this.playerCar.position.x - carHalfWidth < leftGuardrailX) {
            // Collision with left guardrail - bounce back and simulate impact
            this.playerCar.position.x = leftGuardrailX + carHalfWidth;
            this.playerPosition = (this.playerCar.position.x - curveAmount) / 4;
            
            // Visual effect for guardrail collision
            this.createGuardrailCollisionEffect(true);
        }
        
        // Check if car is hitting right guardrail
        if (this.playerCar.position.x + carHalfWidth > rightGuardrailX) {
            // Collision with right guardrail - bounce back and simulate impact
            this.playerCar.position.x = rightGuardrailX - carHalfWidth;
            this.playerPosition = (this.playerCar.position.x - curveAmount) / 4;
            
            // Visual effect for guardrail collision
            this.createGuardrailCollisionEffect(false);
        }
    }
    
    createGuardrailCollisionEffect(isLeft) {
        // Simple sparks effect when hitting guardrail
        const sparksCount = 5 + Math.floor(Math.random() * 10);
        const sparkColor = 0xffff00; // Yellow sparks
        
        for (let i = 0; i < sparksCount; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 4, 4),
                new THREE.MeshBasicMaterial({ color: sparkColor })
            );
            
            // Position at the collision point
            const side = isLeft ? -1 : 1;
            spark.position.set(
                this.playerCar.position.x + side * 0.5, 
                0.5 + Math.random(), 
                this.playerCar.position.z - 1 + Math.random() * 2
            );
            
            // Add to scene
            this.scene.add(spark);
            
            // Animate and remove after a short time
            const direction = new THREE.Vector3(
                side * (0.2 + Math.random() * 0.3),
                0.3 + Math.random() * 0.5,
                -0.2 + Math.random() * 0.4
            );
            
            // Store the direction in userData
            spark.userData = { direction: direction, life: 10 + Math.random() * 20 };
            
            // Add to a list for animation
            if (!this.collisionSparks) {
                this.collisionSparks = [];
            }
            this.collisionSparks.push(spark);
        }
    }
    
    updateRoadCurve() {
        // Decrease time until next curve change
        this.curveChangeTime -= 0.016;
        
        // Change curve direction randomly
        if (this.curveChangeTime <= 0) {
            // Set a new target curve - small random value
            this.targetRoadCurve = (Math.random() - 0.5) * 0.2;
            
            // Set a new random time until next curve change (5-15 seconds)
            this.curveChangeTime = 5 + Math.random() * 10;
        }
        
        // Ease towards target curve
        this.roadCurve += (this.targetRoadCurve - this.roadCurve) * 0.005;
    }
    
    updateRoad() {
        // Update road curve
        this.updateRoadCurve();
        
        // Move road segments to create illusion of forward movement
        this.roadSegments.forEach((segment, index) => {
            segment.position.z += this.settings.carSpeed;
            
            // Apply curve to road based on distance from player
            // Further segments curve more to create a bending road effect
            const distanceFactor = (segment.position.z + this.settings.roadLength) / this.settings.roadLength;
            const curveAmount = this.roadCurve * distanceFactor * 40; // Scale the curve effect
            
            // Apply curve to road segment position
            segment.position.x = curveAmount;
            
            // If segment is behind the camera, move it to the front
            if (segment.position.z > 10) {
                segment.position.z -= this.settings.roadLength;
            }
        });
        
        // Update boundary walls (guardrails)
        this.boundaryWalls.forEach((guardrail, index) => {
            // Move guardrail forward
            guardrail.position.z += this.settings.carSpeed;
            
            // Calculate the distance factor for curve
            const distanceFactor = (guardrail.position.z + this.settings.roadLength) / this.settings.roadLength;
            
            // Calculate the curve amount based on distance
            const curveAmount = this.roadCurve * distanceFactor * 40;
            
            // Determine if this is a left (even index) or right (odd index) guardrail
            const isRight = index % 2 === 1;
            const side = isRight ? 1 : -1;
            const roadHalfWidth = this.settings.roadWidth / 2;
            
            // Apply curve to guardrail position
            guardrail.position.x = (side * (roadHalfWidth + 0.5)) + curveAmount;
            
            // Calculate the look-ahead curve for rotation
            const lookAheadDistance = 10;
            const lookAheadFactor = ((guardrail.position.z + lookAheadDistance) + this.settings.roadLength) / this.settings.roadLength;
            const lookAheadCurve = this.roadCurve * lookAheadFactor * 40;
            
            // Calculate the angle to rotate the guardrail
            const currentPos = guardrail.position.x;
            const lookAheadPos = (side * (roadHalfWidth + 0.5)) + lookAheadCurve;
            const angle = Math.atan2(lookAheadPos - currentPos, lookAheadDistance) * 0.5;
            
            // Apply rotation
            guardrail.rotation.y = angle;
            
            // If guardrail is behind the camera, move it to the front
            if (guardrail.position.z > 20) {
                guardrail.position.z -= this.settings.roadLength;
                
                // Update the curve for the reset position
                const newDistanceFactor = (guardrail.position.z + this.settings.roadLength) / this.settings.roadLength;
                const newCurveAmount = this.roadCurve * newDistanceFactor * 40;
                guardrail.position.x = (side * (roadHalfWidth + 0.5)) + newCurveAmount;
            }
        });
        
        // Move buildings to create illusion of forward movement
        this.buildings.forEach(building => {
            building.position.z += this.settings.carSpeed;
            
            // Apply curve effect to buildings too
            const distanceFactor = (building.position.z + this.settings.roadLength) / this.settings.roadLength;
            const baseSide = building.userData?.side || (building.position.x > 0 ? 1 : -1);
            const curveAmount = this.roadCurve * distanceFactor * 40;
            
            // Update building position based on curve
            building.position.x = baseSide * (this.settings.roadWidth/2 + 2) + curveAmount;
            
            // If building is behind the camera, remove it
            if (building.position.z > 20) {
                this.scene.remove(building);
                
                // Create a new building at the far end
                const side = Math.random() > 0.5 ? -1 : 1;
                const height = 3 + Math.random() * 10;
                const width = 3 + Math.random() * 5;
                const depth = 3 + Math.random() * 5;
                
                const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
                const buildingColors = [0x444444, 0x555555, 0x666666, 0x777777];
                const buildingMaterial = new THREE.MeshStandardMaterial({
                    color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
                    roughness: 0.8
                });
                
                const newBuilding = new THREE.Mesh(buildingGeometry, buildingMaterial);
                
                // Store the original side for curve calculations
                newBuilding.userData = { side: side };
                
                const roadHalfWidth = this.settings.roadWidth / 2;
                const buildingMargin = 2;
                
                // Position at the far end with curve applied
                const farDistanceFactor = 1.0; // Maximum distance
                const farCurveAmount = this.roadCurve * farDistanceFactor * 40;
                const x = side * (roadHalfWidth + buildingMargin + width / 2) + farCurveAmount;
                const z = -this.settings.roadLength + Math.random() * 20;
                
                newBuilding.position.set(x, height / 2, z);
                this.scene.add(newBuilding);
                
                // Replace the old building in the array
                const index = this.buildings.indexOf(building);
                if (index !== -1) {
                    this.buildings[index] = newBuilding;
                }
                
                // Add windows to new building (as child)
                if (Math.random() > 0.3) {
                    const windowPattern = this.createWindowPattern(width, height, depth);
                    newBuilding.add(windowPattern);
                }
            }
        });
        
        // Update distance counter
        this.distance += this.settings.carSpeed;
    }
    
    checkCollision(obj1, obj2) {
        // Simple box collision detection
        const box1 = new THREE.Box3().setFromObject(obj1);
        const box2 = new THREE.Box3().setFromObject(obj2);
        
        return box1.intersectsBox(box2);
    }
    
    animate() {
        if (this.gameOver) return;
        
        requestAnimationFrame(() => this.animate());
        
        // Update time counter
        this.time += 0.016; // Roughly 60fps
        
        // Update game elements
        this.updatePlayerPosition();
        this.updateRoad();
        this.updateObstacles();
        this.updateVisualEffects();
        this.updateCollisionSparks(); // Update collision spark effects
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
    
    updateCollisionSparks() {
        // Skip if no collision sparks
        if (!this.collisionSparks || this.collisionSparks.length === 0) return;
        
        // Update each spark's position and life
        for (let i = this.collisionSparks.length - 1; i >= 0; i--) {
            const spark = this.collisionSparks[i];
            
            // Move spark based on its direction
            spark.position.x += spark.userData.direction.x;
            spark.position.y += spark.userData.direction.y;
            spark.position.z += spark.userData.direction.z;
            
            // Add gravity effect
            spark.userData.direction.y -= 0.02;
            
            // Reduce life and fade out
            spark.userData.life--;
            
            if (spark.userData.life <= 0) {
                // Remove from scene and array
                this.scene.remove(spark);
                this.collisionSparks.splice(i, 1);
            } else if (spark.userData.life < 10) {
                // Fade out as life decreases
                const scale = spark.userData.life / 10;
                spark.scale.set(scale, scale, scale);
            }
        }
    }
    
    updateVisualEffects() {
        // Headlight flicker effect (subtle)
        this.headlights.forEach(light => {
            // Random flicker intensity based on sine wave + noise
            const flickerAmount = Math.sin(this.time * 10) * 0.1 + Math.random() * 0.1;
            light.intensity = 1 + flickerAmount;
        });
        
        // Add slight camera shake for more immersion
        const shakeAmount = 0.03;
        if (this.settings.carSpeed > 0.8) {
            this.camera.position.y = this.settings.cameraHeight + (Math.random() - 0.5) * shakeAmount;
            this.camera.position.x = (Math.random() - 0.5) * shakeAmount;
        }
    }
    
    playCrashAnimation() {
        // Create a crash effect
        this.gameOver = true;
        
        // Add a flash effect
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = 'white';
        flash.style.opacity = '0';
        flash.style.transition = 'opacity 0.1s ease-in-out';
        flash.style.zIndex = '1000';
        document.body.appendChild(flash);
        
        // Flash effect
        setTimeout(() => {
            flash.style.opacity = '1';
            
            // Add a dramatic text
            const crashText = document.createElement('div');
            crashText.textContent = 'YOU CRASHED';
            crashText.style.position = 'fixed';
            crashText.style.top = '50%';
            crashText.style.left = '50%';
            crashText.style.transform = 'translate(-50%, -50%)';
            crashText.style.color = 'red';
            crashText.style.fontSize = '64px';
            crashText.style.fontWeight = 'bold';
            crashText.style.fontFamily = 'Arial, sans-serif';
            crashText.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.7)';
            crashText.style.opacity = '0';
            crashText.style.transition = 'opacity 0.5s ease-in-out';
            crashText.style.zIndex = '1001';
            document.body.appendChild(crashText);
            
            setTimeout(() => {
                flash.style.opacity = '0.8';
                crashText.style.opacity = '1';
                
                // Add secondary text
                const subText = document.createElement('div');
                subText.textContent = '';
                subText.style.position = 'fixed';
                subText.style.top = '60%';
                subText.style.left = '50%';
                subText.style.transform = 'translate(-50%, -50%)';
                subText.style.color = 'red';
                subText.style.fontSize = '32px';
                subText.style.fontWeight = 'bold';
                subText.style.fontFamily = 'Arial, sans-serif';
                subText.style.opacity = '0';
                subText.style.transition = 'opacity 0.5s ease-in-out';
                subText.style.zIndex = '1001';
                document.body.appendChild(subText);
                
                setTimeout(() => {
                    subText.style.opacity = '1';
                    
                    // After a delay, end the game
                    setTimeout(() => {
                        this.endGame();
                    }, 2000);
                }, 500);
            }, 100);
        }, 50);
    }
    
    updateObstacles() {
        // Move existing obstacles and remove those behind the player
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            const userData = obstacle.userData;
            
            // Move obstacle forward relative to player
            obstacle.position.z += this.settings.carSpeed - userData.speed;
            
            // Apply road curve to obstacles
            const distanceFactor = (obstacle.position.z + this.settings.roadLength) / this.settings.roadLength;
            const baseCurveAmount = this.roadCurve * distanceFactor * 40;
            
            // Only allow lane changes for isolated cars and ensure there's always a clear path
            if (userData.canChangeLane) {
                userData.changeLaneCounter++;
                if (userData.changeLaneCounter >= userData.changeLaneInterval) {
                    userData.changeLaneCounter = 0;
                    
                    // Decide whether to change lanes
                    if (Math.random() > 0.7) {
                        // Choose a new lane among the 4 lanes: -1.5, -0.5, 0.5, 1.5
                        const currentLane = userData.lane;
                        
                        // Get adjacent lanes only (more realistic lane changes)
                        const possibleNewLanes = [];
                        
                        // Left lane if not already in leftmost lane
                        if (currentLane > -1.5) {
                            possibleNewLanes.push(currentLane - 1);
                        }
                        
                        // Right lane if not already in rightmost lane
                        if (currentLane < 1.5) {
                            possibleNewLanes.push(currentLane + 1);
                        }
                        
                        // Choose a random adjacent lane
                        const newLane = possibleNewLanes[Math.floor(Math.random() * possibleNewLanes.length)];
                        
                        // Check if this car is isolated (no other cars nearby)
                        let isIsolated = true;
                        let willBlockAllPaths = false;
                        const nearZ = obstacle.position.z;
                        
                        // Get all occupied lanes at similar Z positions
                        const occupiedLanes = new Set();
                        
                        this.obstacles.forEach(otherObstacle => {
                            if (otherObstacle === obstacle) return;
                            
                            // Check for nearby cars (in any direction)
                            const zDistance = Math.abs(otherObstacle.position.z - nearZ);
                            if (zDistance < 12) {
                                // There's another car nearby
                                isIsolated = false;
                                
                                // Track occupied lanes
                                const otherLane = otherObstacle.userData.lane;
                                if (otherLane >= -1.5 && otherLane <= 1.5) {
                                    occupiedLanes.add(otherLane);
                                }
                            }
                        });
                        
                        // For 4 lanes, we don't need to check if all paths are blocked
                        // Just make sure the target lane is clear
                        willBlockAllPaths = occupiedLanes.has(newLane);
                        
                        // Only change lanes if the car is isolated AND target lane is clear
                        if (isIsolated && !willBlockAllPaths) {
                            // Start blinking before changing lanes
                            userData.isBlinking = true;
                            userData.blinkStartTime = this.time;
                            userData.blinkDuration = 1.5; // seconds
                            userData.targetLane = newLane;
                            
                            // Add blinker lights if they don't exist
                            if (!userData.leftBlinker || !userData.rightBlinker) {
                                this.addBlinkers(obstacle);
                            }
                            
                            // Activate the correct blinker
                            if (newLane < currentLane) {
                                // Turning left
                                userData.leftBlinker.visible = true;
                                userData.rightBlinker.visible = false;
                            } else {
                                // Turning right
                                userData.leftBlinker.visible = false;
                                userData.rightBlinker.visible = true;
                            }
                        }
                    }
                }
            }
            
            // Handle lane changing animation if blinking
            if (userData.isBlinking) {
                // Blink the turn signal
                const blinkPhase = Math.sin(this.time * 10) > 0;
                
                if (userData.leftBlinker) {
                    userData.leftBlinker.visible = userData.leftBlinker.visible && blinkPhase;
                }
                if (userData.rightBlinker) {
                    userData.rightBlinker.visible = userData.rightBlinker.visible && blinkPhase;
                }
                
                // Check if blink time is over
                const elapsedTime = this.time - userData.blinkStartTime;
                if (elapsedTime >= userData.blinkDuration) {
                    // Stop blinking and execute the lane change
                    userData.isBlinking = false;
                    userData.lane = userData.targetLane;
                    
                    // Turn off blinkers
                    if (userData.leftBlinker) userData.leftBlinker.visible = false;
                    if (userData.rightBlinker) userData.rightBlinker.visible = false;
                }
            }
            
            // Smoothly move to target lane along the curved road
            const targetX = userData.lane * 4 + baseCurveAmount;
            obstacle.position.x += (targetX - obstacle.position.x) * 0.05;
            
            // Rotate the obstacle to follow the road curve
            const curveDirection = Math.sign(this.roadCurve);
            const rotationFactor = distanceFactor * Math.abs(this.roadCurve) * 1.5;
            obstacle.rotation.y = Math.PI - curveDirection * rotationFactor;
            
            // Check collision with player
            if (this.checkCollision(this.playerCar, obstacle)) {
                this.playCrashAnimation();
                break;
            }
            
            // Remove obstacles that are behind the player
            if (obstacle.position.z > 10) {
                this.scene.remove(obstacle);
                this.obstacles.splice(i, 1);
            }
        }
        
        // Spawn new obstacles
        this.spawnObstacle();
    }
    
    // Add blinkers to a car obstacle
    addBlinkers(carObstacle) {
        const userData = carObstacle.userData;
        
        // Create blinker lights (left)
        const leftBlinkerGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.1);
        const blinkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const leftBlinker = new THREE.Mesh(leftBlinkerGeometry, blinkerMaterial);
        leftBlinker.position.set(-1.1, 0.7, -2);
        leftBlinker.visible = false;
        carObstacle.add(leftBlinker);
        userData.leftBlinker = leftBlinker;
        
        // Create blinker lights (right)
        const rightBlinker = new THREE.Mesh(leftBlinkerGeometry, blinkerMaterial);
        rightBlinker.position.set(1.1, 0.7, -2);
        rightBlinker.visible = false;
        carObstacle.add(rightBlinker);
        userData.rightBlinker = rightBlinker;
    }
    
    endGame() {
        // Cleanup
        document.body.removeChild(this.renderer.domElement);
        
        // Set a flag in sessionStorage to indicate we're coming from the driving game
        sessionStorage.setItem('fromDrivingGame', 'true');
        
        // Get full repository path for GitHub Pages
        const fullPath = window.location.pathname;
        const repoName = fullPath.split('/')[1]; // Should get "CURSED-DEPTHS-3" for GitHub Pages
        let basePath = '';
        
        // Check if we're on GitHub Pages or local
        if (window.location.hostname.includes('github.io')) {
            // We're on GitHub Pages
            basePath = '/' + repoName;
        } else if (fullPath.includes('/driving-game/')) {
            // We're on localhost
            basePath = fullPath.substring(0, fullPath.indexOf('/driving-game'));
        }
        
        // Navigate directly to the main index - no dialog scene
        window.location.href = basePath + '/index.html';
    }
}

// Initialize game once the page is loaded
window.onload = function() {
    window.startMainGame = function() {
        // Get full repository path for GitHub Pages
        const fullPath = window.location.pathname;
        const repoName = fullPath.split('/')[1]; // Should get "CURSED-DEPTHS-3" for GitHub Pages
        let basePath = '';
        
        // Check if we're on GitHub Pages or local
        if (window.location.hostname.includes('github.io')) {
            // We're on GitHub Pages
            basePath = '/' + repoName;
        } else if (fullPath.includes('/driving-game/')) {
            // We're on localhost
            basePath = fullPath.substring(0, fullPath.indexOf('/driving-game'));
        }
        
        // Navigate directly to the main index - no dialog scene
        window.location.href = basePath + '/index.html';
    };
    
    // Start the driving game
    new DrivingGame();
};

export { DrivingGame }; 