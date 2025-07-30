// 3D Visualization component using Three.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class VideoVisualization3D {
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
        this.currentViewMode = 'clusters'; // clusters, anomalies, events
        
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
            await this.setupControls();
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
    
    async setupControls() {
        // OrbitControls is now imported at the top
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        
        // Smooth controls optimized for point cloud exploration
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;
        this.controls.maxPolarAngle = Math.PI;
        
        // Interaction callbacks
        this.controls.addEventListener('start', () => {
            this.isInteracting = true;
            this.lastInteractionTime = Date.now();
            this.hideHoverTooltip();
        });
        
        this.controls.addEventListener('end', () => {
            this.isInteracting = false;
            // Re-enable hover detection after a delay
            clearTimeout(this.interactionTimeout);
            this.interactionTimeout = setTimeout(() => {
                this.lastInteractionTime = Date.now();
            }, 100);
        });
        
        this.controls.addEventListener('change', () => {
            // Update camera matrix for frustum culling
            this.updateFrustum();
        });
    }
    
    setupLighting() {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);
        
        // Subtle blue point light for accent
        const pointLight = new THREE.PointLight(0x4080ff, 0.3, 100);
        pointLight.position.set(0, 30, 0);
        this.scene.add(pointLight);
        
        // Add light helpers for debugging
        if (localStorage.getItem('debug') === 'true') {
            const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
            this.scene.add(directionalLightHelper);
        }
    }
    
    setupEventListeners() {
        // Mouse interaction
        this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.container.addEventListener('click', (e) => this.onMouseClick(e));
        this.container.addEventListener('dblclick', (e) => this.onMouseDoubleClick(e));
        
        // Touch interaction for mobile
        this.container.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.container.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.container.addEventListener('touchend', (e) => this.onTouchEnd(e));
        
        // Prevent context menu
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAnimations();
            } else {
                this.resumeAnimations();
            }
        });
    }
    
    setupRaycasting() {
        // Configure raycaster for point cloud
        this.raycaster.params.Points.threshold = 0.5;
        this.raycaster.layers.set(0); // Only check layer 0
    }
    
    async loadVideoData(videos) {
        try {
            console.log(`📊 Loading ${videos.length} videos into 3D scene`);
            
            this.videoPoints = videos;
            
            if (videos.length === 0) {
                console.warn('⚠️ No video data to visualize');
                return;
            }
            
            // Create optimized point cloud geometry
            const geometry = this.createPointCloudGeometry(videos);
            
            // Create material with custom shader for better performance
            this.pointsMaterial = this.createPointsMaterial();
            
            // Create point cloud
            if (this.pointCloud) {
                this.scene.remove(this.pointCloud);
                this.pointCloud.geometry.dispose();
            }
            
            this.pointCloud = new THREE.Points(geometry, this.pointsMaterial);
            this.pointCloud.frustumCulled = true;
            this.pointCloud.layers.set(0);
            this.scene.add(this.pointCloud);
            
            // Generate cluster colors
            this.generateClusterColors(videos);
            
            // Update colors based on current view mode
            this.updatePointColors();
            
            // Update frustum for culling
            this.updateFrustum();
            
            console.log(`✅ Point cloud created with ${videos.length} points`);
            
        } catch (error) {
            console.error('❌ Failed to load video data:', error);
            throw error;
        }
    }
    
    createPointCloudGeometry(videos) {
        const geometry = new THREE.BufferGeometry();
        
        // Allocate arrays
        const positions = new Float32Array(videos.length * 3);
        const colors = new Float32Array(videos.length * 3);
        const sizes = new Float32Array(videos.length);
        const videoIds = new Array(videos.length);
        
        // Populate arrays
        videos.forEach((video, i) => {
            // Positions
            const coords = video.coordinates || { x: 0, y: 0, z: 0 };
            positions[i * 3] = coords.x;
            positions[i * 3 + 1] = coords.y;
            positions[i * 3 + 2] = coords.z;
            
            // Initial colors (will be updated by view mode)
            colors[i * 3] = 0.5;
            colors[i * 3 + 1] = 0.5;
            colors[i * 3 + 2] = 0.5;
            
            // Sizes based on anomaly score
            sizes[i] = this.calculatePointSize(video.anomaly_score || 0);
            
            // Store video ID for lookups
            videoIds[i] = video.video_id;
        });
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Store video IDs as custom attribute
        geometry.userData.videoIds = videoIds;
        
        // Compute bounding box and sphere for culling
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        
        return geometry;
    }
    
    createPointsMaterial() {
        // Use PointsMaterial with vertex colors
        return new THREE.PointsMaterial({
            size: 3,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            alphaTest: 0.1,
            blending: THREE.AdditiveBlending
        });
    }
    
    generateClusterColors(videos) {
        this.clusterColors.clear();
        
        // Get unique cluster IDs
        const clusterIds = [...new Set(videos.map(v => v.cluster_id).filter(id => id !== undefined && id !== -1))];
        
        // Generate colors using golden ratio for good distribution
        const goldenRatio = 0.618033988749;
        
        clusterIds.forEach(clusterId => {
            const hue = (clusterId * goldenRatio) % 1;
            const color = new THREE.Color();
            color.setHSL(hue, 0.7, 0.6);
            this.clusterColors.set(clusterId, color);
        });
        
        // Default color for unclustered points
        this.clusterColors.set(-1, new THREE.Color(0x666666));
    }
    
    calculatePointSize(anomalyScore) {
        // Map anomaly score to point size (0.5-3.0 range)
        return Math.max(0.5, Math.min(3.0, 0.5 + anomalyScore * 2.5));
    }
    
    updatePointColors() {
        if (!this.pointCloud || !this.pointCloud.geometry.attributes.color) return;
        
        const colors = this.pointCloud.geometry.attributes.color.array;
        const sizes = this.pointCloud.geometry.attributes.size.array;
        
        this.videoPoints.forEach((video, i) => {
            let color = new THREE.Color(0x666666);
            let size = this.calculatePointSize(video.anomaly_score || 0);
            
            // Apply view mode coloring
            switch (this.currentViewMode) {
                case 'clusters':
                    color = this.clusterColors.get(video.cluster_id) || this.clusterColors.get(-1);
                    break;
                    
                case 'anomalies':
                    const anomalyScore = video.anomaly_score || 0;
                    if (anomalyScore > 0.7) {
                        color = new THREE.Color(0xff4444); // Red for high anomalies
                        size *= 1.5;
                    } else if (anomalyScore > 0.4) {
                        color = new THREE.Color(0xff8844); // Orange for medium anomalies
                        size *= 1.2;
                    } else {
                        color = new THREE.Color(0x44ff44); // Green for normal
                    }
                    break;
                    
                case 'events':
                    const eventType = video.main_event || 'unknown';
                    const eventColor = this.eventTypeColors[eventType] || this.eventTypeColors['unknown'];
                    color = new THREE.Color(eventColor);
                    break;
            }
            
            // Apply highlighting
            if (this.highlightedClusters.has(video.cluster_id)) {
                color.multiplyScalar(1.5); // Brighten highlighted clusters
                size *= 1.3;
            }
            
            if (this.anomalyHighlightEnabled && video.anomaly_score > 0.5) {
                color.lerp(new THREE.Color(0xff0000), 0.3); // Add red tint to anomalies
                size *= 1.2;
            }
            
            // Set colors and sizes
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            sizes[i] = size;
        });
        
        this.pointCloud.geometry.attributes.color.needsUpdate = true;
        this.pointCloud.geometry.attributes.size.needsUpdate = true;
    }
    
    onMouseMove(event) {
        // Update mouse coordinates for raycasting
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Throttle hover detection for performance
        if (!this.isInteracting && Date.now() - this.lastInteractionTime > 100) {
            this.checkHover();
        }
    }
    
    onMouseClick(event) {
        if (this.isInteracting) return;
        
        const intersectedPoint = this.getIntersectedPoint();
        if (intersectedPoint) {
            const video = this.videoPoints[intersectedPoint.index];
            this.selectedPointIndex = intersectedPoint.index;
            
            this.eventBus.emit('point.click', {
                videoId: video.video_id,
                coordinates: video.coordinates,
                video: video,
                index: intersectedPoint.index
            });
        }
    }
    
    onMouseDoubleClick(event) {
        if (this.isInteracting) return;
        
        const intersectedPoint = this.getIntersectedPoint();
        if (intersectedPoint) {
            const video = this.videoPoints[intersectedPoint.index];
            
            this.eventBus.emit('point.doubleclick', {
                videoId: video.video_id,
                video: video
            });
        }
    }
    
    checkHover() {
        const intersectedPoint = this.getIntersectedPoint();
        
        if (intersectedPoint && intersectedPoint.index !== this.hoveredPointIndex) {
            // New point hovered
            this.hoveredPointIndex = intersectedPoint.index;
            const video = this.videoPoints[this.hoveredPointIndex];
            
            this.eventBus.emit('point.hover', {
                videoId: video.video_id,
                title: video.title,
                main_event: video.main_event,
                location: video.location,
                anomaly_score: video.anomaly_score,
                cluster_id: video.cluster_id
            });
            
            // Visual hover effect
            this.updateHoverEffect(this.hoveredPointIndex);
            
        } else if (!intersectedPoint && this.hoveredPointIndex !== -1) {
            // No longer hovering
            this.clearHoverEffect();
            this.hoveredPointIndex = -1;
            this.eventBus.emit('point.hover.end');
        }
    }
    
    getIntersectedPoint() {
        if (!this.pointCloud) return null;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Check intersection with point cloud
        const intersects = this.raycaster.intersectObject(this.pointCloud);
        
        if (intersects.length > 0) {
            return intersects[0];
        }
        
        return null;
    }
    
    updateHoverEffect(pointIndex) {
        if (!this.pointCloud || !this.pointCloud.geometry.attributes.size) return;
        
        const sizes = this.pointCloud.geometry.attributes.size.array;
        const originalSize = this.calculatePointSize(this.videoPoints[pointIndex].anomaly_score || 0);
        sizes[pointIndex] = originalSize * 1.8; // Make it larger on hover
        this.pointCloud.geometry.attributes.size.needsUpdate = true;
    }
    
    clearHoverEffect() {
        if (this.hoveredPointIndex !== -1 && this.pointCloud) {
            const sizes = this.pointCloud.geometry.attributes.size.array;
            const originalSize = this.calculatePointSize(this.videoPoints[this.hoveredPointIndex].anomaly_score || 0);
            sizes[this.hoveredPointIndex] = originalSize;
            this.pointCloud.geometry.attributes.size.needsUpdate = true;
        }
    }
    
    hideHoverTooltip() {
        const tooltip = document.getElementById('hover-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    // Camera controls
    animateCameraToPoint(coordinates, duration = 1500) {
        if (!coordinates) return;
        
        const targetPosition = new THREE.Vector3(
            coordinates.x + 15,
            coordinates.y + 15,
            coordinates.z + 15
        );
        
        const targetLookAt = new THREE.Vector3(
            coordinates.x,
            coordinates.y,
            coordinates.z
        );
        
        this.animateCamera(targetPosition, targetLookAt, duration);
    }
    
    animateCamera(targetPosition, targetLookAt, duration) {
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth easing function
            const eased = this.easeInOutCubic(progress);
            
            // Interpolate camera position and target
            this.camera.position.lerpVectors(startPosition, targetPosition, eased);
            this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
            
            this.controls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    resetCamera() {
        this.animateCamera(
            new THREE.Vector3(30, 30, 30),
            new THREE.Vector3(0, 0, 0),
            1000
        );
    }
    
    fitAllPoints() {
        if (!this.pointCloud || !this.pointCloud.geometry.boundingBox) return;
        
        const box = this.pointCloud.geometry.boundingBox;
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Position camera to fit all points with some padding
        const distance = maxDim * 1.5;
        const targetPosition = center.clone().add(new THREE.Vector3(distance, distance, distance));
        
        this.animateCamera(targetPosition, center, 1500);
    }
    
    zoomIn() {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        this.camera.position.add(direction.multiplyScalar(5));
    }
    
    zoomOut() {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        this.camera.position.add(direction.multiplyScalar(-5));
    }
    
    // View mode management
    setViewMode(mode) {
        this.currentViewMode = mode;
        this.updatePointColors();
        console.log(`👁️ View mode changed to: ${mode}`);
    }
    
    // Highlighting and filtering
    updateClusterHighlights(highlightedClusters) {
        this.highlightedClusters = new Set(highlightedClusters);
        this.updatePointColors();
    }
    
    toggleAnomalyHighlight(enabled) {
        this.anomalyHighlightEnabled = enabled;
        this.updatePointColors();
    }
    
    highlightSearchResults(results) {
        // Store search results for highlighting
        this.searchResults = results;
        
        if (!this.pointCloud || results.length === 0) return;
        
        const colors = this.pointCloud.geometry.attributes.color.array;
        const sizes = this.pointCloud.geometry.attributes.size.array;
        
        // Dim all points first
        for (let i = 0; i < this.videoPoints.length; i++) {
            colors[i * 3] *= 0.3;
            colors[i * 3 + 1] *= 0.3;
            colors[i * 3 + 2] *= 0.3;
        }
        
        // Highlight search results
        results.forEach(result => {
            const pointIndex = this.videoPoints.findIndex(v => v.video_id === result.video_id);
            if (pointIndex !== -1) {
                const highlightColor = new THREE.Color(0x44ff44); // Green highlight
                colors[pointIndex * 3] = highlightColor.r;
                colors[pointIndex * 3 + 1] = highlightColor.g;
                colors[pointIndex * 3 + 2] = highlightColor.b;
                sizes[pointIndex] = this.calculatePointSize(this.videoPoints[pointIndex].anomaly_score || 0) * 2;
            }
        });
        
        this.pointCloud.geometry.attributes.color.needsUpdate = true;
        this.pointCloud.geometry.attributes.size.needsUpdate = true;
        
        // Auto-clear search highlight after 10 seconds
        setTimeout(() => {
            this.clearSearchHighlight();
        }, 10000);
    }
    
    clearSearchHighlight() {
        this.searchResults = [];
        this.updatePointColors();
    }
    
    focusOnCluster(clusterInfo) {
        if (!clusterInfo.centroid) return;
        
        const centroid = new THREE.Vector3(
            clusterInfo.centroid[0],
            clusterInfo.centroid[1],
            clusterInfo.centroid[2]
        );
        
        this.animateCameraToPoint({
            x: centroid.x,
            y: centroid.y,
            z: centroid.z
        }, 2000);
    }
    
    focusOnAnomalies(anomalies) {
        if (anomalies.length === 0) return;
        
        // Calculate centroid of anomalous points
        let center = new THREE.Vector3();
        let count = 0;
        
        anomalies.forEach(anomaly => {
            if (anomaly.coordinates) {
                center.add(new THREE.Vector3(
                    anomaly.coordinates.x,
                    anomaly.coordinates.y,
                    anomaly.coordinates.z
                ));
                count++;
            }
        });
        
        if (count > 0) {
            center.divideScalar(count);
            this.animateCameraToPoint({
                x: center.x,
                y: center.y,
                z: center.z
            }, 2000);
        }
    }
    
    // Performance optimization
    updateFrustum() {
        this.cameraMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.cameraMatrix);
    }
    
    // Touch support
    onTouchStart(event) {
        if (event.touches.length === 1) {
            this.updateMouseFromTouch(event.touches[0]);
        }
        event.preventDefault();
    }
    
    onTouchMove(event) {
        if (event.touches.length === 1) {
            this.updateMouseFromTouch(event.touches[0]);
            this.checkHover();
        }
        event.preventDefault();
    }
    
    onTouchEnd(event) {
        if (event.changedTouches.length === 1) {
            this.onMouseClick(event.changedTouches[0]);
        }
    }
    
    updateMouseFromTouch(touch) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    // Animation system
    pauseAnimations() {
        // Pause any running animations
        this.activeAnimations.forEach(animation => {
            if (animation.pause) animation.pause();
        });
    }
    
    resumeAnimations() {
        // Resume animations
        this.activeAnimations.forEach(animation => {
            if (animation.resume) animation.resume();
        });
    }
    
    // Rendering
    render() {
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.animationMixer) {
            this.animationMixer.update(0.016); // Assume 60fps
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    // Update visible points (for filtering)
    async updateVisiblePoints(newVideoPoints) {
        this.videoPoints = newVideoPoints;
        
        if (this.pointCloud) {
            this.scene.remove(this.pointCloud);
            this.pointCloud.geometry.dispose();
        }
        
        if (newVideoPoints.length > 0) {
            const geometry = this.createPointCloudGeometry(newVideoPoints);
            this.pointCloud = new THREE.Points(geometry, this.pointsMaterial);
            this.pointCloud.frustumCulled = true;
            this.pointCloud.layers.set(0);
            this.scene.add(this.pointCloud);
            
            this.generateClusterColors(newVideoPoints);
            this.updatePointColors();
        }
        
        console.log(`🔄 Updated visible points: ${newVideoPoints.length}`);
    }
    
    // Cleanup
    dispose() {
        if (this.pointCloud) {
            this.pointCloud.geometry.dispose();
            this.pointsMaterial.dispose();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.controls) {
            this.controls.dispose();
        }
        
        // Clear event listeners
        this.container.removeEventListener('mousemove', this.onMouseMove);
        this.container.removeEventListener('click', this.onMouseClick);
        this.container.removeEventListener('dblclick', this.onMouseDoubleClick);
        
        console.log('🧹 3D Visualization disposed');
    }
}