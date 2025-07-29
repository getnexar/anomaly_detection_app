// Event Bus for component communication
export class EventBus {
    constructor() {
        this.events = new Map();
        this.maxListeners = 50; // Prevent memory leaks
        this.debugMode = false;
    }
    
    // Subscribe to an event
    on(eventName, callback, context = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        
        const listeners = this.events.get(eventName);
        
        if (listeners.length >= this.maxListeners) {
            console.warn(`⚠️ EventBus: Maximum listeners (${this.maxListeners}) reached for event '${eventName}'`);
        }
        
        const listener = {
            callback,
            context,
            id: Symbol('listener'),
            once: false
        };
        
        listeners.push(listener);
        
        if (this.debugMode) {
            console.log(`📡 EventBus: Listener added for '${eventName}' (total: ${listeners.length})`);
        }
        
        // Return function to unsubscribe
        return () => this.off(eventName, listener.id);
    }
    
    // Subscribe to an event (one time only)
    once(eventName, callback, context = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        
        const listeners = this.events.get(eventName);
        
        const listener = {
            callback,
            context,
            id: Symbol('listener'),
            once: true
        };
        
        listeners.push(listener);
        
        if (this.debugMode) {
            console.log(`📡 EventBus: One-time listener added for '${eventName}'`);
        }
        
        // Return function to unsubscribe
        return () => this.off(eventName, listener.id);
    }
    
    // Unsubscribe from an event
    off(eventName, listenerId = null) {
        if (!this.events.has(eventName)) {
            return false;
        }
        
        const listeners = this.events.get(eventName);
        
        if (listenerId) {
            // Remove specific listener by ID
            const index = listeners.findIndex(listener => listener.id === listenerId);
            if (index !== -1) {
                listeners.splice(index, 1);
                if (this.debugMode) {
                    console.log(`📡 EventBus: Specific listener removed from '${eventName}'`);
                }
                return true;
            }
        } else {
            // Remove all listeners for this event
            this.events.delete(eventName);
            if (this.debugMode) {
                console.log(`📡 EventBus: All listeners removed from '${eventName}'`);
            }
            return true;
        }
        
        return false;
    }
    
    // Emit an event
    emit(eventName, data = null) {
        if (!this.events.has(eventName)) {
            if (this.debugMode) {
                console.log(`📡 EventBus: No listeners for '${eventName}'`);
            }
            return false;
        }
        
        const listeners = this.events.get(eventName);
        const toRemove = [];
        
        if (this.debugMode) {
            console.log(`📡 EventBus: Emitting '${eventName}' to ${listeners.length} listeners`, data);
        }
        
        listeners.forEach((listener, index) => {
            try {
                // Call the callback with proper context
                if (listener.context) {
                    listener.callback.call(listener.context, data);
                } else {
                    listener.callback(data);
                }
                
                // Mark one-time listeners for removal
                if (listener.once) {
                    toRemove.push(index);
                }
                
            } catch (error) {
                console.error(`❌ EventBus: Error in listener for '${eventName}':`, error);
                
                // Optional: Remove listeners that throw errors
                // toRemove.push(index);
            }
        });
        
        // Remove one-time listeners (in reverse order to maintain indices)
        toRemove.reverse().forEach(index => {
            listeners.splice(index, 1);
        });
        
        if (toRemove.length > 0 && this.debugMode) {
            console.log(`📡 EventBus: Removed ${toRemove.length} one-time listeners from '${eventName}'`);
        }
        
        return true;
    }
    
    // Emit an event asynchronously
    async emitAsync(eventName, data = null) {
        if (!this.events.has(eventName)) {
            return false;
        }
        
        const listeners = this.events.get(eventName);
        const toRemove = [];
        
        if (this.debugMode) {
            console.log(`📡 EventBus: Async emitting '${eventName}' to ${listeners.length} listeners`, data);
        }
        
        const promises = listeners.map(async (listener, index) => {
            try {
                let result;
                
                // Call the callback with proper context
                if (listener.context) {
                    result = listener.callback.call(listener.context, data);
                } else {
                    result = listener.callback(data);
                }
                
                // Handle async callbacks
                if (result instanceof Promise) {
                    await result;
                }
                
                // Mark one-time listeners for removal
                if (listener.once) {
                    toRemove.push(index);
                }
                
            } catch (error) {
                console.error(`❌ EventBus: Error in async listener for '${eventName}':`, error);
            }
        });
        
        await Promise.all(promises);
        
        // Remove one-time listeners
        toRemove.reverse().forEach(index => {
            listeners.splice(index, 1);
        });
        
        return true;
    }
    
    // Get list of event names
    getEventNames() {
        return Array.from(this.events.keys());
    }
    
