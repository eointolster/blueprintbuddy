/**
 * StateManager - Handles undo/redo, clipboard, and save/load operations
 */
class StateManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.clipboard = null;
        this.maxUndoSteps = 20;
    }

    /**
     * Save current state to undo stack
     */
    saveState(components, connections) {
        const state = {
            components: JSON.parse(JSON.stringify(components)),
            connections: JSON.parse(JSON.stringify(connections))
        };

        this.undoStack.push(state);
        this.redoStack = [];

        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }

        return state;
    }

    /**
     * Undo last action
     */
    undo(currentComponents, currentConnections) {
        if (this.undoStack.length === 0) return null;

        const currentState = {
            components: JSON.parse(JSON.stringify(currentComponents)),
            connections: JSON.parse(JSON.stringify(currentConnections))
        };

        this.redoStack.push(currentState);
        return this.undoStack.pop();
    }

    /**
     * Redo last undone action
     */
    redo(currentComponents, currentConnections) {
        if (this.redoStack.length === 0) return null;

        const currentState = {
            components: JSON.parse(JSON.stringify(currentComponents)),
            connections: JSON.parse(JSON.stringify(currentConnections))
        };

        this.undoStack.push(currentState);
        return this.redoStack.pop();
    }

    /**
     * Copy components to clipboard
     */
    copyComponents(components) {
        this.clipboard = components.map(component =>
            JSON.parse(JSON.stringify(component))
        );
        return this.clipboard;
    }

    /**
     * Get clipboard contents
     */
    getClipboard() {
        return this.clipboard;
    }

    /**
     * Check if clipboard has content
     */
    hasClipboard() {
        return this.clipboard && this.clipboard.length > 0;
    }

    /**
     * Clear clipboard
     */
    clearClipboard() {
        this.clipboard = null;
    }

    /**
     * Export to JSON
     */
    exportToJson(components, connections) {
        return JSON.stringify({
            components: components,
            connections: connections,
            metadata: {
                version: "1.0",
                timestamp: new Date().toISOString()
            }
        }, null, 2);
    }

    /**
     * Import from JSON
     */
    importFromJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            // Validate required fields
            if (!data.components || !data.connections) {
                throw new Error('Invalid blueprint format: missing components or connections');
            }

            return {
                success: true,
                components: data.components,
                connections: data.connections,
                metadata: data.metadata
            };
        } catch (e) {
            console.error('Failed to import JSON:', e);
            return {
                success: false,
                error: e.message
            };
        }
    }

    /**
     * Save to JSON file
     */
    saveToJsonFile(components, connections, filename) {
        const jsonData = this.exportToJson(components, connections);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename || `blueprint_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return true;
    }

    /**
     * Load from file
     */
    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                const result = this.importFromJson(event.target.result);
                if (result.success) {
                    resolve(result);
                } else {
                    reject(new Error(result.error));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Clear all history
     */
    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
    }

    /**
     * Get undo/redo state info
     */
    getHistoryInfo() {
        return {
            canUndo: this.undoStack.length > 0,
            canRedo: this.redoStack.length > 0,
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length
        };
    }
}
