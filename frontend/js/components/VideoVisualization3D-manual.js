// 3D Visualization component with manual camera controls
// Global export for non-module usage
window.VideoVisualization3D = class VideoVisualization3D {
    constructor({ container, eventBus, apiClient }) {
        this.container = container;
        this.eventBus = eventBus;
        this.apiClient = apiClient;
        
        // Three.js core objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Video data and visualization
        this.pointCloud = null;
        this.videoPoints = [];
        this.pointsMaterial = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Visual state
        this.hoveredPointIndex = -1;
        this.selectedPointIndex = -1;
        this.highlightedClusters = new Set();
        this.searchResults = [];
        this.anomalyHighlightEnabled = false;
        this.currentViewMode = 'clusters';
        
        // Performance optimization
        this.frustum = new THREE.Frustum();
        this.cameraMatrix = new THREE.Matrix4();
        this.visiblePointsCount = 0;
        
        // Interaction state
        this.isInteracting = false;
        this.lastInteractionTime = 0;
        this.interactionTimeout = null;
        
        // Color palettes
        this.clusterColors = new Map();
        this.eventTypeColors = {
            'normal-driving': 0x4CAF50,
            'accident': 0xF44336,
            'abrupt-overtaking': 0xFF9800,
            'pedestrian-crossing': 0x2196F3,
            'unknown': 0x9E9E9E
        };
    }
    
    async init() {
        try {
            console.log('🎨 Initializing 3D Visualization with manual controls...');
            
            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupManualControls();
            this.setupLighting();
            this.setupEventListeners();
            this.setupRaycasting();
            
            console.log('✅ 3D Visualization initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize 3D visualization:', error);
            throw error;
        }
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x121212);
        this.scene.fog = new THREE.Fog(0x121212, 100, 300);
    }
    
    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(50, 30, 50);
        this.camera.lookAt(0, 0, 0);
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);
        
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    setupManualControls() {
        // Create manual camera controls
        this.controls = {
            cameraDistance: 50,
            cameraAngleX: 0,
            cameraAngleY: Math.PI / 4,
            cameraTarget: new THREE.Vector3(0, 0, 0),
            isDragging: false,
            previousMousePosition: { x: 0, y: 0 },
            animating: false,
            enabled: true
        };
        
        const canvas = this.renderer.domElement;
        
        // Mouse down
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click only
                this.controls.isDragging = true;
                this.controls.previousMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
                canvas.style.cursor = 'grabbing';
                this.isInteracting = true;
            }
        });
        
        // Mouse move
        canvas.addEventListener('mousemove', (e) => {
            // Update mouse position for raycasting
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            
            if (this.controls.isDragging) {
                const deltaMove = {
                    x: e.clientX - this.controls.previousMousePosition.x,
                    y: e.clientY - this.controls.previousMousePosition.y
                };
                
                // Update camera angles
                this.controls.cameraAngleX += deltaMove.x * 0.01;
                this.controls.cameraAngleY -= deltaMove.y * 0.01;
                
                // Clamp vertical angle
                this.controls.cameraAngleY = Math.max(0.1, Math.min(Math.PI - 0.1, this.controls.cameraAngleY));
                
                this.updateCameraPosition();
                
                this.controls.previousMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
            } else {
                // Check for hover when not dragging
                this.checkHover(e);
            }
        });
        
        // Mouse up
        window.addEventListener('mouseup', () => {
            if (this.controls.isDragging) {
                this.controls.isDragging = false;
                canvas.style.cursor = 'grab';
                this.isInteracting = false;
                
                // Re-enable hover after a short delay
                setTimeout(() => {
                    this.lastInteractionTime = Date.now();
                }, 100);
            }
        });
        
        // Mouse wheel for zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.controls.cameraDistance += e.deltaY * 0.05;
            this.controls.cameraDistance = Math.max(10, Math.min(200, this.controls.cameraDistance));
            this.updateCameraPosition();
        });
        
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            if (!this.controls.enabled) return;
            
            switch(e.key) {
                case 'ArrowUp':
                    this.controls.cameraAngleY -= 0.1;
                    break;
                case 'ArrowDown':
                    this.controls.cameraAngleY += 0.1;
                    break;
                case 'ArrowLeft':
                    this.controls.cameraAngleX -= 0.1;
                    break;
                case 'ArrowRight':
                    this.controls.cameraAngleX += 0.1;
                    break;
            }
            
            this.controls.cameraAngleY = Math.max(0.1, Math.min(Math.PI - 0.1, this.controls.cameraAngleY));
            this.updateCameraPosition();
        });
        
        // Initial cursor
        canvas.style.cursor = 'grab';
    }
    
    updateCameraPosition() {
        if (this.controls.animating) return;
        
        // Calculate camera position from spherical coordinates
        const target = this.controls.cameraTarget;
        this.camera.position.x = target.x + this.controls.cameraDistance * Math.sin(this.controls.cameraAngleY) * Math.cos(this.controls.cameraAngleX);
        this.camera.position.y = target.y + this.controls.cameraDistance * Math.cos(this.controls.cameraAngleY);
        this.camera.position.z = target.z + this.controls.cameraDistance * Math.sin(this.controls.cameraAngleY) * Math.sin(this.controls.cameraAngleX);
        
        // Look at target
        this.camera.lookAt(target);
        
        // Update frustum for culling
        this.updateFrustum();
    }
    
    setupLighting() {
        // Ambient light for overall brightness
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light for shadows and depth
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(10, 10, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Grid helper
        const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x222222);
        this.scene.add(gridHelper);
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Mouse click for selection
        this.renderer.domElement.addEventListener('click', (e) => {
            if (!this.controls.isDragging) {
                this.handleClick(e);
            }
        });
        
        // Prevent context menu
        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    setupRaycasting() {
        // Raycaster params for point cloud
        this.raycaster.params.Points.threshold = 1;
    }
    
    async loadVideoData(videos) {
        console.log(`📊 Loading ${videos.length} videos into visualization...`);
        
        try {
            // Store video data
            this.videoPoints = videos;
            
            // Remove existing point cloud
            if (this.pointCloud) {
                this.scene.remove(this.pointCloud);
                this.pointCloud.geometry.dispose();
                this.pointCloud.material.dispose();
            }
            
            // Create geometry
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(videos.length * 3);
            const colors = new Float32Array(videos.length * 3);
            const sizes = new Float32Array(videos.length);
            
            // Fill positions and colors
            videos.forEach((video, i) => {
                // Position
                if (video.coordinates_3d) {
                    positions[i * 3] = video.coordinates_3d[0] * 10;
                    positions[i * 3 + 1] = video.coordinates_3d[1] * 10;
                    positions[i * 3 + 2] = video.coordinates_3d[2] * 10;
                } else {
                    // Random position if no coordinates
                    positions[i * 3] = (Math.random() - 0.5) * 40;
                    positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
                    positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
                }
                
                // Color based on anomaly score
                const anomaly = video.anomaly_score || 0;
                colors[i * 3] = anomaly;
                colors[i * 3 + 1] = 1 - anomaly;
                colors[i * 3 + 2] = 0.5;
                
                // Size based on anomaly
                sizes[i] = 3 + anomaly * 2;
            });
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
            
            // Create material
            this.pointsMaterial = new THREE.PointsMaterial({
                size: 3,
                vertexColors: true,
                sizeAttenuation: true,
                alphaTest: 0.5,
                transparent: true
            });
            
            // Create points
            this.pointCloud = new THREE.Points(geometry, this.pointsMaterial);
            this.scene.add(this.pointCloud);
            
            console.log('✅ Video data loaded into visualization');
            
            // Fit camera to all points
            this.fitAllPoints();
            
        } catch (error) {
            console.error('❌ Failed to load video data:', error);
            throw error;
        }
    }
    
    checkHover(event) {
        if (!this.pointCloud || this.isInteracting) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.pointCloud);
        
        if (intersects.length > 0) {
            const index = intersects[0].index;
            const video = this.videoPoints[index];
            
            if (index !== this.hoveredPointIndex) {
                this.hoveredPointIndex = index;
                
                // Emit hover event
                this.eventBus.emit('point.hover', {
                    videoId: video.video_id,
                    title: video.title,
                    main_event: video.main_event,
                    location: video.location,
                    anomaly_score: video.anomaly_score,
                    cluster_id: video.cluster_id,
                    coordinates: {
                        x: intersects[0].point.x,
                        y: intersects[0].point.y,
                        z: intersects[0].point.z
                    }
                });
            }
            
            this.renderer.domElement.style.cursor = 'pointer';
        } else {
            if (this.hoveredPointIndex !== -1) {
                this.hoveredPointIndex = -1;
                this.eventBus.emit('point.hover.end');
            }
            this.renderer.domElement.style.cursor = 'grab';
        }
    }
    
    handleClick(event) {
        if (!this.pointCloud) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.pointCloud);
        
        if (intersects.length > 0) {
            const index = intersects[0].index;
            const video = this.videoPoints[index];
            
            // Highlight point
            this.highlightPoint(index);
            
            // Animate camera to point
            const position = this.pointCloud.geometry.attributes.position.array;
            this.animateCameraToPoint({
                x: position[index * 3],
                y: position[index * 3 + 1],
                z: position[index * 3 + 2]
            });
            
            // Emit click event
            this.eventBus.emit('point.click', {
                videoId: video.video_id,
                video: video,
                coordinates: {
                    x: intersects[0].point.x,
                    y: intersects[0].point.y,
                    z: intersects[0].point.z
                }
            });
        }
    }
    
    highlightPoint(index) {
        const colors = this.pointCloud.geometry.attributes.color.array;
        
        // Reset previous selection
        if (this.selectedPointIndex >= 0) {
            const video = this.videoPoints[this.selectedPointIndex];
            const anomaly = video.anomaly_score || 0;
            colors[this.selectedPointIndex * 3] = anomaly;
            colors[this.selectedPointIndex * 3 + 1] = 1 - anomaly;
            colors[this.selectedPointIndex * 3 + 2] = 0.5;
        }
        
        // Highlight new selection
        colors[index * 3] = 1;
        colors[index * 3 + 1] = 1;
        colors[index * 3 + 2] = 0;
        
        this.pointCloud.geometry.attributes.color.needsUpdate = true;
        this.selectedPointIndex = index;
    }
    
    animateCameraToPoint(targetPosition) {
        this.controls.animating = true;
        const startTime = Date.now();
        const duration = 1000;
        
        const startTarget = this.controls.cameraTarget.clone();
        const endTarget = new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z);
        const startDistance = this.controls.cameraDistance;
        const endDistance = 30;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeInOutCubic(progress);
            
            // Interpolate target
            this.controls.cameraTarget.lerpVectors(startTarget, endTarget, eased);
            
            // Interpolate distance
            this.controls.cameraDistance = startDistance + (endDistance - startDistance) * eased;
            
            this.updateCameraPosition();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.controls.animating = false;
            }
        };
        
        animate();
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    resetCamera() {
        this.controls.animating = true;
        const startTime = Date.now();
        const duration = 1000;
        
        const startAngles = {
            x: this.controls.cameraAngleX,
            y: this.controls.cameraAngleY
        };
        const startDistance = this.controls.cameraDistance;
        const startTarget = this.controls.cameraTarget.clone();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeInOutCubic(progress);
            
            // Reset to default values
            this.controls.cameraAngleX = startAngles.x + (0 - startAngles.x) * eased;
            this.controls.cameraAngleY = startAngles.y + (Math.PI / 4 - startAngles.y) * eased;
            this.controls.cameraDistance = startDistance + (50 - startDistance) * eased;
            this.controls.cameraTarget.lerpVectors(startTarget, new THREE.Vector3(0, 0, 0), eased);
            
            this.updateCameraPosition();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.controls.animating = false;
            }
        };
        
        animate();
    }
    
    fitAllPoints() {
        if (!this.pointCloud) return;
        
        // Calculate bounding box
        this.pointCloud.geometry.computeBoundingBox();
        const box = this.pointCloud.geometry.boundingBox;
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Calculate distance needed to fit all points
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim / (2 * Math.tan(this.camera.fov * Math.PI / 360));
        
        // Animate to fit
        this.controls.animating = true;
        const startTime = Date.now();
        const duration = 1000;
        
        const startTarget = this.controls.cameraTarget.clone();
        const startDistance = this.controls.cameraDistance;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeInOutCubic(progress);
            
            this.controls.cameraTarget.lerpVectors(startTarget, center, eased);
            this.controls.cameraDistance = startDistance + (distance * 1.5 - startDistance) * eased;
            
            this.updateCameraPosition();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.controls.animating = false;
            }
        };
        
        animate();
    }
    
    updateFrustum() {
        this.cameraMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.cameraMatrix);
    }
    
    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    // Public methods for external control
    zoomIn() {
        this.controls.cameraDistance = Math.max(10, this.controls.cameraDistance * 0.8);
        this.updateCameraPosition();
    }
    
    zoomOut() {
        this.controls.cameraDistance = Math.min(200, this.controls.cameraDistance * 1.2);
        this.updateCameraPosition();
    }
    
    setViewMode(mode) {
        this.currentViewMode = mode;
        // Update colors based on view mode
        this.updatePointColors();
    }
    
    updatePointColors() {
        if (!this.pointCloud) return;
        
        const colors = this.pointCloud.geometry.attributes.color.array;
        
        this.videoPoints.forEach((video, i) => {
            let r, g, b;
            
            switch (this.currentViewMode) {
                case 'clusters':
                    // Color by cluster
                    const clusterColor = this.getClusterColor(video.cluster_id);
                    r = clusterColor.r;
                    g = clusterColor.g;
                    b = clusterColor.b;
                    break;
                    
                case 'anomalies':
                    // Color by anomaly score
                    const anomaly = video.anomaly_score || 0;
                    r = anomaly;
                    g = 1 - anomaly;
                    b = 0.5;
                    break;
                    
                case 'events':
                    // Color by event type
                    const eventColor = new THREE.Color(
                        this.eventTypeColors[video.main_event] || this.eventTypeColors.unknown
                    );
                    r = eventColor.r;
                    g = eventColor.g;
                    b = eventColor.b;
                    break;
                    
                default:
                    // Default coloring
                    const defaultAnomaly = video.anomaly_score || 0;
                    r = defaultAnomaly;
                    g = 1 - defaultAnomaly;
                    b = 0.5;
            }
            
            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        });
        
        this.pointCloud.geometry.attributes.color.needsUpdate = true;
    }
    
    getClusterColor(clusterId) {
        if (!this.clusterColors.has(clusterId)) {
            // Generate a unique color for this cluster
            const hue = (clusterId * 137.5) % 360; // Golden angle
            const color = new THREE.Color();
            color.setHSL(hue / 360, 0.7, 0.5);
            this.clusterColors.set(clusterId, color);
        }
        return this.clusterColors.get(clusterId);
    }
    
    updateVisiblePoints(videos) {
        // For now, just reload all points
        // In a production app, you'd update only what's needed
        return this.loadVideoData(videos);
    }
    
    highlightSearchResults(results) {
        if (!this.pointCloud) return;
        
        const colors = this.pointCloud.geometry.attributes.color.array;
        const sizes = this.pointCloud.geometry.attributes.size.array;
        
        // Reset all points
        this.videoPoints.forEach((video, i) => {
            const anomaly = video.anomaly_score || 0;
            colors[i * 3] = anomaly;
            colors[i * 3 + 1] = 1 - anomaly;
            colors[i * 3 + 2] = 0.5;
            sizes[i] = 3 + anomaly * 2;
        });
        
        // Highlight search results
        results.forEach(result => {
            const index = this.videoPoints.findIndex(v => v.video_id === result.video_id);
            if (index >= 0) {
                // Make search results yellow and larger
                colors[index * 3] = 1;
                colors[index * 3 + 1] = 1;
                colors[index * 3 + 2] = 0;
                sizes[index] = 8;
            }
        });
        
        this.pointCloud.geometry.attributes.color.needsUpdate = true;
        this.pointCloud.geometry.attributes.size.needsUpdate = true;
    }
    
    clearSearchHighlight() {
        this.updatePointColors();
    }
}

// Make sure it's available globally
if (typeof window !== 'undefined') {
    window.VideoVisualization3D = window.VideoVisualization3D || VideoVisualization3D;
}