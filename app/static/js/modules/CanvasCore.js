/**
 * CanvasCore - Main canvas class that orchestrates all managers
 */
class BlueprintCanvas {
    constructor() {
        // Base SVG setup
        this.svg = d3.select('#main-canvas');
        this.width = 0;
        this.height = 0;

        this.svg
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('preserveAspectRatio', 'none');

        // Layer order matters: grid -> connections -> components -> overlays
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
            .attr('class', 'overlay-group');

        // Data
        this.components = [];
        this.connections = [];
        this.dragState = null;

        // Helpers
        this.lineGenerator = d3.line().curve(d3.curveBasis);
        this.stateManager = new StateManager();
        this.portManager = new PortManager();
        this.connectionManager = new ConnectionManager(this.connectionLayer, this.lineGenerator);
        this.uiManager = new UIManager(this.svg, this.overlayGroup);

        // Drag handling needs to be created before the component manager
        this.setupDragBehavior();
        this.componentManager = new ComponentManager(this.mainGroup, this.drag, this.portManager);

        // Wire up inter-module callbacks
        this.setupCallbacks();

        // Observe resize of the parent container
        const container = this.svg.node().parentElement;
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        if (container) {
            this.resizeObserver.observe(container);
        }

        // Initial layout + UI wiring
        this.handleResize();
        this.setupGrid();
        this.uiManager.setupContextMenu();
        this.uiManager.setupKeyboardShortcuts();
        this.uiManager.setupSelectionBox();
        this.uiManager.setupZoom((transform) => this.onZoom(transform));
        this.setupDoubleClick();
        this.setupConnectionDrawing();

        // Seed undo history with an empty state
        this.stateManager.saveState(this.components, this.connections);
    }

    /**
     * Hook up callbacks between managers
     */
    setupCallbacks() {
        // Connection creation from ports
        this.componentManager.onConnectionStart = (portGroup) => {
            this.connectionManager.startConnection(portGroup);
        };

        this.componentManager.onConnectionFinish = (portGroup) => {
            const connection = this.connectionManager.finishConnection(portGroup);
            if (!connection) return;

            // Avoid duplicate connections
            if (this.connectionManager.connectionExists(connection.from, connection.to, this.connections)) {
                return;
            }

            const validation = this.connectionManager.validateConnection(
                connection.from,
                connection.to,
                this.components
            );

            if (!validation.valid) {
                console.warn('Invalid connection:', validation.error);
                return;
            }

            this.connections.push(connection);
            this.connectionManager.renderConnection(connection);
            this.stateManager.saveState(this.components, this.connections);
        };

        // Component updates (rename/port changes)
        this.componentManager.onComponentUpdate = (component) => {
            this.updateConnectionsForComponent(component.id);
            this.stateManager.saveState(this.components, this.connections);
        };

        // Connection deletes from UI
        this.connectionManager.onConnectionChange = () => {
            this.stateManager.saveState(this.components, this.connections);
        };

        // UI hooks
        this.uiManager.onContextMenuAction = (action, data) => {
            this.handleContextMenuAction(action, data);
        };

        this.uiManager.onKeyboardAction = (action) => {
            this.handleKeyboardAction(action);
        };

        this.uiManager.onSelectionChange = () => {
            // Selection state is already tracked in UIManager; nothing else needed now
        };
    }

    /**
     * Keep the SVG viewBox and grid sized to the container
     */
    handleResize() {
        const container = this.svg.node()?.parentElement;
        if (!container) return;

        const { width, height } = container.getBoundingClientRect();
        if (!width || !height) return;

        this.width = width;
        this.height = height;

        this.svg
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('width', width)
            .attr('height', height);

        this.gridLayer.selectAll('rect')
            .attr('width', width)
            .attr('height', height);
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
                        return;
                    }

                    const g = d3.select(componentElement);
                    const componentId = g.attr('id');
                    if (!componentId) return;

                    if (!this.uiManager.selectedComponents.has(componentId)) {
                        this.uiManager.clearSelection();
                        this.uiManager.selectComponent(componentId);
                    }