    // Get listener count for an event
    getListenerCount(eventName) {
        if (!this.events.has(eventName)) {
            return 0;
        }
        return this.events.get(eventName).length;
    }
    
    // Get total listener count across all events
    getTotalListenerCount() {
        let total = 0;
        this.events.forEach(listeners => {
            total += listeners.length;
        });
        return total;
    }
    
    // Clear all listeners
    clear() {
        const eventCount = this.events.size;
        const listenerCount = this.getTotalListenerCount();
        
        this.events.clear();
        
        if (this.debugMode) {
            console.log(`📡 EventBus: Cleared ${listenerCount} listeners from ${eventCount} events`);
        }
    }
    
    // Enable/disable debug mode
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`📡 EventBus: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Set maximum listeners per event
    setMaxListeners(max) {
        this.maxListeners = max;
        console.log(`📡 EventBus: Maximum listeners set to ${max}`);
    }
    
    // Get debug information
    getDebugInfo() {
        const info = {
            totalEvents: this.events.size,
            totalListeners: this.getTotalListenerCount(),
            maxListeners: this.maxListeners,
            debugMode: this.debugMode,
            events: {}
        };
        
        this.events.forEach((listeners, eventName) => {
            info.events[eventName] = {
                listenerCount: listeners.length,
                hasOnceListeners: listeners.some(l => l.once),
                hasContextListeners: listeners.some(l => l.context !== null)
            };
        });
        
        return info;
    }
    
    // Create a namespaced event bus
    namespace(prefix) {
        const namespacedBus = {
            on: (eventName, callback, context) => {
                return this.on(`${prefix}.${eventName}`, callback, context);
            },
            once: (eventName, callback, context) => {
                return this.once(`${prefix}.${eventName}`, callback, context);
            },
            off: (eventName, listenerId) => {
                return this.off(`${prefix}.${eventName}`, listenerId);
            },
            emit: (eventName, data) => {
                return this.emit(`${prefix}.${eventName}`, data);
            },
            emitAsync: (eventName, data) => {
                return this.emitAsync(`${prefix}.${eventName}`, data);
            }
        };
        
        return namespacedBus;
    }
    
    // Create event middleware/interceptors
    addInterceptor(eventName, interceptor) {
        const originalEmit = this.emit.bind(this);
        
        this.emit = (name, data) => {
            if (name === eventName) {
                try {
                    const modifiedData = interceptor(data);
                    return originalEmit(name, modifiedData);
                } catch (error) {
                    console.error(`❌ EventBus: Interceptor error for '${eventName}':`, error);
                    return originalEmit(name, data); // Fall back to original data
                }
            }
            return originalEmit(name, data);
        };
    }
    
    // Pipe events from one name to another
    pipe(fromEvent, toEvent, transform = null) {
        return this.on(fromEvent, (data) => {
            const transformedData = transform ? transform(data) : data;
            this.emit(toEvent, transformedData);
        });
    }
    
    // Wait for an event (returns Promise)
    waitFor(eventName, timeout = null) {
        return new Promise((resolve, reject) => {
            let timeoutId = null;
            
            const unsubscribe = this.once(eventName, (data) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                resolve(data);
            });
            
            if (timeout) {
                timeoutId = setTimeout(() => {
                    unsubscribe();
                    reject(new Error(`Timeout waiting for event '${eventName}'`));
                }, timeout);
            }
        });
    }
    
    // Batch emit multiple events
    emitBatch(events) {
        const results = events.map(({ name, data }) => {
            try {
                return this.emit(name, data);
            } catch (error) {
                console.error(`❌ EventBus: Batch emit error for '${name}':`, error);
                return false;
            }
        });
        
        return results;
    }
    
    // Create a filtered listener (only calls callback if filter returns true)
    onFiltered(eventName, filter, callback, context = null) {
        return this.on(eventName, (data) => {
            try {
                if (filter(data)) {
                    if (context) {
                        callback.call(context, data);
                    } else {
                        callback(data);
                    }
                }
            } catch (error) {
                console.error(`❌ EventBus: Filtered listener error for '${eventName}':`, error);
            }
        });
    }
    
    // Memory leak detection
    checkMemoryLeaks() {
        const warnings = [];
        
        this.events.forEach((listeners, eventName) => {
            if (listeners.length > this.maxListeners * 0.8) {
                warnings.push({
                    event: eventName,
                    listenerCount: listeners.length,
                    warning: 'High listener count - possible memory leak'
                });
            }
        });
        
        if (warnings.length > 0) {
            console.warn('📡 EventBus: Potential memory leaks detected:', warnings);
        }
        
        return warnings;
    }
}