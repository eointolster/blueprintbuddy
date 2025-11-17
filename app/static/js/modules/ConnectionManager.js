/**
 * ConnectionManager - Handles connections between component ports
 */
class ConnectionManager {
    constructor(connectionLayer, lineGenerator) {
        this.connectionLayer = connectionLayer;
        this.lineGenerator = lineGenerator;
        this.isCreatingConnection = false;
        this.startPort = null;
        this.tempConnection = null;
        this.onConnectionChange = null;
    }

    /**
     * Start creating a connection from an output port
     */
    startConnection(portGroup) {
        this.isCreatingConnection = true;
        this.startPort = portGroup;

        // Create temporary connection line
        this.tempConnection = this.connectionLayer.append('path')
            .attr('class', 'connection temp-connection')
            .attr('stroke', '#29b6f6')
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .style('pointer-events', 'none');

        return true;
    }

    /**
     * Update temporary connection as mouse moves
     */
    updateTempConnection(event, mainGroup) {
        if (!this.isCreatingConnection || !this.startPort) return;

        const startPortElement = this.startPort.select('circle');
        const startComponentId = this.startPort.attr('id').split('-')[0];
        const startComponent = d3.select(`#${startComponentId}`);

        const [compX, compY] = this.parseTransform(startComponent.attr('transform'));
        const startX = compX + parseFloat(startPortElement.attr('cx'));
        const startY = compY + parseFloat(startPortElement.attr('cy'));

        const [mouseX, mouseY] = d3.pointer(event, mainGroup.node());

        const points = [
            [startX, startY],
            [startX + (mouseX - startX) / 2, startY],
            [startX + (mouseX - startX) / 2, mouseY],
            [mouseX, mouseY]
        ];

        this.tempConnection.attr('d', this.lineGenerator(points));
    }

    /**
     * Finish creating a connection at an input port
     */
    finishConnection(endPort) {
        if (!this.isCreatingConnection || !this.startPort) {
            return null;
        }

        try {
            const startPortId = this.startPort.attr('id');
            const endPortId = endPort.attr('id');

            if (!startPortId || !endPortId) {
                console.warn('Invalid port IDs');
                this.cancelConnection();
                return null;
            }

            const connection = {
                from: startPortId,
                to: endPortId
            };

            return connection;

        } catch (error) {
            console.error('Error finishing connection:', error);
            return null;
        } finally {
            this.cancelConnection();
        }
    }

    /**
     * Cancel connection creation
     */
    cancelConnection() {
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
        this.isCreatingConnection = false;
        this.startPort = null;
    }

