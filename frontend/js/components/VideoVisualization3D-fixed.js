// 3D Visualization component using Three.js (global version)
// Expects THREE and OrbitControls to be available globally

export class VideoVisualization3D {
    constructor({ container, eventBus, apiClient }) {
        this.container = container;
        this.eventBus = eventBus;
        this.apiClient = apiClient;
        
        // Check if THREE is available
        if (typeof THREE === 'undefined') {
            throw new Error('THREE.js is not loaded. Please include Three.js before this module.');
        }
        
        // Three.js scene components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Point cloud data
        this.pointCloud = null;
        this.points = [];
        this.videoData = [];
        
        // Interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredPoint = null;
        this.selectedPoint = null;
        
        // Performance
        this.lastRenderTime = 0;
        this.renderStats = {
            fps: 0,
            frameTime: 0,
            pointsRendered: 0
        };
        
        // Visual settings
        this.settings = {
            pointSize: 3,
            pointOpacity: 0.8,
            showGrid: true,
            showAxes: false,
            animatePoints: true,
            highlightAnomalies: false,
            anomalyThreshold: 0.5
        };
        
        // Color mapping for event types
        this.eventColors = {
            'normal-driving': 0x4CAF50,
            'accident': 0xF44336,
            'abrupt-overtaking': 0xFF9800,
            'pedestrian-crossing': 0x2196F3,
            'unknown': 0x9E9E9E
        };
        
        // Animation system
        this.animationMixer = null;
        this.activeAnimations = [];
    }
    
    async init() {
        try {
            console.log('🎨 Initializing 3D Visualization...');
            console.log('Container element:', this.container);
            console.log('Container dimensions:', {
                width: this.container.clientWidth,
                height: this.container.clientHeight,
                offsetWidth: this.container.offsetWidth,
                offsetHeight: this.container.offsetHeight
            });
            
            // Ensure container has dimensions
            if (this.container.clientWidth === 0 || this.container.clientHeight === 0) {
                console.warn('Container has no dimensions, setting default size');
                this.container.style.width = '100%';
                this.container.style.height = '600px';
                this.container.style.display = 'block';
            }
            
            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupControls();
            this.setupLighting();
            this.setupEventListeners();
            this.setupRaycasting();
            
            console.log('✅ 3D Visualization initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize 3D visualization:', error);
            console.error('Error details:', error.stack);
            throw error;
        }
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        
        // Dark space background with subtle gradient
        this.scene.background = new THREE.Color(0x0a0a0a);
        
        // Add subtle fog for depth perception
        this.scene.fog = new THREE.Fog(0x0a0a0a, 100, 300);
        
        // Add coordinate system helper (for development)
        if (localStorage.getItem('debug') === 'true') {
            const axesHelper = new THREE.AxesHelper(20);
            this.scene.add(axesHelper);
        }
    }
    
    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        
        // Position camera for good initial view
        this.camera.position.set(30, 30, 30);
        this.camera.lookAt(0, 0, 0);
        
