/**
 * CanvasCore - Main canvas class that orchestrates all managers
 */
class BlueprintCanvas {
    constructor() {
        // Initialize SVG and layers
        this.svg = d3.select('#main-canvas');
        this.width = this.svg.node().parentElement.clientWidth;
        this.height = this.svg.node().parentElement.clientHeight;

        this.svg
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

        // Create layers
        this.gridLayer = this.svg.append('g')
            .attr('class', 'grid-layer')
            .style('pointer-events', 'all');

        this.connectionLayer = this.svg.append('g')
            .attr('class', 'connection-layer')
            .style('pointer-events', 'none');

        this.mainGroup = this.svg.append('g')
            .attr('class', 'main-group')
            .style('pointer-events', 'all');

        this.overlayGroup = this.svg.append('g')
            .attr('class', 'overlay-group')
            .style('pointer-events', 'none');

        // Data
        this.components = [];
        this.connections = [];

        // Line generator for connections
        this.lineGenerator = d3.line().curve(d3.curveBasis);

        // Initialize managers
        this.stateManager = new StateManager();
        this.portManager = new PortManager();
        this.connectionManager = new ConnectionManager(this.connectionLayer, this.lineGenerator);
        this.uiManager = new UIManager(this.svg, this.overlayGroup);

        // Setup drag behavior before component manager
        this.setupDragBehavior();

        this.componentManager = new ComponentManager(this.mainGroup, this.drag, this.portManager);

        // Wire up callbacks
        this.setupCallbacks();

        // Initialize UI
        this.setupGrid();
        this.uiManager.setupContextMenu();
        this.uiManager.setupKeyboardShortcuts();
        this.uiManager.setupSelectionBox();
        this.uiManager.setupZoom((transform) => this.onZoom(transform));

        // Setup double-click to create component
        this.setupDoubleClick();

        // Setup connection drawing
        this.setupConnectionDrawing();
    }

    /**
     * Wire up callbacks between managers
     */
    setupCallbacks() {
        // Component manager callbacks
        this.componentManager.onConnectionStart = (portGroup) => {
            this.connectionManager.startConnection(portGroup);
        };

        this.componentManager.onConnectionFinish = (portGroup) => {
            const connection = this.connectionManager.finishConnection(portGroup);
            if (connection) {
                const validation = this.connectionManager.validateConnection(
                    connection.from,
                    connection.to,
                    this.components
                );

                if (validation.valid) {
                    this.connections.push(connection);
                    this.connectionManager.renderConnection(connection);
                    this.stateManager.saveState(this.components, this.connections);
                }
            }
        };

        this.componentManager.onComponentUpdate = (component) => {
            this.updateConnectionsForComponent(component.id);
            this.stateManager.saveState(this.components, this.connections);
        };

        // Connection manager callbacks
        this.connectionManager.onConnectionChange = () => {
            this.stateManager.saveState(this.components, this.connections);
        };

        // UI manager callbacks
        this.uiManager.onContextMenuAction = (action, data) => {
            this.handleContextMenuAction(action, data);
        };

        this.uiManager.onKeyboardAction = (action) => {
            this.handleKeyboardAction(action);
        };

        this.uiManager.onSelectionChange = (selectedIds) => {
            // Handle selection changes if needed
        };
    }

    /**
     * Setup grid background
     */
    setupGrid() {
        const gridSize = 30;
        const defs = this.svg.append('defs');

        // Small grid pattern
        const pattern = defs.append('pattern')
            .attr('id', 'grid')
            .attr('width', gridSize)
            .attr('height', gridSize)
            .attr('patternUnits', 'userSpaceOnUse');

        pattern.append('path')
            .attr('d', `M ${gridSize} 0 L 0 0 0 ${gridSize}`)
            .attr('fill', 'none')
            .attr('stroke', '#283593')
            .attr('stroke-width', '0.5');

        // Major grid pattern
        const majorGridSize = gridSize * 5;
        const majorPattern = defs.append('pattern')
            .attr('id', 'major-grid')
            .attr('width', majorGridSize)
            .attr('height', majorGridSize)
            .attr('patternUnits', 'userSpaceOnUse');

        majorPattern.append('path')
            .attr('d', `M ${majorGridSize} 0 L 0 0 0 ${majorGridSize}`)
            .attr('fill', 'none')
            .attr('stroke', '#3949ab')
            .attr('stroke-width', '1');

        // Add grid rectangles
        this.gridLayer.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'url(#grid)')
            .style('pointer-events', 'all');