    /**
     * Render a connection on the canvas
     */
    renderConnection(connection) {
        if (!connection || !connection.from || !connection.to) {
            console.warn('Invalid connection data:', connection);
            return null;
        }

        try {
            // Get the port elements
            const fromElement = d3.select(`#${connection.from}`);
            const toElement = d3.select(`#${connection.to}`);

            if (fromElement.empty() || toElement.empty()) {
                console.warn('Connection ports not found:', connection);
                return null;
            }

            // Get parent components
            const fromComponent = d3.select(fromElement.node().closest('.component'));
            const toComponent = d3.select(toElement.node().closest('.component'));

            if (fromComponent.empty() || toComponent.empty()) {
                console.warn('Parent components not found for ports');
                return null;
            }

            // Get port circles
            const fromPort = fromElement.select('circle');
            const toPort = toElement.select('circle');

            if (fromPort.empty() || toPort.empty()) {
                console.warn('Port circles not found');
                return null;
            }

            // Get component transforms
            const fromTransform = fromComponent.attr('transform');
            const toTransform = toComponent.attr('transform');

            const [fromCompX, fromCompY] = this.parseTransform(fromTransform);
            const [toCompX, toCompY] = this.parseTransform(toTransform);

            // Get port positions
            const fromPortX = parseFloat(fromPort.attr('cx') || 0);
            const fromPortY = parseFloat(fromPort.attr('cy') || 0);
            const toPortX = parseFloat(toPort.attr('cx') || 0);
            const toPortY = parseFloat(toPort.attr('cy') || 0);

            // Calculate absolute positions
            const startX = fromCompX + fromPortX;
            const startY = fromCompY + fromPortY;
            const endX = toCompX + toPortX;
            const endY = toCompY + toPortY;

            // Create curved path
            const points = [
                [startX, startY],
                [startX + (endX - startX) / 2, startY],
                [startX + (endX - startX) / 2, endY],
                [endX, endY]
            ];

            // Create or update the connection path
            const connectionId = `connection-${connection.from}-${connection.to}`;
            let connectionPath = this.connectionLayer.select(`#${connectionId}`);

            if (connectionPath.empty()) {
                connectionPath = this.connectionLayer.append('path')
                    .attr('id', connectionId)
                    .attr('class', 'connection');
            }

            connectionPath
                .attr('d', this.lineGenerator(points))
                .attr('stroke', '#29b6f6')
                .attr('stroke-width', 2)
                .attr('fill', 'none')
                .style('pointer-events', 'all')
                .on('mouseenter', function () {
                    d3.select(this)
                        .attr('stroke', '#f44336')
                        .attr('stroke-width', 3);
                })
                .on('mouseleave', function () {
                    d3.select(this)
                        .attr('stroke', '#29b6f6')
                        .attr('stroke-width', 2);
                })
                .on('contextmenu', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.deleteConnection(connection);
                    if (this.onConnectionChange) {
                        this.onConnectionChange();
                    }
                });

            return connectionPath;

        } catch (error) {
            console.error('Error rendering connection:', error);
            return null;
        }
    }

    /**
     * Delete a connection
     */
    deleteConnection(connection) {
        const connectionId = `connection-${connection.from}-${connection.to}`;
        d3.select(`#${connectionId}`).remove();
        return true;
    }

    /**
     * Update all connections for a component
     */
    updateConnectionsForComponent(componentId, connections) {
        const relatedConnections = connections.filter(conn =>
            conn.from.startsWith(componentId) || conn.to.startsWith(componentId)
        );

        relatedConnections.forEach(connection => {
            this.rerenderConnection(connection);
        });

        return relatedConnections.length;
    }

    /**
     * Re-render a connection (after component moves)
     */
    rerenderConnection(connection) {
        // Remove old connection
        this.deleteConnection(connection);

        // Render new connection
        return this.renderConnection(connection);
    }

    /**
     * Validate a connection between two ports
     */
    validateConnection(fromPort, toPort, components) {
        // Find the components
        const fromComponentId = fromPort.split('-')[0];
        const toComponentId = toPort.split('-')[0];

        const fromComponent = components.find(c => c.id === fromComponentId);
        const toComponent = components.find(c => c.id === toComponentId);

        if (!fromComponent || !toComponent) {
            return { valid: false, error: 'Component not found' };
        }

        // Find the ports
        const fromPortId = fromPort.replace(`${fromComponentId}-`, '');
        const toPortId = toPort.replace(`${toComponentId}-`, '');

        const fromPortData = fromComponent.outputs?.find(p => p.id === fromPortId);
        const toPortData = toComponent.inputs?.find(p => p.id === toPortId);

        if (!fromPortData) {
            return { valid: false, error: 'From port not found or not an output' };
        }

        if (!toPortData) {
            return { valid: false, error: 'To port not found or not an input' };
        }

        // Check type compatibility
        if (fromPortData.type !== 'any' &&
            toPortData.type !== 'any' &&
            fromPortData.type !== toPortData.type) {
            return {
                valid: true,
                warning: `Type mismatch: ${fromPortData.type} -> ${toPortData.type}`
            };
        }

        return { valid: true };
    }

    /**
     * Parse transform attribute
     */
    parseTransform(transform) {
        if (!transform) return [0, 0];
        const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
        if (match) {
            return [parseFloat(match[1]), parseFloat(match[2])];
        }
        return [0, 0];
    }

    /**
     * Get all connections for a specific port
     */
    getConnectionsForPort(portId, connections) {
        return connections.filter(conn =>
            conn.from === portId || conn.to === portId
        );
    }

    /**
     * Check if a connection already exists
     */
    connectionExists(fromPort, toPort, connections) {
        return connections.some(conn =>
            conn.from === fromPort && conn.to === toPort
        );
    }

    /**
     * Clear all connections
     */
    clearAllConnections() {
        this.connectionLayer.selectAll('.connection').remove();
    }
}
