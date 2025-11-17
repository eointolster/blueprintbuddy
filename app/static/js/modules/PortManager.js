/**
 * PortManager - Handles port operations on components
 */
class PortManager {
    constructor() {
        this.portIdCounter = 1;
    }

    /**
     * Add a port to a component
     */
    addPort(component, portType) {
        if (!component || !portType) {
            console.error('Invalid component or port type');
            return null;
        }

        if (portType !== 'inputs' && portType !== 'outputs') {
            console.error('Port type must be "inputs" or "outputs"');
            return null;
        }

        // Ensure the port array exists
        if (!component[portType]) {
            component[portType] = [];
        }

        const portLabel = portType === 'inputs' ? 'input' : 'output';
        const portCount = component[portType].length;

        const newPort = {
            name: `${portLabel}${portCount + 1}`,
            id: `${portType.slice(0, 2)}${this.portIdCounter++}`,
            type: 'any'
        };

        component[portType].push(newPort);

        // Update component height
        this.updateComponentHeight(component);

        return newPort;
    }

    /**
     * Remove a port from a component
     */
    removePort(component, portId, portType) {
        if (!component || !portId || !portType) {
            return false;
        }

        if (!component[portType]) {
            return false;
        }

        const initialLength = component[portType].length;
        component[portType] = component[portType].filter(port => port.id !== portId);

        if (component[portType].length < initialLength) {
            // Update component height
            this.updateComponentHeight(component);
            return true;
        }

        return false;
    }

    /**
     * Find a port by ID in a component
     */
    findPort(component, portId) {
        if (!component) return null;

        // Search in inputs
        let port = component.inputs?.find(p => p.id === portId);
        if (port) return { port, type: 'inputs' };

        // Search in outputs
        port = component.outputs?.find(p => p.id === portId);
        if (port) return { port, type: 'outputs' };

        return null;
    }

    /**
     * Rename a port
     */
    renamePort(component, portId, newName) {
        const result = this.findPort(component, portId);
        if (!result) return false;

        result.port.name = newName;
        return true;
    }

    /**
     * Change port type
     */
    changePortType(component, portId, newType) {
        const result = this.findPort(component, portId);
        if (!result) return false;

        result.port.type = newType;
        return true;
    }

    /**
     * Update component height based on port count
     */
    updateComponentHeight(component) {
        const maxPorts = Math.max(
            component.inputs?.length || 0,
            component.outputs?.length || 0
        );

        const minHeight = 100;
        const portSpacing = 30;
        component.height = Math.max(minHeight, 25 + (maxPorts + 1) * portSpacing);

        return component.height;
    }

    /**
     * Get all ports from a component
     */
    getAllPorts(component) {
        return {
            inputs: component.inputs || [],
            outputs: component.outputs || []
        };
    }

    /**
     * Count ports in a component
     */
    countPorts(component) {
        return {
            inputs: component.inputs?.length || 0,
            outputs: component.outputs?.length || 0,
            total: (component.inputs?.length || 0) + (component.outputs?.length || 0)
        };
    }

    /**
     * Validate port structure
     */
    validatePort(port) {
        if (!port || typeof port !== 'object') {
            return { valid: false, error: 'Port must be an object' };
        }

        if (!port.id) {
            return { valid: false, error: 'Port must have an id' };
        }

        if (!port.name) {
            return { valid: false, error: 'Port must have a name' };
        }

        return { valid: true };
    }

    /**
     * Get port position in component
     */
    getPortPosition(component, portId) {
        const result = this.findPort(component, portId);
        if (!result) return null;

        const portArray = component[result.type];
        const index = portArray.findIndex(p => p.id === portId);

        return {
            type: result.type,
            index: index,
            y: 30 + (index * 30) // Calculate Y position
        };
    }

    /**
     * Reorder ports
     */
    reorderPorts(component, portType, fromIndex, toIndex) {
        if (!component[portType] || fromIndex === toIndex) {
            return false;
        }

        const ports = component[portType];
        if (fromIndex < 0 || fromIndex >= ports.length ||
            toIndex < 0 || toIndex >= ports.length) {
            return false;
        }

        const [movedPort] = ports.splice(fromIndex, 1);
        ports.splice(toIndex, 0, movedPort);

        return true;
    }
}
