// Simple PerformanceMonitor for non-module usage
window.PerformanceMonitor = class PerformanceMonitor {
    constructor() {
        this.fps = 0;
        this.frameTime = 0;
        this.lastTime = performance.now();
        this.frames = 0;
        this.active = true;
    }
    
    start() {
        this.lastTime = performance.now();
        this.active = true;
    }
    
    stop() {
        this.active = false;
    }
    
    pause() {
        this.active = false;
    }
    
    resume() {
        this.active = true;
        this.lastTime = performance.now();
    }
    
    update() {
        if (!this.active) return;
        
        const now = performance.now();
        const delta = now - this.lastTime;
        
        this.frames++;
        
        if (delta >= 1000) {
            this.fps = (this.frames * 1000) / delta;
            this.frameTime = delta / this.frames;
            this.frames = 0;
            this.lastTime = now;
        }
    }
    
    getFPS() {
        return Math.round(this.fps);
    }
    
    getLastFrameTime() {
        return Math.round(this.frameTime);
    }
}