        // Set up camera for optimal point cloud viewing
        this.camera.near = 0.1;
        this.camera.far = 500;
        this.camera.updateProjectionMatrix();
    }
    
    setupRenderer() {
        console.log('Setting up renderer...');
        console.log('Container is canvas?', this.container.tagName === 'CANVAS');
        
        const rendererConfig = {
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        };
        
        // If container is a canvas, use it directly
        if (this.container.tagName === 'CANVAS') {
            rendererConfig.canvas = this.container;
        }
        
        this.renderer = new THREE.WebGLRenderer(rendererConfig);
        
        // If container is not a canvas, append the renderer's canvas
        if (this.container.tagName !== 'CANVAS') {
            this.container.appendChild(this.renderer.domElement);
        }
        
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;
        
        console.log(`Setting renderer size: ${width}x${height}`);
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Optimize for point cloud rendering
        this.renderer.sortObjects = false;
        this.renderer.autoClear = true;
        
        // Enable shadow mapping for better visual quality
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Set tone mapping for better colors
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        console.log('Renderer setup complete');
    }
    
    setupControls() {
        // Use global OrbitControls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // Configure controls for smooth interaction
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;
        
        // Set reasonable boundaries
        this.controls.minDistance = 10;
        this.controls.maxDistance = 200;
        
        // Enable all interactions
        this.controls.enableRotate = true;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        
        // Set target to center of point cloud
        this.controls.target.set(0, 0, 0);
        
        console.log('Controls setup complete');
    }
    
    setupLighting() {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light for shadows and depth
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);
        
        // Point light for highlight effects
        this.highlightLight = new THREE.PointLight(0xffffff, 0, 20);
        this.highlightLight.visible = false;
        this.scene.add(this.highlightLight);
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Mouse events
        this.renderer.domElement.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this.handleClick(e));
        this.renderer.domElement.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        
        // Touch events for mobile
        this.renderer.domElement.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.renderer.domElement.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
    
    setupRaycasting() {
        // Configure raycaster for point picking
        this.raycaster.params.Points.threshold = 0.5;
    }
    
    async loadVideoData(videos) {
        console.log(`📊 Loading ${videos.length} videos into visualization...`);
        
        try {
            this.videoData = videos;
            
            // Create point cloud geometry
            const positions = [];
            const colors = [];
            const sizes = [];
            
            videos.forEach((video, index) => {
                // Use coordinates if available
                if (video.coordinates) {
                    positions.push(video.coordinates.x, video.coordinates.y, video.coordinates.z);
                } else {
                    // Fallback to random positions
                    positions.push(
                        (Math.random() - 0.5) * 50,
                        (Math.random() - 0.5) * 50,
                        (Math.random() - 0.5) * 50
                    );
                }
                
                // Color based on event type
                const eventType = video.main_event || video['main-event'] || 'unknown';
                const color = new THREE.Color(this.eventColors[eventType] || this.eventColors.unknown);
                colors.push(color.r, color.g, color.b);
                
                // Size based on anomaly score
                const anomalyScore = video.anomaly_score || 0;
                const size = this.settings.pointSize * (1 + anomalyScore);
                sizes.push(size);
            });
            
            // Create BufferGeometry
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
            
            // Create material
            const material = new THREE.PointsMaterial({
                size: this.settings.pointSize,
                vertexColors: true,
                opacity: this.settings.pointOpacity,
                transparent: true,
                sizeAttenuation: true,
                blending: THREE.AdditiveBlending
            });
            
            // Remove old point cloud if exists
            if (this.pointCloud) {
                this.scene.remove(this.pointCloud);
                this.pointCloud.geometry.dispose();
                this.pointCloud.material.dispose();
            }
            
            // Create new point cloud
            this.pointCloud = new THREE.Points(geometry, material);
            this.scene.add(this.pointCloud);
            
            // Update render stats
            this.renderStats.pointsRendered = videos.length;
            
            // Fit camera to point cloud
            this.fitCameraToPoints();
            
            console.log('✅ Video data loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load video data:', error);
            throw error;
        }
    }
    
    // ... rest of the methods remain the same ...
    
    render() {
        if (!this.renderer || !this.scene || !this.camera) return;
        
        // Update controls
        if (this.controls) {
            this.controls.update();
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
        
        // Update performance stats
        const now = performance.now();
        if (this.lastRenderTime) {
            const frameTime = now - this.lastRenderTime;
            this.renderStats.frameTime = frameTime;
            this.renderStats.fps = Math.round(1000 / frameTime);
        }
        this.lastRenderTime = now;
    }
    
    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    fitCameraToPoints() {
        if (!this.pointCloud) return;
        
        // Calculate bounding box
        const box = new THREE.Box3().setFromObject(this.pointCloud);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Position camera to see all points
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = maxDim / (2 * Math.tan(fov / 2));
        
        this.camera.position.set(
            center.x + distance * 0.5,
            center.y + distance * 0.5,
            center.z + distance
        );
        
        this.camera.lookAt(center);
        this.controls.target.copy(center);
    }
    
    handleMouseMove(event) {
        // Update mouse coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Perform raycasting for hover effects
        this.checkIntersections();
    }
    
    handleClick(event) {
        this.checkIntersections(true);
    }
    
    handleDoubleClick(event) {
        // Focus on clicked point
        if (this.hoveredPoint !== null) {
            const video = this.videoData[this.hoveredPoint];
            if (video && video.coordinates) {
                this.animateCameraToPoint(video.coordinates);
            }
        }
    }
    
    handleTouchStart(event) {
        // Handle touch events for mobile
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
            this.checkIntersections(true);
        }
    }
    
    handleTouchMove(event) {
        // Prevent default to avoid scrolling
        event.preventDefault();
    }
    
    handleKeyPress(event) {
        switch (event.key) {
            case 'r':
            case 'R':
                this.resetCamera();
                break;
            case 'g':
            case 'G':
                this.toggleGrid();
                break;
            case 'a':
            case 'A':
                this.toggleAxes();
                break;
        }
    }
    
    checkIntersections(isClick = false) {
        if (!this.pointCloud) return;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Check intersections
        const intersects = this.raycaster.intersectObject(this.pointCloud);
        
        if (intersects.length > 0) {
            const index = intersects[0].index;
            
            if (isClick) {
                // Handle click
                this.selectedPoint = index;
                const video = this.videoData[index];
                this.eventBus.emit('point.click', { video, index });
            } else {
                // Handle hover
                if (this.hoveredPoint !== index) {
                    this.hoveredPoint = index;
                    const video = this.videoData[index];
                    this.eventBus.emit('point.hover', { video, index });
                }
            }
        } else {
            // No intersection
            if (this.hoveredPoint !== null) {
                this.hoveredPoint = null;
                this.eventBus.emit('point.hover.end');
            }
        }
    }
    
    animateCameraToPoint(position, duration = 1000) {
        // Implement smooth camera animation
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        
        const endPosition = new THREE.Vector3(
            position.x + 20,
            position.y + 20,
            position.z + 20
        );
        const endTarget = new THREE.Vector3(position.x, position.y, position.z);
        
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease in-out
            const t = progress < 0.5 
                ? 2 * progress * progress 
                : -1 + (4 - 2 * progress) * progress;
            
            this.camera.position.lerpVectors(startPosition, endPosition, t);
            this.controls.target.lerpVectors(startTarget, endTarget, t);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    resetCamera() {
        this.fitCameraToPoints();
    }
    
    toggleGrid() {
        this.settings.showGrid = !this.settings.showGrid;
        // Implement grid visibility toggle
    }
    
    toggleAxes() {
        this.settings.showAxes = !this.settings.showAxes;
        // Implement axes visibility toggle
    }
    
    dispose() {
        // Clean up resources
        if (this.pointCloud) {
            this.scene.remove(this.pointCloud);
            this.pointCloud.geometry.dispose();
            this.pointCloud.material.dispose();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Remove event listeners
        window.removeEventListener('resize', () => this.handleResize());
        document.removeEventListener('keydown', (e) => this.handleKeyPress(e));
    }
}
// Make it globally available
window.VideoVisualization3D = VideoVisualization3D;