        this.gridLayer.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'url(#major-grid)')
            .style('pointer-events', 'all');

        // Transparent overlay to ensure clicks are captured
        this.gridLayer.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'transparent')
            .style('pointer-events', 'all');
    }

    /**
     * Setup drag behavior for components
     */
    setupDragBehavior() {
        this.drag = d3.drag()
            .on('start', (event) => {
                try {
                    const componentElement = event.sourceEvent.target.closest('.component');
                    if (!componentElement) {
                        console.warn('Drag started on non-component element');
                        return;
                    }

                    const g = d3.select(componentElement);
                    const componentId = g.attr('id');

                    if (!componentId) {
                        console.warn('Component element missing ID attribute');
                        return;
                    }

                    if (!this.uiManager.selectedComponents.has(componentId)) {
                        this.uiManager.clearSelection();
                        this.uiManager.selectComponent(componentId);
                    }
                } catch (error) {
                    console.error('Error in drag start:', error);
                }
            })
            .on('drag', (event) => {
                try {
                    if (!event.dx || !event.dy) return;

                    this.uiManager.selectedComponents.forEach(componentId => {
                        try {
                            const g = d3.select(`#${componentId}`);
                            if (g.empty()) {
                                console.warn(`Component not found: ${componentId}`);
                                return;
                            }

                            const transform = g.attr('transform');
                            let x = 0, y = 0;

                            if (transform) {
                                const parts = transform.match(/translate\(([^,]+),([^)]+)\)/);
                                if (parts && parts.length >= 3) {
                                    const parsedX = parseFloat(parts[1]);
                                    const parsedY = parseFloat(parts[2]);
                                    if (!isNaN(parsedX) && !isNaN(parsedY)) {
                                        x = parsedX;
                                        y = parsedY;
                                    }
                                }
                            }

                            const newX = x + event.dx;
                            const newY = y + event.dy;

                            // Validate new positions are finite numbers
                            if (!isFinite(newX) || !isFinite(newY)) {
                                console.warn(`Invalid position calculated: (${newX}, ${newY})`);
                                return;
                            }

                            g.attr('transform', `translate(${newX},${newY})`);

                            // Update component data
                            const component = this.components.find(c => c.id === componentId);
                            if (component) {
                                component.x = newX;
                                component.y = newY;
                            }

                            this.updateConnectionsForComponent(componentId);
                        } catch (error) {
                            console.error(`Error dragging component ${componentId}:`, error);
                        }
                    });
                } catch (error) {
                    console.error('Error in drag event:', error);
                }
            })
            .on('end', () => {
                try {
                    this.stateManager.saveState(this.components, this.connections);
                } catch (error) {
                    console.error('Error saving state after drag:', error);
                }
            });
    }

    /**
     * Setup double-click to create component
     */
    setupDoubleClick() {
        this.gridLayer.on('dblclick', (event) => {
            // Check if click is on a component or port
            const target = event.target;
            if (target.closest('.component') || target.closest('.port')) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const [x, y] = d3.pointer(event, this.svg.node());
            this.createComponent(x, y, 'function');
        });
    }

    /**
     * Setup connection drawing (mouse move)
     */
    setupConnectionDrawing() {
        this.svg.on('mousemove', (event) => {
            if (this.connectionManager.isCreatingConnection) {
                this.connectionManager.updateTempConnection(event, this.mainGroup);
            }
        });

        this.svg.on('mouseup', (event) => {
            if (this.connectionManager.isCreatingConnection) {
                this.connectionManager.cancelConnection();
            }
        });
    }

    /**
     * Create a new component
     */
    createComponent(x, y, type = 'function') {
        const component = this.componentManager.createComponent(x, y, type);
        if (!component) return null;

        this.components.push(component);
        this.componentManager.renderComponent(component);
        this.stateManager.saveState(this.components, this.connections);

        return component;
    }

    /**
     * Delete a component
     */
    deleteComponent(componentId) {
        // Remove connections
        this.connections = this.connections.filter(conn => {
            if (conn.from.startsWith(componentId) || conn.to.startsWith(componentId)) {
                this.connectionManager.deleteConnection(conn);
                return false;
            }
            return true;
        });

        // Remove component
        this.components = this.components.filter(c => c.id !== componentId);
        this.componentManager.deleteComponent(componentId);

        this.stateManager.saveState(this.components, this.connections);
    }

    /**
     * Update all connections for a component
     */
    updateConnectionsForComponent(componentId) {
        this.connectionManager.updateConnectionsForComponent(componentId, this.connections);
    }

    /**
     * Handle context menu actions
     */
    handleContextMenuAction(action, data) {
        switch (action) {
            case 'createComponent':
                this.createComponent(data.x, data.y, data.type);
                break;
            case 'deleteComponent':
                this.deleteComponent(data);
                break;
            case 'duplicateComponent':
                this.duplicateComponent(data);
                break;
            case 'rename':
                this.startRenaming(data);
                break;
            case 'addInputPort':
                this.addPort(data, 'inputs');
                break;
            case 'addOutputPort':
                this.addPort(data, 'outputs');
                break;
        }
    }

    /**
     * Handle keyboard actions
     */
    handleKeyboardAction(action) {
        switch (action) {
            case 'copy':
                this.copySelectedComponents();
                break;
            case 'paste':
                this.pasteComponents();
                break;
            case 'cut':
                this.cutSelectedComponents();
                break;
            case 'delete':
                this.deleteSelectedComponents();
                break;
            case 'duplicate':
                this.duplicateSelectedComponents();
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'selectAll':
                this.uiManager.selectAll();
                break;
            case 'save':
                this.saveToJson();
                break;
        }
    }

    /**
     * Add port to component
     */
    addPort(componentId, portType) {
        const component = this.components.find(c => c.id === componentId);
        if (!component) return;

        this.portManager.addPort(component, portType);
        this.componentManager.rerenderComponent(component);
        this.updateConnectionsForComponent(componentId);
        this.stateManager.saveState(this.components, this.connections);
    }

    /**
     * Start renaming a component
     */
    startRenaming(componentId) {
        const component = this.components.find(c => c.id === componentId);
        if (!component) return;

        const g = d3.select(`#${componentId}`);
        this.componentManager.editComponentName(g, component);
    }

    /**
     * Duplicate a component
     */
    duplicateComponent(componentId) {
        const component = this.components.find(c => c.id === componentId);
        if (!component) return;

        const newComponent = JSON.parse(JSON.stringify(component));
        newComponent.id = this.componentManager.getNextComponentId();
        newComponent.x += 50;
        newComponent.y += 50;

        this.components.push(newComponent);
        this.componentManager.renderComponent(newComponent);
        this.stateManager.saveState(this.components, this.connections);
    }

    /**
     * Copy selected components
     */
    copySelectedComponents() {
        const selectedComponents = this.uiManager.getSelectedComponents();
        const components = selectedComponents.map(id =>
            this.components.find(c => c.id === id)
        ).filter(c => c);

        this.stateManager.copyComponents(components);
    }

    /**
     * Paste components
     */
    pasteComponents() {
        const clipboard = this.stateManager.getClipboard();
        if (!clipboard || clipboard.length === 0) return;

        this.uiManager.clearSelection();
        const offset = 50;

        clipboard.forEach(component => {
            const newComponent = JSON.parse(JSON.stringify(component));
            newComponent.id = this.componentManager.getNextComponentId();
            newComponent.x += offset;
            newComponent.y += offset;

            this.components.push(newComponent);
            this.componentManager.renderComponent(newComponent);
            this.uiManager.selectComponent(newComponent.id, true);
        });

        this.stateManager.saveState(this.components, this.connections);
    }

    /**
     * Cut selected components
     */
    cutSelectedComponents() {
        this.copySelectedComponents();
        this.deleteSelectedComponents();
    }

    /**
     * Delete selected components
     */
    deleteSelectedComponents() {
        const selectedComponents = this.uiManager.getSelectedComponents();
        selectedComponents.forEach(id => {
            this.deleteComponent(id);
        });
        this.uiManager.clearSelection();
    }

    /**
     * Duplicate selected components
     */
    duplicateSelectedComponents() {
        this.copySelectedComponents();
        this.pasteComponents();
    }

    /**
     * Undo
     */
    undo() {
        const state = this.stateManager.undo(this.components, this.connections);
        if (state) {
            this.loadState(state);
        }
    }

    /**
     * Redo
     */
    redo() {
        const state = this.stateManager.redo(this.components, this.connections);
        if (state) {
            this.loadState(state);
        }
    }

    /**
     * Load state
     */
    loadState(state) {
        // Clear canvas
        this.mainGroup.selectAll('.component').remove();
        this.connectionLayer.selectAll('.connection').remove();

        // Load data
        this.components = JSON.parse(JSON.stringify(state.components));
        this.connections = JSON.parse(JSON.stringify(state.connections));

        // Render
        this.components.forEach(component => {
            this.componentManager.renderComponent(component);
        });

        this.connections.forEach(connection => {
            this.connectionManager.renderConnection(connection);
        });
    }

    /**
     * Save to JSON file
     */
    saveToJson() {
        this.stateManager.saveToJsonFile(this.components, this.connections);
    }

    /**
     * Load from JSON file
     */
    async loadFromJson(file) {
        try {
            const result = await this.stateManager.loadFromFile(file);
            this.loadState(result);
            this.stateManager.saveState(this.components, this.connections);
            return true;
        } catch (error) {
            console.error('Error loading blueprint:', error);
            alert('Error loading blueprint file');
            return false;
        }
    }

    /**
     * Test method for creating a component
     */
    testCreateComponent() {
        const component = this.createComponent(100, 100, 'function');
        return component;
    }

    /**
     * Handle zoom event
     */
    onZoom(transform) {
        // Update connections when zooming
        this.connections.forEach(connection => {
            this.connectionManager.rerenderConnection(connection);
        });
    }

    /**
     * Get component types (static reference)
     */
    static get COMPONENT_TYPES() {
        return ComponentManager.COMPONENT_TYPES;
    }
}
