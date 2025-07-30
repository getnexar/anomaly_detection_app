// Event Bus for component communication - Fixed version for global usage
class EventBus {
    constructor() {
        this.events = new Map();
        this.maxListeners = 50;
        this.debugMode = false;
    }
    
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
        
        return () => this.off(eventName, listener.id);
    }
    
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
        
        return () => this.off(eventName, listener.id);
    }
    
    off(eventName, listenerId = null) {
        if (!this.events.has(eventName)) {
            return false;
        }
        
        const listeners = this.events.get(eventName);
        
        if (listenerId) {
            const index = listeners.findIndex(listener => listener.id === listenerId);
            if (index !== -1) {
                listeners.splice(index, 1);
                if (this.debugMode) {
                    console.log(`📡 EventBus: Specific listener removed from '${eventName}'`);
                }
                return true;
            }
        } else {
            this.events.delete(eventName);
            if (this.debugMode) {
                console.log(`📡 EventBus: All listeners removed from '${eventName}'`);
            }
            return true;
        }
        
        return false;
    }
    
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
                if (listener.context) {
                    listener.callback.call(listener.context, data);
                } else {
                    listener.callback(data);
                }
                
                if (listener.once) {
                    toRemove.push(index);
                }
                
            } catch (error) {
                console.error(`❌ EventBus: Error in listener for '${eventName}':`, error);
            }
        });
        
        toRemove.reverse().forEach(index => {
            listeners.splice(index, 1);
        });
        
        if (toRemove.length > 0 && this.debugMode) {
            console.log(`📡 EventBus: Removed ${toRemove.length} one-time listeners from '${eventName}'`);
        }
        
        return true;
    }
    
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
                
                if (listener.context) {
                    result = listener.callback.call(listener.context, data);
                } else {
                    result = listener.callback(data);
                }
                
                if (result instanceof Promise) {
                    await result;
                }
                
                if (listener.once) {
                    toRemove.push(index);
                }
                
            } catch (error) {
                console.error(`❌ EventBus: Error in async listener for '${eventName}':`, error);
            }
        });
        
        await Promise.all(promises);
        
        toRemove.reverse().forEach(index => {
            listeners.splice(index, 1);
        });
        
        return true;
    }
    
    getEventNames() {
        return Array.from(this.events.keys());
    }
    
    getListenerCount(eventName) {
        if (!this.events.has(eventName)) {
            return 0;
        }
        return this.events.get(eventName).length;
    }
    
    getTotalListenerCount() {
        let total = 0;
        this.events.forEach(listeners => {
            total += listeners.length;
        });
        return total;
    }
    
    clear() {
        const eventCount = this.events.size;
        const listenerCount = this.getTotalListenerCount();
        
        this.events.clear();
        
        if (this.debugMode) {
            console.log(`📡 EventBus: Cleared ${listenerCount} listeners from ${eventCount} events`);
        }
    }
    
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`📡 EventBus: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// Make it globally available
window.EventBus = EventBus;