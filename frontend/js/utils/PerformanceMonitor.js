// Performance monitoring utility
export class PerformanceMonitor {
    constructor() {
        this.isActive = false;
        this.startTime = 0;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.avgFrameTime = 0;
        this.minFrameTime = Infinity;
        this.maxFrameTime = 0;
        
        // Performance history
        this.frameHistory = [];
        this.maxHistorySize = 60; // Keep last 60 frames
        
        // Memory tracking
        this.memoryHistory = [];
        this.maxMemoryHistorySize = 30; // Keep last 30 memory snapshots
        
        // Timing categories
        this.timings = new Map();
        this.activeTimers = new Map();
        
        // Performance thresholds
        this.thresholds = {
            fps: {
                good: 55,
                ok: 30,
                poor: 15
            },
            frameTime: {
                good: 16,  // ~60fps
                ok: 33,    // ~30fps
                poor: 66   // ~15fps
            },
            memory: {
                warning: 50 * 1024 * 1024, // 50MB
                critical: 100 * 1024 * 1024 // 100MB
            }
        };
        
        // Event callbacks
        this.onFPSUpdate = null;
        this.onMemoryWarning = null;
        this.onPerformanceIssue = null;
    }
    
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.startTime = performance.now();
        this.lastFrameTime = this.startTime;
        this.frameCount = 0;
        
        console.log('📊 Performance monitoring started');
        