                    // Cache starting positions for all selected components
                    const startPoint = this.getCanvasPoint(event);
                    const positions = new Map();
                    this.uiManager.selectedComponents.forEach(id => {
                        const comp = this.components.find(c => c.id === id);
                        if (comp) {
                            positions.set(id, { x: comp.x, y: comp.y });
                        }
                    });
                    this.dragState = {
                        startPoint,
                        startPositions: positions
                    };
                } catch (error) {
                    console.error('Error in drag start:', error);
                }
            })
            .on('drag', (event) => {
                try {
                    if (!this.dragState) return;

                    const currentPoint = this.getCanvasPoint(event);
                    const dx = currentPoint[0] - this.dragState.startPoint[0];
                    const dy = currentPoint[1] - this.dragState.startPoint[1];

                    this.uiManager.selectedComponents.forEach(componentId => {
                        try {
                            const g = d3.select(`#${componentId}`);
                            if (g.empty()) return;

                            const start = this.dragState.startPositions.get(componentId);
                            const baseX = start ? start.x : 0;
                            const baseY = start ? start.y : 0;

                            const newX = baseX + dx;
                            const newY = baseY + dy;
                            if (!isFinite(newX) || !isFinite(newY)) return;

                            g.attr('transform', `translate(${newX},${newY})`);

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
                    this.dragState = null;
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
     * Setup connection drawing (mouse move/up)
     */
    setupConnectionDrawing() {
        this.svg.on('mousemove', (event) => {
            if (this.connectionManager.isCreatingConnection) {
                const canvasPoint = this.getCanvasPoint(event);
                this.connectionManager.updateTempConnection(event, this.mainGroup, canvasPoint);
            }
        });

        this.svg.on('mouseup', () => {
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
        this.syncCounters();

        return component;
    }

    /**
     * Delete a component
     */
    deleteComponent(componentId) {
        this.connections = this.connections.filter(conn => {
            if (conn.from.startsWith(componentId) || conn.to.startsWith(componentId)) {
                this.connectionManager.deleteConnection(conn);
                return false;
            }
            return true;
        });

        this.components = this.components.filter(c => c.id !== componentId);
        this.componentManager.deleteComponent(componentId);

        this.uiManager.deselectComponent(componentId);
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
        this.syncCounters();
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
        this.syncCounters();
    }

    /**
     * Auto layout components in a simple grid to reduce overlap
     */
    autoLayout() {
        if (!this.components || this.components.length === 0) return;
        const maxWidth = this.components.reduce((m, c) => Math.max(m, c.width || 200), 0);
        const maxHeight = this.components.reduce((m, c) => Math.max(m, c.height || 100), 0);
        const spacingX = maxWidth + 120;
        const spacingY = maxHeight + 120;
        const startX = 200;
        const startY = 160;

        // Build adjacency based on connections (by component id, not port id)
        const parseCompId = (portId) => {
            if (!portId || typeof portId !== 'string') return portId;
            const parts = portId.split('-');
            if (parts.length < 2) return portId;
            parts.pop(); // remove port
            return parts.join('-');
        };

        const indegree = new Map();
        const edges = new Map();
        this.components.forEach(c => {
            indegree.set(c.id, 0);
            edges.set(c.id, new Set());
        });

        this.connections.forEach(conn => {
            const fromComp = parseCompId(conn.from);
            const toComp = parseCompId(conn.to);
            if (!edges.has(fromComp) || !indegree.has(toComp)) return;
            if (!edges.get(fromComp).has(toComp)) {
                edges.get(fromComp).add(toComp);
                indegree.set(toComp, (indegree.get(toComp) || 0) + 1);
            }
        });

        // Kahn-style layering
        const queue = [];
        indegree.forEach((deg, id) => {
            if (deg === 0) queue.push(id);
        });
        if (queue.length === 0) {
            // Fallback: treat all as roots if graph has a cycle
            queue.push(...Array.from(indegree.keys()));
        }

        const level = new Map();
        queue.forEach(id => level.set(id, 0));

        while (queue.length > 0) {
            const current = queue.shift();
            const curLevel = level.get(current) || 0;
            (edges.get(current) || []).forEach(next => {
                const nextLevel = curLevel + 1;
                if (!level.has(next) || nextLevel > level.get(next)) {
                    level.set(next, nextLevel);
                }
                const newDeg = (indegree.get(next) || 1) - 1;
                indegree.set(next, newDeg);
                if (newDeg === 0) queue.push(next);
            });
        }

        // Group by level
        const groups = new Map();
        this.components.forEach(c => {
            const l = level.has(c.id) ? level.get(c.id) : 0;
            if (!groups.has(l)) groups.set(l, []);
            groups.get(l).push(c);
        });

        // Sort levels and components for stability
        const sortedLevels = Array.from(groups.keys()).sort((a, b) => a - b);
        sortedLevels.forEach(lvl => {
            groups.get(lvl).sort((a, b) => a.id.localeCompare(b.id));
        });

        // Apply positions
        sortedLevels.forEach((lvl, idxLevel) => {
            const comps = groups.get(lvl);
            const totalWidth = (comps.length - 1) * spacingX;
            const offset = -totalWidth / 2;
            comps.forEach((comp, idxComp) => {
                comp.x = startX + offset + idxComp * spacingX;
                comp.y = startY + idxLevel * spacingY;
            });
        });

        // Simple overlap resolution pass
        const padding = 40;
        const compsSorted = [...this.components].sort((a, b) => a.y - b.y || a.x - b.x);
        let moved = true;
        let passes = 0;
        while (moved && passes < 10) {
            moved = false;
            passes += 1;
            for (let i = 0; i < compsSorted.length; i++) {
                for (let j = i + 1; j < compsSorted.length; j++) {
                    const a = compsSorted[i];
                    const b = compsSorted[j];
                    const ax2 = a.x + (a.width || maxWidth);
                    const bx2 = b.x + (b.width || maxWidth);
                    const ay2 = a.y + (a.height || maxHeight);
                    const by2 = b.y + (b.height || maxHeight);
                    const overlapX = Math.min(ax2, bx2) - Math.max(a.x, b.x);
                    const overlapY = Math.min(ay2, by2) - Math.max(a.y, b.y);
                    if (overlapX > 0 && overlapY > 0) {
                        // Push along the larger overlap axis to separate
                        if (overlapX >= overlapY) {
                            b.x += overlapX + padding;
                        } else {
                            b.y += overlapY + padding;
                        }
                        moved = true;
                    }
                }
            }
        }

        // Re-render components at new positions
        this.mainGroup.selectAll('.component').remove();
        this.components.forEach(component => {
            this.componentManager.renderComponent(component);
        });

        // Rerender connections after moving
        this.connectionLayer.selectAll('.connection').remove();
        this.connections.forEach(connection => this.connectionManager.renderConnection(connection));

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
        this.syncCounters();
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
     * Undo last action
     */
    undo() {
        const state = this.stateManager.undo(this.components, this.connections);
        if (state) {
            this.loadState(state);
        }
    }

    /**
     * Redo last undone action
     */
    redo() {
        const state = this.stateManager.redo(this.components, this.connections);
        if (state) {
            this.loadState(state);
        }
    }

    /**
     * Reset and render the canvas from a saved state
     */
    loadState(state) {
        this.mainGroup.selectAll('.component').remove();
        this.connectionLayer.selectAll('.connection').remove();

        this.components = JSON.parse(JSON.stringify(state.components));
        this.connections = JSON.parse(JSON.stringify(state.connections));

        this.components.forEach(component => {
            // Ensure minimal sizing defaults if missing
            component.width = component.width || 200;
            component.height = component.height || 100;
            this.componentManager.renderComponent(component);
        });

        this.connections.forEach(connection => {
            this.connectionManager.renderConnection(connection);
        });

        this.syncCounters();
    }

    /**
     * Save to JSON file
     */
    saveToJson() {
        this.stateManager.saveToJsonFile(this.components, this.connections);
    }

    /**
     * Load blueprint data from an API response
     */
    loadBlueprint(blueprint) {
        if (!blueprint || !Array.isArray(blueprint.components) || !Array.isArray(blueprint.connections)) {
            console.warn('Invalid blueprint payload', blueprint);
            return;
        }
        this.loadState({
            components: blueprint.components,
            connections: blueprint.connections
        });
        this.stateManager.saveState(this.components, this.connections);

        // Expose metadata for UI (e.g., display current file)
        this.currentMetadata = blueprint.metadata || {};
        if (window.setBlueprintInfo) {
            if (this.currentMetadata.file) {
                window.setBlueprintInfo(`File: ${this.currentMetadata.file}`);
            } else if (this.currentMetadata.root) {
                window.setBlueprintInfo(`Codebase: ${this.currentMetadata.root}`);
            }
        }
    }

    /**
     * Create a simple preset blueprint (used by AI/local commands)
     */
    createPresetBlueprint(presetKey) {
        const presets = {
            realtime_analytics_gateway: {
                nodes: [
                    { name: 'Client', type: 'module' },
                    { name: 'API Gateway', type: 'module' },
                    { name: 'Realtime Service', type: 'function' },
                    { name: 'Analytics Service', type: 'function' },
                    { name: 'Message Broker', type: 'module' },
                    { name: 'Data Warehouse', type: 'module' }
                ],
                edges: [
                    ['Client', 'API Gateway'],
                    ['API Gateway', 'Realtime Service'],
                    ['API Gateway', 'Analytics Service'],
                    ['Realtime Service', 'Message Broker'],
                    ['Message Broker', 'Analytics Service'],
                    ['Analytics Service', 'Data Warehouse']
                ]
            },
            ecommerce: {
                nodes: [
                    { name: 'Clients', type: 'module' },
                    { name: 'API Gateway', type: 'module' },
                    { name: 'Auth Service', type: 'function' },
                    { name: 'Product Service', type: 'function' },
                    { name: 'Order Service', type: 'function' },
                    { name: 'Payment Service', type: 'function' },
                    { name: 'Inventory Service', type: 'function' },
                    { name: 'Search Service', type: 'function' },
                    { name: 'Message Queue', type: 'module' },
                    { name: 'Cache', type: 'module' },
                    { name: 'Database', type: 'module' },
                    { name: 'Object Storage', type: 'module' }
                ],
                edges: [
                    ['Clients', 'API Gateway'],
                    ['API Gateway', 'Auth Service'],
                    ['API Gateway', 'Product Service'],
                    ['API Gateway', 'Order Service'],
                    ['API Gateway', 'Search Service'],
                    ['Order Service', 'Payment Service'],
                    ['Order Service', 'Message Queue'],
                    ['Payment Service', 'Message Queue'],
                    ['Inventory Service', 'Message Queue'],
                    ['Message Queue', 'Inventory Service'],
                    ['Product Service', 'Cache'],
                    ['Product Service', 'Database'],
                    ['Order Service', 'Database'],
                    ['Inventory Service', 'Database'],
                    ['Search Service', 'Object Storage'],
                    ['Product Service', 'Object Storage']
                ]
            }
        };

        const spec = presets[presetKey] || presets.ecommerce;
        if (!spec) return;

        // Clear current diagram
        this.mainGroup.selectAll('.component').remove();
        this.connectionLayer.selectAll('.connection').remove();
        this.components = [];
        this.connections = [];

        // Create nodes
        spec.nodes.forEach((item) => {
            const component = this.componentManager.createComponent(0, 0, item.type);
            if (!component) return;
            component.name = item.name;
            this.components.push(component);
        });

        const idByName = new Map();
        this.components.forEach(c => idByName.set(c.name, c.id));

        // Create edges
        spec.edges.forEach(edge => {
            const [fromName, toName] = edge;
            const fromId = idByName.get(fromName);
            const toId = idByName.get(toName);
            if (!fromId || !toId) return;
            const fromComp = this.components.find(c => c.id === fromId);
            const toComp = this.components.find(c => c.id === toId);
            if (!fromComp || !toComp || !fromComp.outputs?.length || !toComp.inputs?.length) return;
            const fromPort = `${fromId}-${fromComp.outputs[0].id}`;
            const toPort = `${toId}-${toComp.inputs[0].id}`;
            this.connections.push({ from: fromPort, to: toPort });
        });

        this.components.forEach(c => this.componentManager.renderComponent(c));
        this.connections.forEach(conn => this.connectionManager.renderConnection(conn));

        this.autoLayout();
        this.stateManager.saveState(this.components, this.connections);
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
     * Handle zoom event - rerender connections for crispness
     */
    onZoom(transform) {
        this.connections.forEach(connection => {
            this.connectionManager.rerenderConnection(connection);
        });
    }

    /**
     * Sync component/port counters with current state to avoid duplicate IDs
     */
    syncCounters() {
        const maxComponentId = this.components.reduce((max, component) => {
            const match = component.id?.match(/(\d+)$/);
            const idNumber = match ? parseInt(match[1], 10) : 0;
            return Math.max(max, idNumber);
        }, 0);

        this.componentManager.componentIdCounter = Math.max(
            this.componentManager.componentIdCounter,
            maxComponentId + 1
        );

        const maxPortId = this.components.reduce((max, component) => {
            const ports = [...(component.inputs || []), ...(component.outputs || [])];
            ports.forEach(port => {
                const match = port.id?.match(/(\d+)$/);
                const portNum = match ? parseInt(match[1], 10) : 0;
                max = Math.max(max, portNum);
            });
            return max;
        }, 0);

        this.portManager.portIdCounter = Math.max(
            this.portManager.portIdCounter,
            maxPortId + 1
        );
    }

    /**
     * Component types (delegated to ComponentManager)
     */
    static get COMPONENT_TYPES() {
        return ComponentManager.COMPONENT_TYPES;
    }

    /**
     * Convert mouse event to untransformed canvas coords
     */
    getCanvasPoint(event) {
        const t = d3.zoomTransform(this.svg.node());
        const [px, py] = d3.pointer(event, this.svg.node());
        return [(px - t.x) / t.k, (py - t.y) / t.k];
    }

    /**
     * Create or reuse a component by name/type
     */
    getOrCreateComponent(name, type = 'function') {
        const existing = this.components.find(c => c.name === name);
        if (existing) return existing;
        const comp = this.componentManager.createComponent(0, 0, type);
        if (!comp) return null;
        comp.name = name;
        this.components.push(comp);
        return comp;
    }

    /**
     * Add a connection using component names (creates components if needed)
     */
    addConnectionByNames(fromName, toName) {
        const fromComp = this.getOrCreateComponent(fromName, 'function');
        const toComp = this.getOrCreateComponent(toName, 'function');
        if (!fromComp || !toComp) return;
        if (!fromComp.outputs?.length || !toComp.inputs?.length) return;
        const fromPort = `${fromComp.id}-${fromComp.outputs[0].id}`;
        const toPort = `${toComp.id}-${toComp.inputs[0].id}`;
        if (this.connectionManager.connectionExists(fromPort, toPort, this.connections)) return;
        this.connections.push({ from: fromPort, to: toPort });
    }

    /**
     * Prompt-to-structure mapper: creates nodes/edges based on keywords
     */
    createFromPrompt(promptText) {
        if (!promptText || typeof promptText !== 'string') return;
        const p = promptText.toLowerCase();

        const domainSpecs = [
            {
                match: ['microcontroller', 'embedded', 'iot', 'sensor', 'stepper'],
                nodes: [
                    { name: 'Microcontroller', type: 'module' },
                    { name: 'Motor Driver', type: 'module' },
                    { name: 'Stepper Motors', type: 'module' },
                    { name: 'Sensors', type: 'module' },
                    { name: 'Control Loop', type: 'function' },
                    { name: 'Telemetry/Uplink', type: 'function' }
                ],
                edges: [
                    ['Microcontroller', 'Motor Driver'],
                    ['Motor Driver', 'Stepper Motors'],
                    ['Sensors', 'Control Loop'],
                    ['Control Loop', 'Motor Driver'],
                    ['Control Loop', 'Telemetry/Uplink']
                ]
            },
            {
                match: ['ecommerce', 'shop', 'product', 'order', 'cart', 'checkout'],
                preset: 'ecommerce'
            },
            {
                match: ['analytics', 'warehouse', 'pipeline', 'etl'],
                nodes: [
                    { name: 'Ingestion', type: 'function' },
                    { name: 'Stream Processor', type: 'function' },
                    { name: 'Data Lake', type: 'module' },
                    { name: 'Warehouse', type: 'module' },
                    { name: 'Dashboard', type: 'module' }
                ],
                edges: [
                    ['Ingestion', 'Stream Processor'],
                    ['Stream Processor', 'Data Lake'],
                    ['Stream Processor', 'Warehouse'],
                    ['Warehouse', 'Dashboard']
                ]
            }
        ];

        // Pick first matching domain
        let spec = null;
        for (const d of domainSpecs) {
            if (d.match && d.match.some(k => p.includes(k))) {
                spec = d;
                break;
            }
        }

        if (spec?.preset) {
            this.createPresetBlueprint(spec.preset);
            return;
        }

        const nodes = spec?.nodes || [
            { name: 'Client', type: 'module' },
            { name: 'API', type: 'module' },
            { name: 'Service A', type: 'function' },
            { name: 'Service B', type: 'function' },
            { name: 'Database', type: 'module' }
        ];
        const edges = spec?.edges || [
            ['Client', 'API'],
            ['API', 'Service A'],
            ['API', 'Service B'],
            ['Service A', 'Database'],
            ['Service B', 'Database']
        ];

        // Merge into existing diagram
        nodes.forEach(n => this.getOrCreateComponent(n.name, n.type));
        edges.forEach(e => this.addConnectionByNames(e[0], e[1]));

        // Re-render everything
        this.mainGroup.selectAll('.component').remove();
        this.connectionLayer.selectAll('.connection').remove();
        this.components.forEach(c => this.componentManager.renderComponent(c));
        this.connections.forEach(conn => this.connectionManager.renderConnection(conn));

        this.autoLayout();
        this.stateManager.saveState(this.components, this.connections);
    }
}