        // Start memory monitoring
        this.startMemoryMonitoring();
    }
    
    stop() {
        this.isActive = false;
        console.log('📊 Performance monitoring stopped');
        
        this.logSummary();
    }
    
    pause() {
        this.isActive = false;
    }
    
    resume() {
        if (!this.isActive) {
            this.isActive = true;
            this.lastFrameTime = performance.now();
        }
    }
    
    update() {
        if (!this.isActive) return;
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        
        this.frameCount++;
        this.lastFrameTime = currentTime;
        
        // Update frame time statistics
        this.avgFrameTime = (this.avgFrameTime * (this.frameCount - 1) + deltaTime) / this.frameCount;
        this.minFrameTime = Math.min(this.minFrameTime, deltaTime);
        this.maxFrameTime = Math.max(this.maxFrameTime, deltaTime);
        
        // Calculate current FPS
        this.fps = Math.round(1000 / deltaTime);
        
        // Update frame history
        this.frameHistory.push({
            time: currentTime,
            deltaTime: deltaTime,
            fps: this.fps
        });
        
        if (this.frameHistory.length > this.maxHistorySize) {
            this.frameHistory.shift();
        }
        
        // Check for performance issues
        this.checkPerformanceIssues(deltaTime);
        
        // Trigger FPS update callback
        if (this.onFPSUpdate) {
            this.onFPSUpdate(this.fps, deltaTime);
        }
    }
    
    getFPS() {
        return this.fps;
    }
    
    getAverageFPS() {
        if (this.frameHistory.length === 0) return 0;
        
        const totalFPS = this.frameHistory.reduce((sum, frame) => sum + frame.fps, 0);
        return Math.round(totalFPS / this.frameHistory.length);
    }
    
    getLastFrameTime() {
        if (this.frameHistory.length === 0) return 0;
        return Math.round(this.frameHistory[this.frameHistory.length - 1].deltaTime);
    }
    
    getAverageFrameTime() {
        return Math.round(this.avgFrameTime);
    }
    
    // Custom timing functions
    startTiming(category) {
        this.activeTimers.set(category, performance.now());
    }
    
    endTiming(category) {
        if (!this.activeTimers.has(category)) {
            console.warn(`⚠️ No active timer for category '${category}'`);
            return 0;
        }
        
        const startTime = this.activeTimers.get(category);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.activeTimers.delete(category);
        
        // Store timing data
        if (!this.timings.has(category)) {
            this.timings.set(category, []);
        }
        
        const timings = this.timings.get(category);
        timings.push({
            duration,
            timestamp: endTime
        });
        
        // Keep only recent timings
        if (timings.length > 100) {
            timings.shift();
        }
        
        return duration;
    }
    
    getTimingStats(category) {
        if (!this.timings.has(category)) {
            return null;
        }
        
        const timings = this.timings.get(category);
        if (timings.length === 0) return null;
        
        const durations = timings.map(t => t.duration);
        const sum = durations.reduce((a, b) => a + b, 0);
        
        return {
            count: timings.length,
            average: sum / timings.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            total: sum,
            recent: durations.slice(-10) // Last 10 timings
        };
    }
    
    // Memory monitoring
    startMemoryMonitoring() {
        if (!performance.memory) {
            console.warn('⚠️ Memory monitoring not available in this browser');
            return;
        }
        
        const checkMemory = () => {
            if (!this.isActive) return;
            
            const memory = {
                used: performance.memory.usedJSHeapSize,
                allocated: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                timestamp: performance.now()
            };
            
            this.memoryHistory.push(memory);
            
            if (this.memoryHistory.length > this.maxMemoryHistorySize) {
                this.memoryHistory.shift();
            }
            
            // Check for memory issues
            this.checkMemoryIssues(memory);
            
            // Schedule next check
            setTimeout(checkMemory, 2000); // Check every 2 seconds
        };
        
        checkMemory();
    }
    
    getMemoryUsage() {
        if (!performance.memory) return null;
        
        return {
            used: performance.memory.usedJSHeapSize,
            allocated: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
            percentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
        };
    }
    
    getMemoryTrend() {
        if (this.memoryHistory.length < 2) return 'stable';
        
        const recent = this.memoryHistory.slice(-5);
        const trend = recent[recent.length - 1].used - recent[0].used;
        
        if (trend > 5 * 1024 * 1024) return 'increasing'; // 5MB increase
        if (trend < -5 * 1024 * 1024) return 'decreasing'; // 5MB decrease
        return 'stable';
    }
    
    checkPerformanceIssues(frameTime) {
        const issues = [];
        
        // Check FPS
        if (this.fps < this.thresholds.fps.poor) {
            issues.push({
                type: 'fps',
                severity: 'critical',
                message: `Very low FPS: ${this.fps}`,
                value: this.fps,
                threshold: this.thresholds.fps.poor
            });
        } else if (this.fps < this.thresholds.fps.ok) {
            issues.push({
                type: 'fps',
                severity: 'warning',
                message: `Low FPS: ${this.fps}`,
                value: this.fps,
                threshold: this.thresholds.fps.ok
            });
        }
        
        // Check frame time
        if (frameTime > this.thresholds.frameTime.poor) {
            issues.push({
                type: 'frameTime',
                severity: 'critical',
                message: `Very high frame time: ${frameTime.toFixed(1)}ms`,
                value: frameTime,
                threshold: this.thresholds.frameTime.poor
            });
        } else if (frameTime > this.thresholds.frameTime.ok) {
            issues.push({
                type: 'frameTime',
                severity: 'warning',
                message: `High frame time: ${frameTime.toFixed(1)}ms`,
                value: frameTime,
                threshold: this.thresholds.frameTime.ok
            });
        }
        
        // Trigger callback if issues found
        if (issues.length > 0 && this.onPerformanceIssue) {
            this.onPerformanceIssue(issues);
        }
    }
    
    checkMemoryIssues(memory) {
        // Check for memory warnings
        if (memory.used > this.thresholds.memory.critical) {
            if (this.onMemoryWarning) {
                this.onMemoryWarning({
                    severity: 'critical',
                    message: `Critical memory usage: ${(memory.used / 1024 / 1024).toFixed(1)}MB`,
                    usage: memory.used,
                    threshold: this.thresholds.memory.critical
                });
            }
        } else if (memory.used > this.thresholds.memory.warning) {
            if (this.onMemoryWarning) {
                this.onMemoryWarning({
                    severity: 'warning',
                    message: `High memory usage: ${(memory.used / 1024 / 1024).toFixed(1)}MB`,
                    usage: memory.used,
                    threshold: this.thresholds.memory.warning
                });
            }
        }
    }
    
    // Performance recommendations
    getRecommendations() {
        const recommendations = [];
        const avgFPS = this.getAverageFPS();
        const memoryUsage = this.getMemoryUsage();
        
        // FPS recommendations
        if (avgFPS < this.thresholds.fps.ok) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'Consider reducing point count or visual complexity',
                reason: `Average FPS is ${avgFPS}, below optimal threshold`
            });
        }
        
        // Memory recommendations
        if (memoryUsage && memoryUsage.percentage > 80) {
            recommendations.push({
                type: 'memory',
                priority: 'medium',
                message: 'High memory usage detected, consider data pagination',
                reason: `Memory usage is ${memoryUsage.percentage.toFixed(1)}% of available`
            });
        }
        
        // Frame time consistency
        if (this.maxFrameTime - this.minFrameTime > 50) {
            recommendations.push({
                type: 'consistency',
                priority: 'medium',
                message: 'Frame time varies significantly, check for blocking operations',
                reason: `Frame time varies from ${this.minFrameTime.toFixed(1)}ms to ${this.maxFrameTime.toFixed(1)}ms`
            });
        }
        
        return recommendations;
    }
    
    // Generate performance report
    generateReport() {
        const runtime = performance.now() - this.startTime;
        const memoryUsage = this.getMemoryUsage();
        
        return {
            runtime: {
                total: runtime,
                formatted: `${(runtime / 1000).toFixed(1)}s`
            },
            frames: {
                total: this.frameCount,
                avgFPS: this.getAverageFPS(),
                currentFPS: this.fps,
                avgFrameTime: this.getAverageFrameTime(),
                minFrameTime: this.minFrameTime,
                maxFrameTime: this.maxFrameTime
            },
            memory: memoryUsage ? {
                current: {
                    used: `${(memoryUsage.used / 1024 / 1024).toFixed(1)}MB`,
                    allocated: `${(memoryUsage.allocated / 1024 / 1024).toFixed(1)}MB`,
                    percentage: `${memoryUsage.percentage.toFixed(1)}%`
                },
                trend: this.getMemoryTrend()
            } : null,
            timings: Object.fromEntries(
                Array.from(this.timings.entries()).map(([category, data]) => [
                    category,
                    this.getTimingStats(category)
                ])
            ),
            recommendations: this.getRecommendations(),
            performance: this.getPerformanceGrade()
        };
    }
    
    getPerformanceGrade() {
        const avgFPS = this.getAverageFPS();
        const avgFrameTime = this.getAverageFrameTime();
        
        let score = 100;
        
        // FPS scoring
        if (avgFPS < this.thresholds.fps.poor) {
            score -= 40;
        } else if (avgFPS < this.thresholds.fps.ok) {
            score -= 20;
        } else if (avgFPS < this.thresholds.fps.good) {
            score -= 10;
        }
        
        // Frame time consistency scoring
        const frameTimeVariance = this.maxFrameTime - this.minFrameTime;
        if (frameTimeVariance > 100) {
            score -= 20;
        } else if (frameTimeVariance > 50) {
            score -= 10;
        }
        
        // Memory usage scoring
        const memoryUsage = this.getMemoryUsage();
        if (memoryUsage && memoryUsage.percentage > 90) {
            score -= 15;
        } else if (memoryUsage && memoryUsage.percentage > 70) {
            score -= 5;
        }
        
        score = Math.max(0, score);
        
        let grade;
        if (score >= 90) grade = 'A';
        else if (score >= 80) grade = 'B';
        else if (score >= 70) grade = 'C';
        else if (score >= 60) grade = 'D';
        else grade = 'F';
        
        return { score, grade };
    }
    
    logSummary() {
        const report = this.generateReport();
        
        console.group('📊 Performance Summary');
        console.log('Runtime:', report.runtime.formatted);
        console.log('Frames:', report.frames.total, `(${report.frames.avgFPS} avg FPS)`);
        console.log('Frame Time:', `${report.frames.avgFrameTime}ms avg, ${report.frames.minFrameTime.toFixed(1)}-${report.frames.maxFrameTime.toFixed(1)}ms range`);
        
        if (report.memory) {
            console.log('Memory:', report.memory.current.used, `(${report.memory.current.percentage})`);
            console.log('Memory Trend:', report.memory.trend);
        }
        
        if (Object.keys(report.timings).length > 0) {
            console.log('Custom Timings:', report.timings);
        }
        
        console.log('Performance Grade:', `${report.performance.grade} (${report.performance.score}/100)`);
        
        if (report.recommendations.length > 0) {
            console.log('Recommendations:', report.recommendations);
        }
        
        console.groupEnd();
    }
    
    // Export data for external analysis
    exportData() {
        return {
            frameHistory: this.frameHistory,
            memoryHistory: this.memoryHistory,
            timings: Object.fromEntries(this.timings),
            report: this.generateReport()
        };
    }
    
    // Reset all data
    reset() {
        this.frameCount = 0;
        this.fps = 0;
        this.avgFrameTime = 0;
        this.minFrameTime = Infinity;
        this.maxFrameTime = 0;
        this.frameHistory = [];
        this.memoryHistory = [];
        this.timings.clear();
        this.activeTimers.clear();
        
        if (this.isActive) {
            this.startTime = performance.now();
            this.lastFrameTime = this.startTime;
        }
        
        console.log('📊 Performance data reset');
    }
}