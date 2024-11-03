class BlueprintCanvas {
    static get COMPONENT_TYPES() {
        return {
            FUNCTION: {
                name: 'function',
                color: 'rgba(13, 71, 161, 0.6)',
                borderColor: '#29b6f6',
                defaultPorts: {
                    inputs: [{ name: 'input1', id: 'in1', type: 'any' }],
                    outputs: [{ name: 'output1', id: 'out1', type: 'any' }]
                }
            },
            CLASS: {
                name: 'class',
                color: 'rgba(56, 142, 60, 0.6)',
                borderColor: '#66bb6a',
                defaultPorts: {
                    inputs: [{ name: 'constructor', id: 'in1', type: 'any' }],
                    outputs: [{ name: 'instance', id: 'out1', type: 'object' }]
                }
            },
            MODULE: {
                name: 'module',
                color: 'rgba(136, 14, 79, 0.6)',
                borderColor: '#ec407a',
                defaultPorts: {
                    inputs: [{ name: 'import', id: 'in1', type: 'any' }],
                    outputs: [{ name: 'export', id: 'out1', type: 'any' }]
                }
            }
        };
    }

    constructor() {
        this.svg = d3.select('#main-canvas');
        this.components = [];
        this.connections = [];
        this.selectedComponents = new Set();
        this.nextId = 1;
        this.isResizing = false;
        this.isDragging = false;
        this.isSelecting = false;
        this.selectionRect = null;
        this.clipboard = null;
        this.undoStack = [];
        this.redoStack = [];
        
        this.gridLayer = this.svg.append('g').attr('class', 'grid-layer');
        this.connectionLayer = this.svg.append('g').attr('class', 'connection-layer');
        this.mainGroup = this.svg.append('g').attr('class', 'main-group');
        this.overlayGroup = this.svg.append('g').attr('class', 'overlay-group');
        
        this.width = this.svg.node().parentElement.clientWidth;
        this.height = this.svg.node().parentElement.clientHeight;
        
        this.svg
            .attr('width', this.width)
            .attr('height', this.height);

        this.lineGenerator = d3.line().curve(d3.curveBasis);
        this.setupGrid();
        this.setupDragBehavior();
        this.setupContextMenu();
        this.setupKeyboardShortcuts();
        this.setupZoom();
        this.setupSelectionBox();
        
        this.currentScale = 1;
        this.currentTranslate = [0, 0];
        
    // Create layers in correct order
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

    // Set up basic properties
    this.width = this.svg.node().parentElement.clientWidth;
    this.height = this.svg.node().parentElement.clientHeight;
    
    this.svg
        .attr('width', this.width)
        .attr('height', this.height);

    // Initialize other properties
    this.components = [];
    this.connections = [];
    this.selectedComponents = new Set();
    this.nextId = 1;
    this.currentScale = 1;
    this.currentTranslate = [0, 0];
    this.lineGenerator = d3.line().curve(d3.curveBasis);

    // Set up double-click handling
    const handleDoubleClick = (event) => {
        // Check if click is on a component or port
        const target = event.target;
        if (target.closest('.component') || target.closest('.port')) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        // Get coordinates relative to SVG
        const [x, y] = d3.pointer(event, this.svg.node());
        console.log('Double click at:', x, y);

        // Create new component
        this.createComponent(x, y, 'function');
            };

            // Remove any existing handlers
            this.svg.on('dblclick', null);
            this.gridLayer.on('dblclick', null);

            // Add the handler to the grid layer
            this.gridLayer.on('dblclick', handleDoubleClick);

            // Set up other behaviors
            this.setupGrid();
            this.setupDragBehavior();
            this.setupContextMenu();
            this.setupKeyboardShortcuts();
            this.setupZoom();
            this.setupSelectionBox();

            // Add debug logging
            this.gridLayer.on('click', () => console.log('Grid clicked'));
            this.svg.on('click', () => console.log('SVG clicked'));
        }

        testCreateComponent() {
            console.log('Testing component creation');
            const component = this.createComponent(100, 100, 'function');
            console.log('Test component created:', component);
        }

        setupZoom() {
            const zoom = d3.zoom()
                .scaleExtent([0.1, 4])
                .on('zoom', (event) => {
                    this.mainGroup.attr('transform', event.transform);
                    this.connectionLayer.attr('transform', event.transform);
                    this.currentScale = event.transform.k;
                    this.currentTranslate = [event.transform.x, event.transform.y];
                    
                    // Update all connections when zooming
                    this.connections.forEach(connection => {
                        this.renderConnection(connection);
                    });
                });
        
            this.svg.call(zoom);
        }
    
        setupDragBehavior() {
            this.drag = d3.drag()
                .on('start', (event) => {
                    this.isDragging = true;
                    const g = d3.select(event.sourceEvent.target.closest('.component'));
                    if (!this.selectedComponents.has(g.attr('id'))) {
                        this.clearSelection();
                        this.selectComponent(g.attr('id'));
                    }
                })
                .on('drag', (event) => {
                    this.selectedComponents.forEach(componentId => {
                        const g = d3.select(`#${componentId}`);
                        const transform = g.attr('transform');
                        let x = 0, y = 0;
                        
                        if (transform) {
                            const parts = transform.match(/translate\(([^,]+),([^)]+)\)/);
                            if (parts) {
                                x = parseFloat(parts[1]);
                                y = parseFloat(parts[2]);
                            }
                        }
                        
                        g.attr('transform', `translate(${x + event.dx},${y + event.dy})`);
                        this.updateConnectionsForComponent(componentId);
                    });
                })
                .on('end', () => {
                    this.isDragging = false;
                    this.saveState();
                });
        }
    
        // Update setupSelectionBox method
        setupSelectionBox() {
            this.svg.on('mousedown', (event) => {
                if (event.target.tagName === 'svg' || event.target.classList.contains('grid-layer')) {
                    this.isSelecting = true;
                    const [x, y] = d3.pointer(event);
                    this.selectionStart = { x, y };
                    
                    this.selectionRect = this.overlayGroup.append('rect')
                        .attr('class', 'selection-box')
                        .attr('x', x)
                        .attr('y', y)
                        .attr('width', 0)
                        .attr('height', 0)
                        .attr('fill', 'rgba(41, 182, 246, 0.1)')
                        .attr('stroke', '#29b6f6')
                        .attr('stroke-width', 1)
                        .attr('stroke-dasharray', '5,5');
                }
            });

            this.svg.on('mouseup', (event) => {
                if (this.isSelecting) {
                    this.isSelecting = false;
                    if (this.selectionRect) {
                        const box = this.selectionRect.node().getBBox();
                        this.selectComponentsInBox(box, event);
                        this.selectionRect.remove();
                        this.selectionRect = null;
                    }
                }
            });
        }
    
        setupContextMenu() {
            this.contextMenu = d3.select('body')
                .append('div')
                .attr('class', 'blueprint-context-menu')
                .style('display', 'none');
    
            document.addEventListener('click', () => {
                this.contextMenu.style('display', 'none');
            });
    
            this.svg.on('contextmenu', (event) => {
                event.preventDefault();
                const [x, y] = d3.pointer(event);
                this.showContextMenu(event, x, y);
            });
        }
    
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (event) => {
                if (event.ctrlKey || event.metaKey) {
                    switch(event.key.toLowerCase()) {
                        case 'c':
                            this.copySelectedComponents();
                            break;
                        case 'v':
                            this.pasteComponents();
                            break;
                        case 'x':
                            this.cutSelectedComponents();
                            break;
                        case 'z':
                            if (event.shiftKey) {
                                this.redo();
                            } else {
                                this.undo();
                            }
                            break;
                        case 'd':
                            event.preventDefault();
                            this.duplicateSelectedComponents();
                            break;
                    }
                }
                if (event.key === 'Delete') {
                    this.deleteSelectedComponents();
                }
            });
        }

        showContextMenu(event, x, y) {
            const target = event.target.closest('.component');
            const menuItems = [];
        
            if (target) {
                const componentId = d3.select(target).attr('id');
                const component = this.components.find(c => c.id === componentId);
                
                menuItems.push(
                    { 
                        label: 'Edit Name', 
                        action: () => {
                            const g = d3.select(`#${componentId}`);
                            this.editComponentName(g, component);
                        }
                    },
                    { label: 'Add Input Port', action: () => this.addPort(componentId, 'inputs') },
                    { label: 'Add Output Port', action: () => this.addPort(componentId, 'outputs') },
                    { label: 'Delete Component', action: () => this.deleteComponent(componentId) },
                    { label: 'Duplicate', action: () => this.duplicateComponent(componentId) }
                );
            } else {
                Object.keys(BlueprintCanvas.COMPONENT_TYPES).forEach(type => {
                    menuItems.push({
                        label: `Create ${type.toLowerCase()}`,
                        action: () => this.createComponent(x, y, type.toLowerCase())
                    });
                });
            }
        
            this.contextMenu
                .style('left', `${event.pageX}px`)
                .style('top', `${event.pageY}px`)
                .style('display', 'block')
                .html('');
        
            menuItems.forEach(item => {
                this.contextMenu.append('div')
                    .attr('class', 'context-menu-item')
                    .text(item.label)
                    .on('click', () => {
                        item.action();
                        this.contextMenu.style('display', 'none');
                    });
            });
        }
    
        setupGrid() {
            const gridSize = 30;
            // Add patterns to defs
            const defs = this.svg.append('defs');
    
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
    
            // Add grid to gridLayer instead of directly to svg
            this.gridLayer.append('rect')
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('fill', 'url(#grid)')
                .style('pointer-events', 'all');  // Make sure grid receives events

            this.gridLayer.append('rect')
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('fill', 'url(#major-grid)')
                .style('pointer-events', 'all');  // Make sure major grid receives events


                // Make sure the grid rectangles receive pointer events
                this.gridLayer.selectAll('rect')
                    .style('pointer-events', 'all');

                // Add a transparent overlay to ensure clicks are captured
                this.gridLayer.append('rect')
                    .attr('width', '100%')
                    .attr('height', '100%')
                    .attr('fill', 'transparent')
                    .style('pointer-events', 'all');
            
                }
    
                createComponent(x, y, type = 'function') {
                    console.log('Creating component at:', x, y, 'of type:', type);
                    
                    try {
                        const typeConfig = BlueprintCanvas.COMPONENT_TYPES[type.toUpperCase()];
                        if (!typeConfig) {
                            console.error('Invalid component type:', type);
                            return null;
                        }
                
                        const component = {
                            id: `component-${this.nextId++}`,
                            x: x,
                            y: y,
                            width: 150,
                            height: 100,
                            name: `New ${type}`,
                            type: type,
                            inputs: [...typeConfig.defaultPorts.inputs],
                            outputs: [...typeConfig.defaultPorts.outputs]
                        };
                
                        console.log('Component object created:', component);
                        
                        this.components.push(component);
                        const renderedComponent = this.renderComponent(component);
                        console.log('Component rendered:', renderedComponent);
                        
                        return renderedComponent;
                    } catch (error) {
                        console.error('Error creating component:', error);
                        return null;
                    }
                }
    
        showComponentTypeSelector(x, y) {
            const menuItems = Object.keys(BlueprintCanvas.COMPONENT_TYPES).map(type => ({
                label: `Create ${type.toLowerCase()}`,
                action: () => this.createComponent(x, y, type.toLowerCase())
            }));
    
            const contextMenu = d3.select('.blueprint-context-menu')
                .style('left', `${x}px`)
                .style('top', `${y}px`)
                .style('display', 'block')
                .html('');
    
            menuItems.forEach(item => {
                contextMenu.append('div')
                    .attr('class', 'context-menu-item')
                    .text(item.label)
                    .on('click', () => {
                        item.action();
                        contextMenu.style('display', 'none');
                    });
            });
        }



        addPort(componentId, portType) {
            const component = this.components.find(c => c.id === componentId);
            if (!component) return;
    
            const newPort = {
                name: `${portType.slice(0, -1)}${component[portType].length + 1}`,
                id: `${portType.slice(0, 2)}${component[portType].length + 1}`,
                type: 'any'
            };
    
            component[portType].push(newPort);
            this.rerenderComponent(component);
            this.saveState();
        }
    
        rerenderComponent(component) {
            const oldGroup = d3.select(`#${component.id}`);
            const transform = oldGroup.attr('transform');
            oldGroup.remove();
            
            const g = this.mainGroup.append('g')
                .attr('class', 'component')
                .attr('id', component.id)
                .attr('transform', transform)
                .style('cursor', 'move');
    
            this.renderComponentContent(g, component);
            g.call(this.drag);
        }
    
        // Fix the selectComponentsInBox method
        selectComponentsInBox(box) {
            // Remove the d3.event check and use regular event handling
            if (!event.shiftKey) {
                this.clearSelection();
            }

            this.mainGroup.selectAll('.component').each((d, i, nodes) => {
                const node = nodes[i];
                const bounds = node.getBBox();
                const transform = d3.select(node).attr('transform');
                let x = 0, y = 0;

                if (transform) {
                    const parts = transform.match(/translate\(([^,]+),([^)]+)\)/);
                    if (parts) {
                        x = parseFloat(parts[1]);
                        y = parseFloat(parts[2]);
                    }
                }

                if (x + bounds.x < box.x + box.width &&
                    x + bounds.x + bounds.width > box.x &&
                    y + bounds.y < box.y + box.height &&
                    y + bounds.y + bounds.height > box.y) {
                    this.selectComponent(node.id, true);
                }
            });
        }
    
        updateSelectionBox(event) {
            if (!this.selectionRect || !this.isSelecting) return;
    
            const [currentX, currentY] = d3.pointer(event);
            const x = Math.min(this.selectionStart.x, currentX);
            const y = Math.min(this.selectionStart.y, currentY);
            const width = Math.abs(currentX - this.selectionStart.x);
            const height = Math.abs(currentY - this.selectionStart.y);
    
            this.selectionRect
                .attr('x', x)
                .attr('y', y)
                .attr('width', width)
                .attr('height', height);
        }
        
        copySelectedComponents() {
            this.clipboard = Array.from(this.selectedComponents).map(id => {
                const component = this.components.find(c => c.id === id);
                return JSON.parse(JSON.stringify(component));
            });
        }
    
        pasteComponents() {
            if (!this.clipboard || !this.clipboard.length) return;
            
            this.clearSelection();
            const offset = 50;
            
            this.clipboard.forEach(component => {
                const newComponent = JSON.parse(JSON.stringify(component));
                newComponent.id = `component-${this.nextId++}`;
                newComponent.x += offset;
                newComponent.y += offset;
                
                this.components.push(newComponent);
                this.renderComponent(newComponent);
                this.selectComponent(newComponent.id, true);
            });
            
            this.saveState();
        }
    
        duplicateSelectedComponents() {
            this.copySelectedComponents();
            this.pasteComponents();
        }
    
        cutSelectedComponents() {
            this.copySelectedComponents();
            this.deleteSelectedComponents();
        }
    
        deleteSelectedComponents() {
            Array.from(this.selectedComponents).forEach(id => {
                this.deleteComponent(id);
            });
            this.selectedComponents.clear();
            this.saveState();
        }
    
        saveState() {
            const state = {
                components: JSON.parse(JSON.stringify(this.components)),
                connections: JSON.parse(JSON.stringify(this.connections))
            };
            
            this.undoStack.push(state);
            this.redoStack = [];
            
            if (this.undoStack.length > 20) {
                this.undoStack.shift();
            }
        }
    
        undo() {
            if (this.undoStack.length === 0) return;
            
            const currentState = {
                components: JSON.parse(JSON.stringify(this.components)),
                connections: JSON.parse(JSON.stringify(this.connections))
            };
            
            this.redoStack.push(currentState);
            const previousState = this.undoStack.pop();
            this.loadState(previousState);
        }
    
        redo() {
            if (this.redoStack.length === 0) return;
            
            const currentState = {
                components: JSON.parse(JSON.stringify(this.components)),
                connections: JSON.parse(JSON.stringify(this.connections))
            };
            
            this.undoStack.push(currentState);
            const nextState = this.redoStack.pop();
            this.loadState(nextState);
        }
    
        loadState(state) {
            this.mainGroup.selectAll('.component').remove();
            this.connectionLayer.selectAll('.connection').remove();
            
            this.components = JSON.parse(JSON.stringify(state.components));
            this.connections = JSON.parse(JSON.stringify(state.connections));
            
            this.components.forEach(component => {
                this.renderComponent(component);
            });
            
            this.connections.forEach(connection => {
                this.renderConnection(connection);
            });
        }
    
        exportToJson() {
            return JSON.stringify({
                components: this.components,
                connections: this.connections
            }, null, 2);
        }
    
        importFromJson(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                this.loadState(data);
                this.saveState();
                return true;
            } catch (e) {
                console.error('Failed to import JSON:', e);
                return false;
            }
        }

        // Add this method to your BlueprintCanvas class
        updateConnectionsForComponent(componentId) {
            // Find all connections related to this component
            const relatedConnections = this.connections.filter(conn => 
                conn.from.startsWith(componentId) || conn.to.startsWith(componentId)
            );

            // Update each connection
            relatedConnections.forEach(connection => {
                const fromElement = d3.select(`#${connection.from}`);
                const toElement = d3.select(`#${connection.to}`);
                
                if (fromElement.empty() || toElement.empty()) {
                    return;
                }

                const fromBounds = fromElement.node().getBoundingClientRect();
                const toBounds = toElement.node().getBoundingClientRect();
                
                const fromX = fromBounds.x + fromBounds.width;
                const fromY = fromBounds.y + fromBounds.height/2;
                const toX = toBounds.x;
                const toY = toBounds.y + toBounds.height/2;

                // Update the connection path
                const connectionPath = d3.select(`#connection-${connection.from}-${connection.to}`);
                if (!connectionPath.empty()) {
                    const points = [
                        [fromX, fromY],
                        [fromX + (toX - fromX)/2, fromY],
                        [fromX + (toX - fromX)/2, toY],
                        [toX, toY]
                    ];
                    
                    connectionPath.attr('d', this.lineGenerator(points));
                }
            });
        }

        // Add these methods to handle connections
        startConnection(portGroup) {
            this.isCreatingConnection = true;
            this.startPort = portGroup;
            
            // Create temporary connection line
            this.tempConnection = this.connectionLayer.append('path')
                .attr('class', 'connection temp-connection')
                .attr('stroke', '#29b6f6')
                .attr('stroke-width', 2)
                .attr('fill', 'none');
        }

        // Update the finishConnection method
        finishConnection(endPort) {
            if (!this.isCreatingConnection || !this.startPort) return;

            try {
                const startPortId = this.startPort.attr('id');
                const endPortId = endPort.attr('id');

                console.log('Connecting ports:', { from: startPortId, to: endPortId });

                if (!startPortId || !endPortId) {
                    console.warn('Invalid port IDs');
                    return;
                }

                if (this.validateConnection(startPortId, endPortId)) {
                    const connection = {
                        from: startPortId,
                        to: endPortId
                    };

                    this.connections.push(connection);
                    this.renderConnection(connection);
                }
            } catch (error) {
                console.error('Error finishing connection:', error);
            } finally {
                if (this.tempConnection) {
                    this.tempConnection.remove();
                    this.tempConnection = null;
                }
                this.isCreatingConnection = false;
                this.startPort = null;
            }
        }

        renderConnection(connection) {
            // First, verify we have valid connection data
            if (!connection || !connection.from || !connection.to) {
                console.warn('Invalid connection data:', connection);
                return;
            }
        
            try {
                // Get the port elements with more detailed logging
                const fromElement = d3.select(`#${connection.from}`);
                const toElement = d3.select(`#${connection.to}`);
                
                if (fromElement.empty() || toElement.empty()) {
                    console.warn('Connection ports not found:', connection);
                    return;
                }
        
                // Log the port IDs and their parent components
                console.log('From port:', connection.from);
                console.log('To port:', connection.to);
        
                // Get parent components using closest() instead of ID splitting
                const fromComponent = d3.select(fromElement.node().closest('.component'));
                const toComponent = d3.select(toElement.node().closest('.component'));
        
                if (fromComponent.empty() || toComponent.empty()) {
                    console.warn('Parent components not found for ports:', {
                        fromPort: connection.from,
                        toPort: connection.to,
                        fromComponent: fromComponent.node(),
                        toComponent: toComponent.node()
                    });
                    return;
                }
        
                // Get port circles
                const fromPort = fromElement.select('circle');
                const toPort = toElement.select('circle');
        
                if (fromPort.empty() || toPort.empty()) {
                    console.warn('Port circles not found');
                    return;
                }
        
                // Get component transforms with logging
                const fromTransform = fromComponent.attr('transform');
                const toTransform = toComponent.attr('transform');
                console.log('Component transforms:', { from: fromTransform, to: toTransform });
        
                const [fromCompX, fromCompY] = this.getTransformValues(fromTransform);
                const [toCompX, toCompY] = this.getTransformValues(toTransform);
        
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
                    [startX + (endX - startX)/2, startY],
                    [startX + (endX - startX)/2, endY],
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
                // Add hover effect
                .on('mouseenter', function() {
                    d3.select(this)
                        .attr('stroke', '#f44336')  // Red color on hover
                        .attr('stroke-width', 3);
                })
                .on('mouseleave', function() {
                    d3.select(this)
                        .attr('stroke', '#29b6f6')  // Original color
                        .attr('stroke-width', 2);
                })
                // Add right-click handler for deletion
                .on('contextmenu', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.deleteConnection(connection);
                });
        
            } catch (error) {
                console.error('Error rendering connection:', error, error.stack);
            }
        }

        // Also update the updateTempConnection method for consistent behavior
        updateTempConnection(event) {
            if (!this.isCreatingConnection || !this.startPort) return;

            const startPortElement = this.startPort.select('circle');
            const startComponent = d3.select(`#${this.startPort.attr('id').split('-')[0]}`);
            
            const [compX, compY] = this.getTransformValues(startComponent.attr('transform'));
            const startX = compX + parseFloat(startPortElement.attr('cx'));
            const startY = compY + parseFloat(startPortElement.attr('cy'));

            const [mouseX, mouseY] = d3.pointer(event, this.mainGroup.node());

            const points = [
                [startX, startY],
                [startX + (mouseX - startX)/2, startY],
                [startX + (mouseX - startX)/2, mouseY],
                [mouseX, mouseY]
            ];
            
            this.tempConnection.attr('d', this.lineGenerator(points));
        }

        // Add this helper method to parse transform attributes
        parseTransform(transform) {
            if (!transform) return { x: 0, y: 0 };
            const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
            if (match) {
                return {
                    x: parseFloat(match[1]),
                    y: parseFloat(match[2])
                };
            }
            return { x: 0, y: 0 };
        }        
        
        deleteConnection(connection) {
            // Remove the connection from the connections array
            this.connections = this.connections.filter(conn => 
                !(conn.from === connection.from && conn.to === connection.to)
            );
        
            // Remove the connection path from the DOM
            const connectionId = `connection-${connection.from}-${connection.to}`;
            d3.select(`#${connectionId}`).remove();
        
            // Optionally add an undo state
            this.saveState();
        }
        
        // Update the updateConnectionsForComponent method
        updateConnectionsForComponent(componentId) {
            const relatedConnections = this.connections.filter(conn => 
                conn.from.startsWith(componentId) || conn.to.startsWith(componentId)
            );

            relatedConnections.forEach(connection => {
                this.renderConnection(connection);
            });
        }
        
        // Add this method to handle connection coordinates in the current transform space
        getTransformedPoint(x, y) {
            const transform = d3.zoomTransform(this.svg.node());
            return [
                (x - transform.x) / transform.k,
                (y - transform.y) / transform.k
            ];
        }
        
        // Add this method to get port coordinates
        getPortCoordinates(portElement) {
            const bounds = portElement.node().getBoundingClientRect();
            const svgBounds = this.svg.node().getBoundingClientRect();
            
            // Get coordinates relative to SVG
            const x = bounds.x - svgBounds.x;
            const y = bounds.y - svgBounds.y;
            
            // Transform coordinates based on current zoom/pan
            return this.getTransformedPoint(x, y);
        }
        
        // Add this helper method to handle connection deletion
        deleteConnectionsForComponent(componentId) {
            // Find all connections related to this component
            const relatedConnections = this.connections.filter(conn => 
                conn.from.startsWith(componentId) || conn.to.startsWith(componentId)
            );
        
            // Delete each connection
            relatedConnections.forEach(connection => {
                this.deleteConnection(connection);
            });
        }

        deleteComponent(componentId) {
            // Delete all connections first
            this.deleteConnectionsForComponent(componentId);
            
            // Remove the component from the components array
            this.components = this.components.filter(c => c.id !== componentId);
            
            // Remove the component from DOM
            d3.select(`#${componentId}`).remove();
            
            // Remove from selection if selected
            this.selectedComponents.delete(componentId);
            
            this.saveState();
        }
        
        duplicateComponent(componentId) {
            const originalComponent = this.components.find(c => c.id === componentId);
            if (!originalComponent) return;
        
            const newComponent = JSON.parse(JSON.stringify(originalComponent));
            newComponent.id = `component-${this.nextId++}`;
            newComponent.x += 50; // Offset the duplicate
            newComponent.y += 50;
            
            this.components.push(newComponent);
            const renderedComponent = this.renderComponent(newComponent);
            this.selectComponent(newComponent.id);
            this.saveState();
            
            return renderedComponent;
        }
        
        editComponentName(g, component) {
            const titleText = g.select('.component-title');
            const originalName = component.name;
            const titleBounds = titleText.node().getBBox();
        
            // Create and position input element
            const foreignObject = g.append('foreignObject')
                .attr('x', component.width / 2 - 75)
                .attr('y', 5)
                .attr('width', 150)
                .attr('height', 25);
        
            const input = foreignObject.append('xhtml:input')
                .attr('type', 'text')
                .attr('value', component.name)
                .style('width', '140px')
                .style('height', '20px')
                .style('font-size', '14px')
                .style('text-align', 'center')
                .style('background-color', 'rgba(0, 0, 0, 0.5)')
                .style('color', '#90caf9')
                .style('border', '1px solid #29b6f6')
                .style('border-radius', '3px')
                .style('padding', '0 4px')
                .style('outline', 'none')
                .style('position', 'absolute');
        
            // Hide original text while editing
            titleText.style('display', 'none');
        
            // Focus and select the input text
            const inputNode = input.node();
            inputNode.focus();
            inputNode.select();
        
            const finishEditing = () => {
                const newName = inputNode.value.trim();
                if (newName) {
                    component.name = newName;
                    titleText.text(newName);
                } else {
                    component.name = originalName;
                    titleText.text(originalName);
                }
                
                titleText.style('display', null);
                foreignObject.remove();
                this.saveState();
            };
        
            // Handle input events
            input
                .on('blur', finishEditing)
                .on('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        finishEditing();
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        component.name = originalName;
                        finishEditing();
                    }
                });
        }
        
        moveComponentToFront(componentId) {
            const component = d3.select(`#${componentId}`).node();
            if (component) {
                component.parentNode.appendChild(component);
            }
        }

        alignComponents(alignment) {
            if (this.selectedComponents.size < 2) return;
        
            const components = Array.from(this.selectedComponents).map(id => ({
                id,
                element: d3.select(`#${id}`),
                bounds: d3.select(`#${id}`).node().getBBox()
            }));
        
            let referenceValue;
            switch (alignment) {
                case 'left':
                    referenceValue = Math.min(...components.map(c => c.bounds.x));
                    components.forEach(c => {
                        const transform = c.element.attr('transform');
                        const [x, y] = this.getTransformValues(transform);
                        c.element.attr('transform', `translate(${referenceValue},${y})`);
                        this.updateConnectionsForComponent(c.id);
                    });
                    break;
        
                case 'right':
                    referenceValue = Math.max(...components.map(c => c.bounds.x + c.bounds.width));
                    components.forEach(c => {
                        const transform = c.element.attr('transform');
                        const [x, y] = this.getTransformValues(transform);
                        const newX = referenceValue - c.bounds.width;
                        c.element.attr('transform', `translate(${newX},${y})`);
                        this.updateConnectionsForComponent(c.id);
                    });
                    break;
        
                case 'top':
                    referenceValue = Math.min(...components.map(c => c.bounds.y));
                    components.forEach(c => {
                        const transform = c.element.attr('transform');
                        const [x, y] = this.getTransformValues(transform);
                        c.element.attr('transform', `translate(${x},${referenceValue})`);
                        this.updateConnectionsForComponent(c.id);
                    });
                    break;
        
                case 'bottom':
                    referenceValue = Math.max(...components.map(c => c.bounds.y + c.bounds.height));
                    components.forEach(c => {
                        const transform = c.element.attr('transform');
                        const [x, y] = this.getTransformValues(transform);
                        const newY = referenceValue - c.bounds.height;
                        c.element.attr('transform', `translate(${x},${newY})`);
                        this.updateConnectionsForComponent(c.id);
                    });
                    break;
        
                case 'center-horizontal':
                    const avgX = components.reduce((sum, c) => sum + (c.bounds.x + c.bounds.width/2), 0) / components.length;
                    components.forEach(c => {
                        const transform = c.element.attr('transform');
                        const [x, y] = this.getTransformValues(transform);
                        const newX = avgX - c.bounds.width/2;
                        c.element.attr('transform', `translate(${newX},${y})`);
                        this.updateConnectionsForComponent(c.id);
                    });
                    break;
        
                case 'center-vertical':
                    const avgY = components.reduce((sum, c) => sum + (c.bounds.y + c.bounds.height/2), 0) / components.length;
                    components.forEach(c => {
                        const transform = c.element.attr('transform');
                        const [x, y] = this.getTransformValues(transform);
                        const newY = avgY - c.bounds.height/2;
                        c.element.attr('transform', `translate(${x},${newY})`);
                        this.updateConnectionsForComponent(c.id);
                    });
                    break;
            }
        
            this.saveState();
        }

        // Helper method to safely get transform values
        getTransformValues(transform) {
            if (!transform) return [0, 0];
            const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
            if (match) {
                return [parseFloat(match[1]) || 0, parseFloat(match[2]) || 0];
            }
            return [0, 0];
        }
        
        distributeComponents(direction) {
            if (this.selectedComponents.size < 3) return;
        
            const components = Array.from(this.selectedComponents).map(id => ({
                id,
                element: d3.select(`#${id}`),
                bounds: d3.select(`#${id}`).node().getBBox()
            }));
        
            // Sort components based on position
            if (direction === 'horizontal') {
                components.sort((a, b) => a.bounds.x - b.bounds.x);
                
                const totalWidth = components[components.length - 1].bounds.x - components[0].bounds.x;
                const spacing = totalWidth / (components.length - 1);
                
                components.forEach((c, i) => {
                    if (i === 0 || i === components.length - 1) return; // Skip first and last
                    
                    const transform = c.element.attr('transform');
                    const [_, y] = this.getTransformValues(transform);
                    const newX = components[0].bounds.x + (spacing * i);
                    
                    c.element.attr('transform', `translate(${newX},${y})`);
                    this.updateConnectionsForComponent(c.id);
                });
            } else if (direction === 'vertical') {
                components.sort((a, b) => a.bounds.y - b.bounds.y);
                
                const totalHeight = components[components.length - 1].bounds.y - components[0].bounds.y;
                const spacing = totalHeight / (components.length - 1);
                
                components.forEach((c, i) => {
                    if (i === 0 || i === components.length - 1) return; // Skip first and last
                    
                    const transform = c.element.attr('transform');
                    const [x, _] = this.getTransformValues(transform);
                    const newY = components[0].bounds.y + (spacing * i);
                    
                    c.element.attr('transform', `translate(${x},${newY})`);
                    this.updateConnectionsForComponent(c.id);
                });
            }
        
            this.saveState();
        }
        
        snapToGrid(value, gridSize = 30) {
            return Math.round(value / gridSize) * gridSize;
        }
        
        snapComponentsToGrid() {
            this.selectedComponents.forEach(componentId => {
                const element = d3.select(`#${componentId}`);
                const [x, y] = this.getTransformValues(element.attr('transform'));
                
                const snappedX = this.snapToGrid(x);
                const snappedY = this.snapToGrid(y);
                
                element.attr('transform', `translate(${snappedX},${snappedY})`);
                this.updateConnectionsForComponent(componentId);
            });
            
            this.saveState();
        }
        
        updateComponentPosition(componentId, x, y) {
            const component = this.components.find(c => c.id === componentId);
            if (!component) return;
        
            component.x = x;
            component.y = y;
        
            d3.select(`#${componentId}`)
                .attr('transform', `translate(${x},${y})`);
            
            this.updateConnectionsForComponent(componentId);
        }

        getComponentCenter(componentId) {
            const element = d3.select(`#${componentId}`);
            if (element.empty()) return null;
        
            const bounds = element.node().getBBox();
            const [x, y] = this.getTransformValues(element.attr('transform'));
            
            return {
                x: x + bounds.width / 2,
                y: y + bounds.height / 2
            };
        }
        
        arrangeInCircle() {
            if (this.selectedComponents.size < 3) return;
        
            const components = Array.from(this.selectedComponents);
            const centerX = components.reduce((sum, id) => {
                const center = this.getComponentCenter(id);
                return sum + (center ? center.x : 0);
            }, 0) / components.length;
        
            const centerY = components.reduce((sum, id) => {
                const center = this.getComponentCenter(id);
                return sum + (center ? center.y : 0);
            }, 0) / components.length;
        
            const radius = Math.max(200, components.length * 30);
            const angleStep = (2 * Math.PI) / components.length;
        
            components.forEach((componentId, index) => {
                const angle = angleStep * index;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
        
                this.updateComponentPosition(componentId, x, y);
            });
        
            this.saveState();
        }
        
        arrangeInGrid() {
            if (this.selectedComponents.size === 0) return;
        
            const components = Array.from(this.selectedComponents);
            const gridSize = Math.ceil(Math.sqrt(components.length));
            const spacing = 200;
        
            const startX = components.reduce((min, id) => {
                const center = this.getComponentCenter(id);
                return Math.min(min, center ? center.x : Infinity);
            }, Infinity);
        
            const startY = components.reduce((min, id) => {
                const center = this.getComponentCenter(id);
                return Math.min(min, center ? center.y : Infinity);
            }, Infinity);
        
            components.forEach((componentId, index) => {
                const row = Math.floor(index / gridSize);
                const col = index % gridSize;
                const x = startX + col * spacing;
                const y = startY + row * spacing;
        
                this.updateComponentPosition(componentId, x, y);
            });
        
            this.saveState();
        }
        
        autoLayout() {
            // Implement force-directed layout
            const simulation = d3.forceSimulation(this.components)
                .force('link', d3.forceLink(this.connections)
                    .id(d => d.id)
                    .distance(200))
                .force('charge', d3.forceManyBody().strength(-1000))
                .force('center', d3.forceCenter(this.width / 2, this.height / 2))
                .force('collision', d3.forceCollide().radius(100));
        
            simulation.on('tick', () => {
                this.components.forEach(component => {
                    this.updateComponentPosition(component.id, component.x, component.y);
                });
            });
        
            simulation.on('end', () => {
                this.saveState();
            });
        }        

        centerSelection() {
            if (this.selectedComponents.size === 0) return;
        
            const bounds = this.getSelectionBounds();
            if (!bounds) return;
        
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            const offsetX = centerX - (bounds.x + bounds.width / 2);
            const offsetY = centerY - (bounds.y + bounds.height / 2);
        
            this.selectedComponents.forEach(componentId => {
                const element = d3.select(`#${componentId}`);
                const [x, y] = this.getTransformValues(element.attr('transform'));
                this.updateComponentPosition(componentId, x + offsetX, y + offsetY);
            });
        
            this.saveState();
        }
        
        getSelectionBounds() {
            if (this.selectedComponents.size === 0) return null;
        
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
        
            this.selectedComponents.forEach(componentId => {
                const element = d3.select(`#${componentId}`);
                const bounds = element.node().getBBox();
                const [x, y] = this.getTransformValues(element.attr('transform'));
        
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + bounds.width);
                maxY = Math.max(maxY, y + bounds.height);
            });
        
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        }
        
        selectAll() {
            this.clearSelection();
            this.mainGroup.selectAll('.component').each((d, i, nodes) => {
                this.selectComponent(d3.select(nodes[i]).attr('id'), true);
            });
        }
        
        invertSelection() {
            const currentSelection = new Set(this.selectedComponents);
            this.selectAll();
            currentSelection.forEach(componentId => {
                this.selectedComponents.delete(componentId);
                d3.select(`#${componentId}`)
                    .select('rect')
                    .attr('stroke-width', 2);
            });
        }
        
        selectConnected() {
            const connectedComponents = new Set();
            
            this.selectedComponents.forEach(componentId => {
                this.connections.forEach(connection => {
                    if (connection.from.startsWith(componentId)) {
                        connectedComponents.add(connection.to.split('-')[0]);
                    }
                    if (connection.to.startsWith(componentId)) {
                        connectedComponents.add(connection.from.split('-')[0]);
                    }
                });
            });
        
            connectedComponents.forEach(componentId => {
                this.selectComponent(componentId, true);
            });
        }
        
        groupComponents() {
            if (this.selectedComponents.size < 2) return;
        
            const bounds = this.getSelectionBounds();
            if (!bounds) return;
        
            const groupComponent = {
                id: `component-${this.nextId++}`,
                x: bounds.x,
                y: bounds.y,
                width: bounds.width + 40,
                height: bounds.height + 40,
                name: 'Group',
                type: 'group',
                children: Array.from(this.selectedComponents)
            };
        
            this.components.push(groupComponent);
            this.renderGroup(groupComponent);
            this.saveState();
        }

        renderGroup(groupComponent) {
            const g = this.mainGroup.append('g')
                .attr('class', 'component group')
                .attr('id', groupComponent.id)
                .attr('transform', `translate(${groupComponent.x},${groupComponent.y})`);
        
            // Group background
            g.append('rect')
                .attr('width', groupComponent.width)
                .attr('height', groupComponent.height)
                .attr('rx', 8)
                .attr('ry', 8)
                .attr('fill', 'rgba(38, 50, 56, 0.6)')
                .attr('stroke', '#546e7a')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5');
        
            // Group header
            g.append('rect')
                .attr('class', 'group-header')
                .attr('width', groupComponent.width)
                .attr('height', 30)
                .attr('rx', 8)
                .attr('ry', 8)
                .attr('fill', 'rgba(55, 71, 79, 0.8)')
                .attr('stroke', '#546e7a')
                .attr('stroke-width', 2);
        
            // Group title
            const titleText = g.append('text')
                .attr('class', 'group-title')
                .attr('x', groupComponent.width / 2)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .attr('fill', '#90a4ae')
                .attr('font-size', '14px')
                .text(groupComponent.name);
        
            // Make group title editable
            titleText.on('dblclick', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.editGroupName(g, groupComponent);
            });
        
            // Add collapse/expand button
            const expandButton = g.append('g')
                .attr('class', 'expand-button')
                .attr('transform', `translate(${groupComponent.width - 25}, 5)`);
        
            expandButton.append('circle')
                .attr('r', 8)
                .attr('fill', '#546e7a')
                .attr('cursor', 'pointer');
        
            expandButton.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.3em')
                .attr('fill', '#cfd8dc')
                .attr('font-size', '12px')
                .text('-')
                .attr('cursor', 'pointer');
        
            // Handle group collapse/expand
            let isCollapsed = false;
            expandButton.on('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                isCollapsed = !isCollapsed;
                this.toggleGroupCollapse(groupComponent, isCollapsed);
                expandButton.select('text').text(isCollapsed ? '+' : '-');
            });
        
            // Apply drag behavior
            g.call(this.drag);
        
            return g;
        }
        
        editGroupName(g, groupComponent) {
            const titleText = g.select('.group-title');
            const originalName = groupComponent.name;
            
            const foreignObject = g.append('foreignObject')
                .attr('x', groupComponent.width / 2 - 75)
                .attr('y', 5)
                .attr('width', 150)
                .attr('height', 25);
        
            const input = foreignObject.append('xhtml:input')
                .attr('type', 'text')
                .attr('value', groupComponent.name)
                .style('width', '140px')
                .style('height', '20px')
                .style('font-size', '14px')
                .style('text-align', 'center')
                .style('background-color', 'rgba(38, 50, 56, 0.8)')
                .style('color', '#90a4ae')
                .style('border', '1px solid #546e7a')
                .style('border-radius', '4px')
                .style('padding', '0 4px');
        
            titleText.style('display', 'none');
            input.node().focus();
            input.node().select();
        
            const finishEditing = () => {
                const newName = input.node().value.trim();
                groupComponent.name = newName || originalName;
                titleText.text(groupComponent.name).style('display', null);
                foreignObject.remove();
                this.saveState();
            };
        
            input.on('blur', finishEditing);
            input.on('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    finishEditing();
                } else if (event.key === 'Escape') {
                    groupComponent.name = originalName;
                    finishEditing();
                }
            });
        }
        
        toggleGroupCollapse(groupComponent, isCollapsed) {
            const groupElement = d3.select(`#${groupComponent.id}`);
            const childComponents = groupComponent.children.map(id => d3.select(`#${id}`));
            
            if (isCollapsed) {
                // Store original positions before collapsing
                groupComponent.childrenPositions = groupComponent.children.map(id => {
                    const element = d3.select(`#${id}`);
                    return {
                        id,
                        transform: element.attr('transform')
                    };
                });
        
                // Hide child components
                childComponents.forEach(child => {
                    child.style('display', 'none');
                });
        
                // Shrink group
                groupElement.select('rect')
                    .transition()
                    .duration(300)
                    .attr('height', 40);
            } else {
                // Restore child components
                groupComponent.childrenPositions.forEach(pos => {
                    const element = d3.select(`#${pos.id}`);
                    element.attr('transform', pos.transform)
                        .style('display', null);
                });
        
                // Expand group
                groupElement.select('rect')
                    .transition()
                    .duration(300)
                    .attr('height', groupComponent.height);
            }
        
            // Update connections
            this.updateConnectionsForGroup(groupComponent);
            this.saveState();
        }
        
        updateConnectionsForGroup(groupComponent) {
            groupComponent.children.forEach(childId => {
                this.updateConnectionsForComponent(childId);
            });
        }

        ungroup() {
            const selectedGroups = Array.from(this.selectedComponents)
                .filter(id => {
                    const component = this.components.find(c => c.id === id);
                    return component && component.type === 'group';
                });
        
            selectedGroups.forEach(groupId => {
                const group = this.components.find(c => c.id === groupId);
                if (!group) return;
        
                // Remove group from components
                this.components = this.components.filter(c => c.id !== groupId);
        
                // Get group transform
                const groupElement = d3.select(`#${groupId}`);
                const [groupX, groupY] = this.getTransformValues(groupElement.attr('transform'));
        
                // Update positions of child components
                group.children.forEach(childId => {
                    const childElement = d3.select(`#${childId}`);
                    const [childX, childY] = this.getTransformValues(childElement.attr('transform'));
        
                    // Adjust child position relative to canvas instead of group
                    this.updateComponentPosition(childId, groupX + childX, groupY + childY);
                    
                    // Make child visible if it was in a collapsed group
                    childElement.style('display', null);
                });
        
                // Remove group element
                groupElement.remove();
                
                // Update selection to include former children
                this.selectedComponents.delete(groupId);
                group.children.forEach(childId => {
                    this.selectComponent(childId, true);
                });
            });
        
            this.saveState();
        }
        
        isComponentInGroup(componentId) {
            return this.components.some(c => 
                c.type === 'group' && c.children && c.children.includes(componentId)
            );
        }
        
        getParentGroup(componentId) {
            return this.components.find(c => 
                c.type === 'group' && c.children && c.children.includes(componentId)
            );
        }
        
        moveToGroup(componentIds, targetGroupId) {
            const targetGroup = this.components.find(c => c.id === targetGroupId);
            if (!targetGroup || targetGroup.type !== 'group') return;
        
            componentIds.forEach(componentId => {
                // Remove from current group if any
                const currentGroup = this.getParentGroup(componentId);
                if (currentGroup) {
                    currentGroup.children = currentGroup.children.filter(id => id !== componentId);
                }
        
                // Add to target group
                if (!targetGroup.children.includes(componentId)) {
                    targetGroup.children.push(componentId);
                }
        
                // Update component position relative to new group
                const component = d3.select(`#${componentId}`);
                const targetGroupElement = d3.select(`#${targetGroupId}`);
                const [groupX, groupY] = this.getTransformValues(targetGroupElement.attr('transform'));
                const [componentX, componentY] = this.getTransformValues(component.attr('transform'));
        
                this.updateComponentPosition(componentId, componentX - groupX, componentY - groupY);
            });
        
            this.updateGroupBounds(targetGroup);
            this.saveState();
        }
        
        updateGroupBounds(group) {
            const groupElement = d3.select(`#${group.id}`);
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
        
            // Calculate bounds based on children
            group.children.forEach(childId => {
                const childElement = d3.select(`#${childId}`);
                const bounds = childElement.node().getBBox();
                const [x, y] = this.getTransformValues(childElement.attr('transform'));
        
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + bounds.width);
                maxY = Math.max(maxY, y + bounds.height);
            });
        
            // Add padding
            const padding = 20;
            const newWidth = maxX - minX + (padding * 2);
            const newHeight = maxY - minY + (padding * 2);
        
            // Update group rectangle
            groupElement.select('rect')
                .attr('width', newWidth)
                .attr('height', newHeight);
        
            // Update group header
            groupElement.select('.group-header')
                .attr('width', newWidth);
        
            // Update group title position
            groupElement.select('.group-title')
                .attr('x', newWidth / 2);
        
            // Update expand button position
            groupElement.select('.expand-button')
                .attr('transform', `translate(${newWidth - 25}, 5)`);
        
            // Update group component properties
            group.width = newWidth;
            group.height = newHeight;
        
            // Update connections
            this.updateConnectionsForGroup(group);
        }
        
        resizeGroup(groupId, deltaX, deltaY) {
            const group = this.components.find(c => c.id === groupId);
            if (!group || group.type !== 'group') return;
        
            const groupElement = d3.select(`#${groupId}`);
            const newWidth = group.width + deltaX;
            const newHeight = group.height + deltaY;
        
            // Minimum size constraints
            const minSize = 100;
            if (newWidth < minSize || newHeight < minSize) return;
        
            // Update group size
            groupElement.select('rect')
                .attr('width', newWidth)
                .attr('height', newHeight);
        
            // Update group header
            groupElement.select('.group-header')
                .attr('width', newWidth);
        
            // Update group title position
            groupElement.select('.group-title')
                .attr('x', newWidth / 2);
        
            // Update expand button position
            groupElement.select('.expand-button')
                .attr('transform', `translate(${newWidth - 25}, 5)`);
        
            // Update group component properties
            group.width = newWidth;
            group.height = newHeight;
        
            // Scale children positions if needed
            if (group.children && group.children.length > 0) {
                const scaleX = newWidth / (group.width - deltaX);
                const scaleY = newHeight / (group.height - deltaY);
        
                group.children.forEach(childId => {
                    const childElement = d3.select(`#${childId}`);
                    const [x, y] = this.getTransformValues(childElement.attr('transform'));
                    
                    const newX = x * scaleX;
                    const newY = y * scaleY;
                    
                    this.updateComponentPosition(childId, newX, newY);
                });
            }
        
            // Update connections
            this.updateConnectionsForGroup(group);
            this.saveState();
        }
        
        setupGroupResizeHandles(groupElement, group) {
            const handles = [
                { class: 'nw', cursor: 'nw-resize', x: 0, y: 0 },
                { class: 'n', cursor: 'n-resize', x: '50%', y: 0 },
                { class: 'ne', cursor: 'ne-resize', x: '100%', y: 0 },
                { class: 'w', cursor: 'w-resize', x: 0, y: '50%' },
                { class: 'e', cursor: 'e-resize', x: '100%', y: '50%' },
                { class: 'sw', cursor: 'sw-resize', x: 0, y: '100%' },
                { class: 's', cursor: 's-resize', x: '50%', y: '100%' },
                { class: 'se', cursor: 'se-resize', x: '100%', y: '100%' }
            ];
        
            const handleSize = 8;
            const handleGroup = groupElement.append('g')
                .attr('class', 'resize-handles')
                .style('display', 'none');
        
            handles.forEach(handle => {
                const handleElement = handleGroup.append('rect')
                    .attr('class', `resize-handle ${handle.class}`)
                    .attr('width', handleSize)
                    .attr('height', handleSize)
                    .attr('x', handle.x === '50%' ? `calc(${handle.x} - ${handleSize/2}px)` : handle.x)
                    .attr('y', handle.y === '50%' ? `calc(${handle.y} - ${handleSize/2}px)` : handle.y)
                    .attr('fill', '#29b6f6')
                    .attr('stroke', '#0288d1')
                    .style('cursor', handle.cursor)
                    .style('display', 'none');
        
                // Setup drag behavior for resize handles
                const handleDrag = d3.drag()
                    .on('start', (event) => {
                        event.stopPropagation();
                        this.isResizing = true;
                        this.resizeStartPos = { x: event.x, y: event.y };
                        this.resizeStartDims = { width: group.width, height: group.height };
                    })
                    .on('drag', (event) => {
                        event.stopPropagation();
                        if (!this.isResizing) return;
        
                        let deltaX = 0;
                        let deltaY = 0;
        
                        // Calculate deltas based on handle position
                        switch (handle.class) {
                            case 'e':
                                deltaX = event.x - this.resizeStartPos.x;
                                break;
                            case 'se':
                                deltaX = event.x - this.resizeStartPos.x;
                                deltaY = event.y - this.resizeStartPos.y;
                                break;
                            case 's':
                                deltaY = event.y - this.resizeStartPos.y;
                                break;
                            case 'sw':
                                deltaX = -(event.x - this.resizeStartPos.x);
                                deltaY = event.y - this.resizeStartPos.y;
                                break;
                            case 'w':
                                deltaX = -(event.x - this.resizeStartPos.x);
                                break;
                            case 'nw':
                                deltaX = -(event.x - this.resizeStartPos.x);
                                deltaY = -(event.y - this.resizeStartPos.y);
                                break;       
                            case 'n':
                                deltaY = -(event.y - this.resizeStartPos.y);
                                break;
                            case 'ne':
                                deltaX = event.x - this.resizeStartPos.x;
                                deltaY = -(event.y - this.resizeStartPos.y);
                                break;
                        }
            
                            // Apply resize with minimum size constraint
                            const minSize = 100;
                            const newWidth = Math.max(this.resizeStartDims.width + deltaX, minSize);
                            const newHeight = Math.max(this.resizeStartDims.height + deltaY, minSize);
            
                            // Update group size
                            this.resizeGroup(group.id, newWidth - group.width, newHeight - group.height);
            
                            // Update handle positions
                            this.updateResizeHandlePositions(handleGroup, newWidth, newHeight, handleSize);
                        })
                        .on('end', (event) => {
                            event.stopPropagation();
                            this.isResizing = false;
                            this.resizeStartPos = null;
                            this.resizeStartDims = null;
                            this.saveState();
                        });
            
                    handleElement.call(handleDrag);
                });
            
                // Show/hide handles on hover
                groupElement
                    .on('mouseenter', () => {
                        if (!this.isDragging && !this.isResizing) {
                            handleGroup.style('display', null);
                            handleGroup.selectAll('.resize-handle').style('display', null);
                        }
                    })
                    .on('mouseleave', () => {
                        if (!this.isResizing) {
                            handleGroup.style('display', 'none');
                            handleGroup.selectAll('.resize-handle').style('display', 'none');
                        }
                    });
            
                return handleGroup;
            }
            
            updateResizeHandlePositions(handleGroup, width, height, handleSize) {
                handleGroup.select('.e').attr('x', width - handleSize);
                handleGroup.select('.se').attr('x', width - handleSize).attr('y', height - handleSize);
                handleGroup.select('.s').attr('y', height - handleSize);
                handleGroup.select('.sw').attr('y', height - handleSize);
                handleGroup.select('.n').attr('x', (width - handleSize) / 2);
                handleGroup.select('.s').attr('x', (width - handleSize) / 2);
                handleGroup.select('.ne').attr('x', width - handleSize);
                handleGroup.select('.nw');  // Position stays at 0,0
            }
            
            showGroupContextMenu(event, groupId) {
                event.preventDefault();
                event.stopPropagation();
            
                const menuItems = [
                    {
                        label: 'Ungroup',
                        action: () => this.ungroup()
                    },
                    {
                        label: 'Add Component to Group',
                        action: () => this.showAddToGroupDialog(groupId)
                    },
                    {
                        label: 'Remove Selected from Group',
                        action: () => this.removeSelectedFromGroup(groupId)
                    },
                    {
                        label: 'Delete Group',
                        action: () => this.deleteComponent(groupId)
                    }
                ];
            
                this.showContextMenu(event, menuItems);
            }

            showAddToGroupDialog(groupId) {
                // Create a dialog showing available components to add to the group
                const dialog = d3.select('body').append('div')
                    .attr('class', 'blueprint-dialog')
                    .style('position', 'fixed')
                    .style('top', '50%')
                    .style('left', '50%')
                    .style('transform', 'translate(-50%, -50%)')
                    .style('background', '#263238')
                    .style('padding', '20px')
                    .style('border-radius', '8px')
                    .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.3)')
                    .style('z-index', '1000');
            
                // Add dialog header
                dialog.append('h3')
                    .text('Add Components to Group')
                    .style('color', '#90a4ae')
                    .style('margin', '0 0 15px 0');
            
                // Create component list
                const listContainer = dialog.append('div')
                    .style('max-height', '300px')
                    .style('overflow-y', 'auto')
                    .style('margin-bottom', '15px');
            
                const componentList = listContainer.append('div')
                    .attr('class', 'component-list');
            
                // Get available components (those not already in a group)
                const availableComponents = this.components.filter(c => 
                    c.id !== groupId && 
                    c.type !== 'group' && 
                    !this.isComponentInGroup(c.id)
                );
            
                // Add checkboxes for each available component
                availableComponents.forEach(component => {
                    const item = componentList.append('div')
                        .style('margin', '5px 0')
                        .style('color', '#cfd8dc');
            
                    const checkbox = item.append('input')
                        .attr('type', 'checkbox')
                        .attr('id', `add-to-group-${component.id}`)
                        .style('margin-right', '8px');
            
                    item.append('label')
                        .attr('for', `add-to-group-${component.id}`)
                        .text(component.name || component.id);
                });
            
                // Add buttons
                const buttonContainer = dialog.append('div')
                    .style('display', 'flex')
                    .style('justify-content', 'flex-end')
                    .style('gap', '10px');
            
                // Cancel button
                buttonContainer.append('button')
                    .attr('class', 'blueprint-button')
                    .text('Cancel')
                    .style('padding', '5px 15px')
                    .style('background', '#37474f')
                    .style('color', '#90a4ae')
                    .style('border', 'none')
                    .style('border-radius', '4px')
                    .style('cursor', 'pointer')
                    .on('click', () => {
                        dialog.remove();
                    });
            
                // Add button
                buttonContainer.append('button')
                    .attr('class', 'blueprint-button')
                    .text('Add Selected')
                    .style('padding', '5px 15px')
                    .style('background', '#0288d1')
                    .style('color', '#fff')
                    .style('border', 'none')
                    .style('border-radius', '4px')
                    .style('cursor', 'pointer')
                    .on('click', () => {
                        const selectedComponents = availableComponents.filter(c => 
                            d3.select(`#add-to-group-${c.id}`).property('checked')
                        ).map(c => c.id);
            
                        if (selectedComponents.length > 0) {
                            this.moveToGroup(selectedComponents, groupId);
                        }
                        
                        dialog.remove();
                    });

                    d3.select('body').on('keydown.dialog', (event) => {
                        if (event.key === 'Escape') {
                            dialog.remove();
                            d3.select('body').on('keydown.dialog', null); // Remove event listener
                        }
                    });
                
                    // Make dialog draggable
                    const dialogDrag = d3.drag()
                        .on('start', function(event) {
                            const dialogNode = dialog.node();
                            const rect = dialogNode.getBoundingClientRect();
                            const offsetX = event.x - rect.left;
                            const offsetY = event.y - rect.top;
                            
                            d3.select(this)
                                .attr('data-x', offsetX)
                                .attr('data-y', offsetY);
                        })
                        .on('drag', function(event) {
                            const offsetX = parseFloat(d3.select(this).attr('data-x'));
                            const offsetY = parseFloat(d3.select(this).attr('data-y'));
                            
                            dialog
                                .style('left', `${event.x - offsetX}px`)
                                .style('top', `${event.y - offsetY}px`)
                                .style('transform', 'none');
                        });
                
                    dialog.call(dialogDrag);
                }
                
                removeSelectedFromGroup(groupId) {
                    const group = this.components.find(c => c.id === groupId);
                    if (!group || group.type !== 'group') return;
                
                    const selectedComponents = Array.from(this.selectedComponents);
                    const componentsToRemove = selectedComponents.filter(id => 
                        group.children.includes(id)
                    );
                
                    if (componentsToRemove.length === 0) return;
                
                    // Get group's position
                    const groupElement = d3.select(`#${groupId}`);
                    const [groupX, groupY] = this.getTransformValues(groupElement.attr('transform'));
                
                    // Remove components from group and update their positions
                    componentsToRemove.forEach(componentId => {
                        const componentElement = d3.select(`#${componentId}`);
                        const [relativeX, relativeY] = this.getTransformValues(componentElement.attr('transform'));
                
                        // Update component position to be relative to canvas instead of group
                        this.updateComponentPosition(componentId, groupX + relativeX, groupY + relativeY);
                
                        // Remove from group's children array
                        group.children = group.children.filter(id => id !== componentId);
                    });
                
                    // Update group bounds
                    this.updateGroupBounds(group);
                    this.saveState();
                }
                
                showConfirmDialog(message, onConfirm) {
                    const dialog = d3.select('body').append('div')
                        .attr('class', 'blueprint-dialog confirmation-dialog')
                        .style('position', 'fixed')
                        .style('top', '50%')
                        .style('left', '50%')
                        .style('transform', 'translate(-50%, -50%)')
                        .style('background', '#263238')
                        .style('padding', '20px')
                        .style('border-radius', '8px')
                        .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.3)')
                        .style('z-index', '1000');
                
                    // Add message
                    dialog.append('p')
                        .text(message)
                        .style('color', '#cfd8dc')
                        .style('margin', '0 0 15px 0');
                
                    // Add buttons
                    const buttonContainer = dialog.append('div')
                        .style('display', 'flex')
                        .style('justify-content', 'flex-end')
                        .style('gap', '10px');
                
     // Cancel button
     buttonContainer.append('button')
     .attr('class', 'blueprint-button')
     .text('Cancel')
     .style('padding', '5px 15px')
     .style('background', '#37474f')
     .style('color', '#90a4ae')
     .style('border', 'none')
     .style('border-radius', '4px')
     .style('cursor', 'pointer')
     .on('click', () => {
         dialog.remove();
         d3.select('body').on('keydown.confirm', null);
     });

 // Confirm button
 buttonContainer.append('button')
     .attr('class', 'blueprint-button')
     .text('Confirm')
     .style('padding', '5px 15px')
     .style('background', '#0288d1')
     .style('color', '#fff')
     .style('border', 'none')
     .style('border-radius', '4px')
     .style('cursor', 'pointer')
     .on('click', () => {
         dialog.remove();
         d3.select('body').on('keydown.confirm', null);
         if (typeof onConfirm === 'function') {
             onConfirm();
         }
     });

 // Add keyboard handlers
 d3.select('body').on('keydown.confirm', (event) => {
     if (event.key === 'Escape') {
         dialog.remove();
         d3.select('body').on('keydown.confirm', null);
     } else if (event.key === 'Enter') {
         dialog.remove();
         d3.select('body').on('keydown.confirm', null);
         if (typeof onConfirm === 'function') {
             onConfirm();
         }
     }
 });
}

showInputDialog(title, defaultValue, onConfirm) {
 const dialog = d3.select('body').append('div')
     .attr('class', 'blueprint-dialog input-dialog')
     .style('position', 'fixed')
     .style('top', '50%')
     .style('left', '50%')
     .style('transform', 'translate(-50%, -50%)')
     .style('background', '#263238')
     .style('padding', '20px')
     .style('border-radius', '8px')
     .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.3)')
     .style('z-index', '1000');

 // Add title
 dialog.append('h3')
     .text(title)
     .style('color', '#90a4ae')
     .style('margin', '0 0 15px 0');

 // Add input field
 const input = dialog.append('input')
     .attr('type', 'text')
     .attr('value', defaultValue || '')
     .style('width', '100%')
     .style('padding', '5px')
     .style('margin-bottom', '15px')
     .style('background', '#37474f')
     .style('color', '#cfd8dc')
     .style('border', '1px solid #546e7a')
     .style('border-radius', '4px');

 // Add buttons
 const buttonContainer = dialog.append('div')
     .style('display', 'flex')
     .style('justify-content', 'flex-end')
     .style('gap', '10px');
     
    // Cancel button
    buttonContainer.append('button')
        .attr('class', 'blueprint-button')
        .text('Cancel')
        .style('padding', '5px 15px')
        .style('background', '#37474f')
        .style('color', '#90a4ae')
        .style('border', 'none')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .on('click', () => {
            dialog.remove();
            d3.select('body').on('keydown.input', null);
        });

    // OK button
    buttonContainer.append('button')
        .attr('class', 'blueprint-button')
        .text('OK')
        .style('padding', '5px 15px')
        .style('background', '#0288d1')
        .style('color', '#fff')
        .style('border', 'none')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .on('click', () => {
            const value = input.node().value.trim();
            dialog.remove();
            d3.select('body').on('keydown.input', null);
            if (typeof onConfirm === 'function') {
                onConfirm(value);
            }
        });

    // Focus input field
    input.node().focus();
    input.node().select();

    // Add keyboard handlers
    d3.select('body').on('keydown.input', (event) => {
        if (event.key === 'Escape') {
            dialog.remove();
            d3.select('body').on('keydown.input', null);
        } else if (event.key === 'Enter') {
            const value = input.node().value.trim();
            dialog.remove();
            d3.select('body').on('keydown.input', null);
            if (typeof onConfirm === 'function') {
                onConfirm(value);
            }
        }
    });

    // Make dialog draggable
    const dialogDrag = d3.drag()
        .on('start', function(event) {
            const dialogNode = dialog.node();
            const rect = dialogNode.getBoundingClientRect();
            const offsetX = event.x - rect.left;
            const offsetY = event.y - rect.top;
            
            d3.select(this)
                .attr('data-x', offsetX)
                .attr('data-y', offsetY);
        })
        .on('drag', function(event) {
            const offsetX = parseFloat(d3.select(this).attr('data-x'));
            const offsetY = parseFloat(d3.select(this).attr('data-y'));
            
            dialog
                .style('left', `${event.x - offsetX}px`)
                .style('top', `${event.y - offsetY}px`)
                .style('transform', 'none');
        });

    dialog.call(dialogDrag);
}

showToast(message, type = 'info', duration = 3000) {
    const toast = d3.select('body').append('div')
        .attr('class', `blueprint-toast ${type}`)
        .style('position', 'fixed')
        .style('bottom', '20px')
        .style('right', '20px')
        .style('padding', '10px 20px')
        .style('background', type === 'error' ? '#c62828' : '#0288d1')
        .style('color', '#fff')
        .style('border-radius', '4px')
        .style('box-shadow', '0 2px 4px rgba(0, 0, 0, 0.2)')
        .style('opacity', '0')
        .style('transform', 'translateY(20px)')
        .style('transition', 'all 0.3s ease')
    // Animate in
    setTimeout(() => {
        toast
            .style('opacity', '1')
            .style('transform', 'translateY(0)');
    }, 10);

    // Animate out and remove
    setTimeout(() => {
        toast
            .style('opacity', '0')
            .style('transform', 'translateY(20px)');
        
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

addKeyboardShortcuts() {
    d3.select('body').on('keydown.shortcuts', (event) => {
        // Ignore if we're in an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        // Group operations
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 'g':
                    event.preventDefault();
                    if (this.selectedComponents.size >= 2) {
                        this.groupComponents();
                    }
                    break;
                case 'u':
                    event.preventDefault();
                    this.ungroup();
                    break;
                case 'a':
                    event.preventDefault();
                    this.selectAll();
                    break;
                case 'i':
                    event.preventDefault();
                    this.invertSelection();
                    break;
            }
        } else {
            // Single key shortcuts
            switch (event.key) {
                case 'Delete':
                case 'Backspace':
                    if (this.selectedComponents.size > 0) {
                        event.preventDefault();
                        this.showConfirmDialog(
                            'Are you sure you want to delete the selected components?',
                            () => this.deleteSelectedComponents()
                        );
                    }
                    break;
                case 'Escape':
                    this.clearSelection();
                    break;
            }
        }
    });
}

setupContextMenuItems() {
    return {
        component: [
            {
                label: 'Edit Name',
                action: (componentId) => {
                    const component = this.components.find(c => c.id === componentId);
                    if (component) {
                        this.showInputDialog(
                            'Edit Component Name',
                            component.name,
                            (newName) => {
                                component.name = newName;
                                this.rerenderComponent(component);
                            }
                        );
                    }
                }
            },
            {
                label: 'Delete',
                action: (componentId) => {
                    this.showConfirmDialog(
                        'Are you sure you want to delete this component?',
                        () => this.deleteComponent(componentId)
                    );
                }
            },
            {
                label: 'Duplicate',
                action: (componentId) => this.duplicateComponent(componentId)
            },
            {
                label: 'Add to Group',
                action: (componentId) => {
                    const groups = this.components.filter(c => c.type === 'group');
                    if (groups.length === 0) {
                        this.showToast('No groups available', 'error');
                        return;
                    }
                    this.showGroupSelectionDialog(componentId);
                }
            }
        ],
        canvas: [
            {
                label: 'Paste',
                action: () => this.pasteComponents(),
                enabled: () => this.clipboard && this.clipboard.length > 0
            },
            {
                label: 'Select All',
                action: () => this.selectAll()
            },
            {
                label: 'Create Component',
                submenu: Object.keys(BlueprintCanvas.COMPONENT_TYPES).map(type => ({
                    label: `New ${type.toLowerCase()}`,
                    action: (x, y) => this.createComponent(x, y, type.toLowerCase())
                }))
            },
            {
                label: 'Arrange',
                submenu: [
                    {
                        label: 'Auto Layout',
                        action: () => this.autoLayout()
                    },
                    {
                        label: 'Arrange in Circle',
                        action: () => this.arrangeInCircle()
                    },
                    {
                        label: 'Arrange in Grid',
                        action: () => this.arrangeInGrid()
                    }
                ]
            },
            {
                label: 'Align',
                submenu: [
                    {
                        label: 'Left',
                        action: () => this.alignComponents('left')
                    },
                    {
                        label: 'Right',
                        action: () => this.alignComponents('right')
                    },
                    {
                        label: 'Top',
                        action: () => this.alignComponents('top')
                    },
                    {
                        label: 'Bottom',
                        action: () => this.alignComponents('bottom')
                    },
                    {
                        label: 'Center Horizontal',
                        action: () => this.alignComponents('center-horizontal')
                    },
                    {
                        label: 'Center Vertical',
                        action: () => this.alignComponents('center-vertical')
                    }
                ]
            },
            {
                label: 'Distribute',
                submenu: [
                    {
                        label: 'Horizontally',
                        action: () => this.distributeComponents('horizontal')
                    },
                    {
                        label: 'Vertically',
                        action: () => this.distributeComponents('vertical')
                    }
                ]
            }
        ],
        connection: [
            {
                label: 'Delete Connection',
                action: (connection) => this.deleteConnection(connection)
            },
            {
                label: 'Edit Connection Type',
                action: (connection) => {
                    this.showInputDialog(
                        'Edit Connection Type',
                        connection.type || 'default',
                        (newType) => {
                            connection.type = newType;
                            this.renderConnection(connection);
                        }
                    );
                }
            }
        ]
    };
}            
           
showGroupSelectionDialog(componentId) {
    const groups = this.components.filter(c => c.type === 'group');
    
    const dialog = d3.select('body').append('div')
        .attr('class', 'blueprint-dialog group-selection-dialog')
        .style('position', 'fixed')
        .style('top', '50%')
        .style('left', '50%')
        .style('transform', 'translate(-50%, -50%)')
        .style('background', '#263238')
        .style('padding', '20px')
        .style('border-radius', '8px')
        .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.3)')
        .style('z-index', '1000');

    // Add title
    dialog.append('h3')
        .text('Select Group')
        .style('color', '#90a4ae')
        .style('margin', '0 0 15px 0');

    // Add group list
    const listContainer = dialog.append('div')
        .style('max-height', '300px')
        .style('overflow-y', 'auto')
        .style('margin-bottom', '15px');

        groups.forEach(group => {
            listContainer.append('div')
                .attr('class', 'group-selection-item')
                .style('padding', '8px 12px')
                .style('margin', '4px 0')
                .style('background', '#37474f')
                .style('border-radius', '4px')
                .style('cursor', 'pointer')
                .style('color', '#cfd8dc')
                .style('transition', 'background-color 0.2s')
                .text(group.name || `Group ${group.id}`)
                .on('mouseenter', function() {
                    d3.select(this).style('background', '#455a64');
                })
                .on('mouseleave', function() {
                    d3.select(this).style('background', '#37474f');
                })
                .on('click', () => {
                    this.moveToGroup([componentId], group.id);
                    dialog.remove();
                    d3.select('body').on('keydown.groupSelect', null);
                    this.showToast(`Component added to ${group.name || 'group'}`, 'info');
                });
        });
    
        // Add buttons
        const buttonContainer = dialog.append('div')
            .style('display', 'flex')
            .style('justify-content', 'flex-end')
            .style('gap', '10px');
    
        // Cancel button
        buttonContainer.append('button')
            .attr('class', 'blueprint-button')
            .text('Cancel')
            .style('padding', '5px 15px')
            .style('background', '#37474f')
            .style('color', '#90a4ae')
            .style('border', 'none')
            .style('border-radius', '4px')
            .style('cursor', 'pointer')
            .on('click', () => {
                dialog.remove();
                d3.select('body').on('keydown.groupSelect', null);
            });
    
        // Create New Group button
        buttonContainer.append('button')
            .attr('class', 'blueprint-button')
            .text('Create New Group')
            .style('padding', '5px 15px')
            .style('background', '#0288d1')
            .style('color', '#fff')
            .style('border', 'none')
            .style('border-radius', '4px')
            .style('cursor', 'pointer')
            .on('click', () => {
                dialog.remove();
                d3.select('body').on('keydown.groupSelect', null);
                
                this.showInputDialog(
                    'New Group Name',
                    'New Group',
                    (groupName) => {
                        const newGroup = this.createGroup([componentId], groupName);
                        this.showToast(`Created new group: ${groupName}`, 'info');
                    }
                );
            });
    
        // Add keyboard handler for Escape
        d3.select('body').on('keydown.groupSelect', (event) => {
            if (event.key === 'Escape') {
                dialog.remove();
                d3.select('body').on('keydown.groupSelect', null);
            }
        });

        const dialogDrag = d3.drag()
        .on('start', function(event) {
            const dialogNode = dialog.node();
            const rect = dialogNode.getBoundingClientRect();
            const offsetX = event.x - rect.left;
            const offsetY = event.y - rect.top;
            
            d3.select(this)
                .attr('data-x', offsetX)
                .attr('data-y', offsetY);
        })
        .on('drag', function(event) {
            const offsetX = parseFloat(d3.select(this).attr('data-x'));
            const offsetY = parseFloat(d3.select(this).attr('data-y'));
            
            dialog
                .style('left', `${event.x - offsetX}px`)
                .style('top', `${event.y - offsetY}px`)
                .style('transform', 'none');
        });

    dialog.call(dialogDrag);
}

createGroup(componentIds, groupName = 'New Group') {
    // Calculate bounds of all components to be grouped
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    componentIds.forEach(id => {
        const element = d3.select(`#${id}`);
        const bounds = element.node().getBBox();
        const [x, y] = this.getTransformValues(element.attr('transform'));

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + bounds.width);
        maxY = Math.max(maxY, y + bounds.height);
    });

    // Add padding
    const padding = 20;
    const groupComponent = {
        id: `component-${this.nextId++}`,
        type: 'group',
        name: groupName,
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2),
        children: componentIds
    };

    // Update positions of child components relative to group
    componentIds.forEach(id => {
        const element = d3.select(`#${id}`);
        const [x, y] = this.getTransformValues(element.attr('transform'));
        this.updateComponentPosition(id, x - groupComponent.x, y - groupComponent.y);
    });

    this.components.push(groupComponent);
    const renderedGroup = this.renderGroup(groupComponent);
    this.saveState();

    return groupComponent;
}

updateMinimapViewport() {
    if (!this.minimap) return;

    const viewportRect = this.minimapViewport;
    const transform = d3.zoomTransform(this.svg.node());
    const scale = this.minimapScale;

    const vpWidth = this.width / transform.k;
    const vpHeight = this.height / transform.k;
    const vpX = -transform.x / transform.k;
    const vpY = -transform.y / transform.k;

    viewportRect
        .attr('x', vpX * scale)
        .attr('y', vpY * scale)
        .attr('width', vpWidth * scale)
        .attr('height', vpHeight * scale);
}

setupMinimap() {
    const minimapSize = 200;
    const padding = 10;

    // Create minimap container
    this.minimap = d3.select(this.svg.node().parentNode)
        .append('div')
        .attr('class', 'blueprint-minimap')
        .style('position', 'absolute')
        .style('bottom', `${padding}px`)
        .style('right', `${padding}px`)
        .style('width', `${minimapSize}px`)
        .style('height', `${minimapSize}px`)
        .style('background', 'rgba(38, 50, 56, 0.9)')
        .style('border', '1px solid #546e7a')
        .style('border-radius', '4px')
        .style('overflow', 'hidden');

    // Create minimap SVG
    const minimapSvg = this.minimap.append('svg')
        .attr('width', '100%')
        .attr('height', '100%');

    // Calculate scale for minimap
    const bounds = this.getCanvasBounds();
    const scale = Math.min(
        minimapSize / bounds.width,
        minimapSize / bounds.height
    );
    this.minimapScale = scale;

    // Create group for minimap content
    const minimapContent = minimapSvg.append('g')
        .attr('class', 'minimap-content')
        .attr('transform', `scale(${scale})`);

    // Clone and simplify canvas content for minimap
    this.updateMinimapContent(minimapContent);

    // Add viewport rectangle
    this.minimapViewport = minimapSvg.append('rect')
        .attr('class', 'minimap-viewport')
        .attr('fill', 'none')
        .attr('stroke', '#29b6f6')
        .attr('stroke-width', '2')
        .style('pointer-events', 'none');

    // Add drag behavior for viewport navigation
    const minimapDrag = d3.drag()
        .on('start drag', (event) => {
            const scale = this.minimapScale;
            const transform = d3.zoomTransform(this.svg.node());
            
            const newX = -event.x / scale * transform.k;
            const newY = -event.y / scale * transform.k;
            
            this.svg.call(this.zoom.transform, d3.zoomIdentity
                .translate(newX, newY)
                .scale(transform.k));
        });

    minimapSvg.call(minimapDrag);

    // Update minimap when canvas changes
    this.on('change', () => {
        this.updateMinimapContent(minimapContent);
        this.updateMinimapViewport();
    });

    // Add minimap controls
    const controls = this.minimap.append('div')
        .attr('class', 'minimap-controls')
        .style('position', 'absolute')
        .style('top', '5px')
        .style('right', '5px')
        .style('display', 'flex')
        .style('gap', '5px');

    // Toggle button
    controls.append('button')
        .attr('class', 'minimap-toggle')
        .style('background', 'none')
        .style('border', 'none')
        .style('color', '#90a4ae')
        .style('cursor', 'pointer')
        .style('padding', '2px')
        .html('&#8722;')  // Minus symbol
        .on('click', () => this.toggleMinimap());

    // Close button
    controls.append('button')
        .attr('class', 'minimap-close')
        .style('background', 'none')
        .style('border', 'none')
        .style('color', '#90a4ae')
        .style('cursor', 'pointer')
        .style('padding', '2px')
        .html('&times;')  // Times symbol
        .on('click', () => this.removeMinimap());

    // Add resize handle
    const resizeHandle = this.minimap.append('div')
        .attr('class', 'minimap-resize-handle')
        .style('position', 'absolute')
        .style('bottom', '0')
        .style('right', '0')
        .style('width', '10px')
        .style('height', '10px')
        .style('cursor', 'nw-resize')
        .style('background', '#546e7a');

    // Add resize behavior
    const resizeDrag = d3.drag()
        .on('drag', (event) => {
            const width = Math.max(150, Math.min(400, parseFloat(this.minimap.style('width')) + event.dx));
            const height = Math.max(150, Math.min(400, parseFloat(this.minimap.style('height')) + event.dy));
            
            this.minimap
                .style('width', `${width}px`)
                .style('height', `${height}px`);
            
            this.updateMinimapScale();
        });

    resizeHandle.call(resizeDrag);
}

updateMinimapContent(minimapContent) {
    minimapContent.selectAll('*').remove();

    // Draw connections
    this.connections.forEach(connection => {
        const fromElement = d3.select(`#${connection.from}`);
        const toElement = d3.select(`#${connection.to}`);
        
        if (!fromElement.empty() && !toElement.empty()) {
            const fromBounds = fromElement.node().getBBox();
            const toBounds = toElement.node().getBBox();
            const [fromX, fromY] = this.getTransformValues(fromElement.attr('transform'));
            const [toX, toY] = this.getTransformValues(toElement.attr('transform'));

            minimapContent.append('path')
                .attr('d', this.lineGenerator([
                    [fromX + fromBounds.width, fromY + fromBounds.height/2],
                    [toX, toY + toBounds.height/2]
                ]))
                .attr('stroke', '#29b6f6')
                .attr('stroke-width', '1')
                .attr('fill', 'none');
        }
    });

    // Draw components
    this.components.forEach(component => {
        const element = d3.select(`#${component.id}`);
        if (!element.empty()) {
            const [x, y] = this.getTransformValues(element.attr('transform'));
            const bounds = element.node().getBBox();

            minimapContent.append('rect')
                .attr('x', x)
                .attr('y', y)
                .attr('width', bounds.width)
                .attr('height', bounds.height)
                .attr('fill', component.type === 'group' ? '#455a64' : '#37474f')
                .attr('stroke', '#546e7a')
                .attr('stroke-width', '1');
        }
    });
}
     
updateMinimapScale() {
    const minimapWidth = parseFloat(this.minimap.style('width'));
    const minimapHeight = parseFloat(this.minimap.style('height'));
    const bounds = this.getCanvasBounds();
    
    const scale = Math.min(
        minimapWidth / bounds.width,
        minimapHeight / bounds.height
    );
    
    this.minimapScale = scale;
    
    const minimapContent = this.minimap.select('.minimap-content');
    minimapContent.attr('transform', `scale(${scale})`);
    
    this.updateMinimapViewport();
}

toggleMinimap() {
    const content = this.minimap.select('svg');
    const toggle = this.minimap.select('.minimap-toggle');
    
    if (content.style('display') === 'none') {
        content.style('display', null);
        toggle.html('&#8722;'); // Minus symbol
        this.minimap
            .style('height', this.minimapLastHeight || '200px')
            .style('background', 'rgba(38, 50, 56, 0.9)');
    } else {
        this.minimapLastHeight = this.minimap.style('height');
        content.style('display', 'none');
        toggle.html('&#43;'); // Plus symbol
        this.minimap
            .style('height', '24px')
            .style('background', 'rgba(38, 50, 56, 0.7)');
    }
}

removeMinimap() {
    if (this.minimap) {
        this.minimap.remove();
        this.minimap = null;
        this.minimapViewport = null;
        this.minimapScale = null;
    }
}

getCanvasBounds() {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    // Include all components in bounds calculation
    this.components.forEach(component => {
        const element = d3.select(`#${component.id}`);
        if (!element.empty()) {
            const bounds = element.node().getBBox();
            const [x, y] = this.getTransformValues(element.attr('transform'));

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + bounds.width);
            maxY = Math.max(maxY, y + bounds.height);
        }
    });

    // Add padding
    const padding = 50;
    return {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2)
    };
}

fitToScreen() {
    const bounds = this.getCanvasBounds();
    const scale = Math.min(
        this.width / bounds.width,
        this.height / bounds.height
    ) * 0.9; // 90% of available space

    const centerX = -bounds.x * scale + (this.width - bounds.width * scale) / 2;
    const centerY = -bounds.y * scale + (this.height - bounds.height * scale) / 2;

    this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(scale));
}

centerOnComponent(componentId) {
    const element = d3.select(`#${componentId}`);
    if (element.empty()) return;

    const bounds = element.node().getBBox();
    const [x, y] = this.getTransformValues(element.attr('transform'));
    const transform = d3.zoomTransform(this.svg.node());

    const centerX = -x * transform.k + (this.width - bounds.width * transform.k) / 2;
    const centerY = -y * transform.k + (this.height - bounds.height * transform.k) / 2;

    this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(transform.k));
}

centerOnSelection() {
    if (this.selectedComponents.size === 0) return;

    const bounds = this.getSelectionBounds();
    if (!bounds) return;

    const transform = d3.zoomTransform(this.svg.node());
    
    const centerX = -bounds.x * transform.k + (this.width - bounds.width * transform.k) / 2;
    const centerY = -bounds.y * transform.k + (this.height - bounds.height * transform.k) / 2;

    this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(transform.k));
}

zoomToFit(padding = 50) {
    if (this.components.length === 0) return;

    const bounds = this.getCanvasBounds();
    
    // Add padding
    bounds.x -= padding;
    bounds.y -= padding;
    bounds.width += padding * 2;
    bounds.height += padding * 2;

    const scale = Math.min(
        this.width / bounds.width,
        this.height / bounds.height
    );

    const centerX = -bounds.x * scale + (this.width - bounds.width * scale) / 2;
    const centerY = -bounds.y * scale + (this.height - bounds.height * scale) / 2;

    this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(scale));
}

zoomToSelection(padding = 50) {
    if (this.selectedComponents.size === 0) return;

    const bounds = this.getSelectionBounds();
    if (!bounds) return;

    // Add padding
    bounds.x -= padding;
    bounds.y -= padding;
    bounds.width += padding * 2;
    bounds.height += padding * 2;

    const scale = Math.min(
        this.width / bounds.width,
        this.height / bounds.height
    );

    const centerX = -bounds.x * scale + (this.width - bounds.width * scale) / 2;
    const centerY = -bounds.y * scale + (this.height - bounds.height * scale) / 2;

    this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(scale));
}

resetZoom() {
    this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity);
}

setupZoomControls() {
    const controls = d3.select(this.svg.node().parentNode)
        .append('div')
        .attr('class', 'blueprint-zoom-controls')
        .style('position', 'absolute')
        .style('bottom', '20px')
        .style('left', '20px')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('gap', '5px')
        .style('background', 'rgba(38, 50, 56, 0.9)')
        .style('padding', '5px')
        .style('border-radius', '4px')
        .style('box-shadow', '0 2px 4px rgba(0, 0, 0, 0.2)');

    // Zoom in button
    controls.append('button')
        .attr('class', 'zoom-button')
        .style('background', '#37474f')
        .style('border', 'none')
        .style('color', '#90a4ae')
        .style('width', '30px')
        .style('height', '30px')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .html('&#43;')  // Plus symbol
        .on('click', () => {
            const transform = d3.zoomTransform(this.svg.node());
            this.svg.transition()
                .duration(300)
                .call(this.zoom.transform, transform.scale(transform.k * 1.2));
        });

    // Zoom out button
    controls.append('button')
        .attr('class', 'zoom-button')
        .style('background', '#37474f')
        .style('border', 'none')
        .style('color', '#90a4ae')
        .style('width', '30px')
        .style('height', '30px')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .html('&#8722;')  // Minus symbol
        .on('click', () => {
            const transform = d3.zoomTransform(this.svg.node());
            this.svg.transition()
                .duration(300)
                .call(this.zoom.transform, transform.scale(transform.k / 1.2));
        });

    // Reset zoom button
    controls.append('button')
        .attr('class', 'zoom-button')
        .style('background', '#37474f')
        .style('border', 'none')
        .style('color', '#90a4ae')
        .style('width', '30px')
        .style('height', '30px')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .html('&#8634;')  // Reset symbol
        .on('click', () => this.resetZoom());

    // Fit to screen button
    controls.append('button')
        .attr('class', 'zoom-button')
        .style('background', '#37474f')
        .style('border', 'none')
        .style('color', '#90a4ae')
        .style('width', '30px')
        .style('height', '30px')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .html('&#9744;')  // Rectangle symbol
        .on('click', () => this.fitToScreen())
        .append('title')
        .text('Fit to Screen');

    // Center selection button
    controls.append('button')
        .attr('class', 'zoom-button')
        .style('background', '#37474f')
        .style('border', 'none')
        .style('color', '#90a4ae')
        .style('width', '30px')
        .style('height', '30px')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .html('&#9678;')  // Circle symbol
        .on('click', () => this.centerOnSelection())
        .append('title')
        .text('Center Selection');

    // Add hover effects to all buttons
    controls.selectAll('.zoom-button')
        .on('mouseenter', function() {
            d3.select(this)
                .style('background', '#455a64')
                .style('color', '#b0bec5');
        })
        .on('mouseleave', function() {
            d3.select(this)
                .style('background', '#37474f')
                .style('color', '#90a4ae');
        })
        .on('mousedown', function() {
            d3.select(this)
                .style('background', '#546e7a')
                .style('color', '#cfd8dc');
        })
        .on('mouseup', function() {
            d3.select(this)
                .style('background', '#455a64')
                .style('color', '#b0bec5');
        });

    // Add zoom level indicator
    const zoomLevel = controls.append('div')
        .attr('class', 'zoom-level')
        .style('text-align', 'center')
        .style('color', '#90a4ae')
        .style('font-size', '12px')
        .style('padding', '5px')
        .text('100%');

    // Update zoom level indicator when zooming
    this.svg.on('zoom', (event) => {
        const scale = event.transform.k;
        zoomLevel.text(`${Math.round(scale * 100)}%`);
    });
}


        renderComponent(component) {
            const typeConfig = BlueprintCanvas.COMPONENT_TYPES[component.type.toUpperCase()];
            
            const g = this.mainGroup.append('g')
                .attr('class', 'component')
                .attr('id', component.id)
                .attr('transform', `translate(${component.x},${component.y})`);
    
            // Add error checking for typeConfig
            if (!typeConfig) {
                console.error(`Invalid component type: ${component.type}`);
                return null;
            }
    
            // Main box
            g.append('rect')
                .attr('width', component.width)
                .attr('height', component.height)
                .attr('rx', 5)
                .attr('ry', 5)
                .attr('fill', typeConfig.color)
                .attr('stroke', typeConfig.borderColor)
                .attr('stroke-width', 2);
    
            // Component name
            const titleText = g.append('text')
                .attr('class', 'component-title')
                .attr('x', component.width / 2)
                .attr('y', 25)
                .attr('text-anchor', 'middle')
                .text(component.name)
                .attr('fill', '#90caf9')
                .attr('font-size', '14px');
    
            // Add ports
            this.renderPorts(g, component, 'inputs');
            this.renderPorts(g, component, 'outputs');
    
            // Apply drag behavior
            g.call(this.drag);
    
            return g;
        }

        renderComponentContent(g, component) {
            const typeConfig = BlueprintCanvas.COMPONENT_TYPES[component.type.toUpperCase()];
            
            // Header
            g.append('rect')
                .attr('class', 'component-header')
                .attr('width', component.width)
                .attr('height', 25)
                .attr('rx', 5)
                .attr('ry', 5)
                .attr('fill', typeConfig.color)
                .attr('stroke', typeConfig.borderColor)
                .attr('stroke-width', 2);
    
            // Main body
            g.append('rect')
                .attr('class', 'component-body')
                .attr('y', 25)
                .attr('width', component.width)
                .attr('height', component.height - 25)
                .attr('fill', typeConfig.color)
                .attr('stroke', typeConfig.borderColor)
                .attr('stroke-width', 2);
    
            // Type indicator
            g.append('text')
                .attr('class', 'component-type')
                .attr('x', 5)
                .attr('y', 17)
                .text(component.type)
                .attr('fill', '#90caf9')
                .attr('font-size', '12px')
                .style('font-style', 'italic');
    
            // Component name with double-click handler
            const titleText = g.append('text')
                .attr('class', 'component-title')
                .attr('x', component.width / 2)
                .attr('y', 17)
                .attr('text-anchor', 'middle')
                .text(component.name)
                .attr('fill', '#90caf9')
                .attr('font-size', '14px')
                .style('cursor', 'pointer'); // Add cursor pointer
    
            titleText.on('dblclick', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.editComponentName(g, component);
            });
    
            // Render ports
            this.renderPorts(g, component, 'inputs');
            this.renderPorts(g, component, 'outputs');
        }
    
        selectComponent(componentId, addToSelection = false) {
            if (!addToSelection) {
                this.clearSelection();
            }
            
            this.selectedComponents.add(componentId);
            d3.select(`#${componentId}`)
                .select('rect')
                .attr('stroke-width', 3);
        }
    
        clearSelection() {
            this.selectedComponents.forEach(componentId => {
                d3.select(`#${componentId}`)
                    .select('rect')
                    .attr('stroke-width', 2);
            });
            this.selectedComponents.clear();
        }

        renderPorts(g, component, type) {
            const isInput = type === 'inputs';
            const ports = component[type];
            const portSpacing = (component.height - 25) / (ports.length + 1);
            
            ports.forEach((port, index) => {
                const portGroup = g.append('g')
                    .attr('class', `port ${type}`)
                    .attr('id', `${component.id}-${port.id}`);
        
                const yPosition = 25 + (index + 1) * portSpacing;
        
                // Port circle
                const portCircle = portGroup.append('circle')
                    .attr('class', 'port-circle')  // Add a class for easier selection
                    .attr('cx', isInput ? 0 : component.width)
                    .attr('cy', yPosition)
                    .attr('r', 5)
                    .attr('fill', '#29b6f6')
                    .attr('stroke', '#90caf9')
                    .attr('stroke-width', 2)
                    .style('cursor', 'pointer');
    
                // Port label
                const portLabel = portGroup.append('text')
                    .attr('x', isInput ? 10 : component.width - 10)
                    .attr('y', yPosition)
                    .attr('dy', '0.3em')
                    .attr('text-anchor', isInput ? 'start' : 'end')
                    .text(port.name)
                    .attr('fill', '#90caf9')
                    .attr('font-size', '12px');
    
                // Port type indicator
                portGroup.append('text')
                    .attr('x', isInput ? 10 : component.width - 10)
                    .attr('y', yPosition + 15)
                    .attr('dy', '0.3em')
                    .attr('text-anchor', isInput ? 'start' : 'end')
                    .text(port.type)
                    .attr('fill', '#64b5f6')
                    .attr('font-size', '10px')
                    .style('font-style', 'italic');
    
                // Port interactions
                portCircle.on('mousedown', (event) => {
                    event.stopPropagation();
                    if (isInput && this.isCreatingConnection) {
                        this.finishConnection(portGroup);
                    } else if (!isInput && !this.isCreatingConnection) {
                        this.startConnection(portGroup);
                    }
                });
    
                // Port deletion
                portLabel.on('dblclick', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (ports.length > 1) {
                        component[type] = ports.filter(p => p.id !== port.id);
                        this.rerenderComponent(component);
                        this.updateConnectionsForComponent(component.id);
                        this.saveState();
                    }
                });
            });
        }
    
        getAIDescription() {
            return {
                components: this.components.map(component => ({
                    id: component.id,
                    type: component.type,
                    name: component.name,
                    inputs: component.inputs,
                    outputs: component.outputs
                })),
                connections: this.connections.map(connection => ({
                    from: connection.from,
                    to: connection.to
                }))
            };
        }
    
        applyAIChanges(changes) {
            if (changes.components) {
                changes.components.forEach(componentChange => {
                    const component = this.components.find(c => c.id === componentChange.id);
                    if (component) {
                        Object.assign(component, componentChange);
                        this.rerenderComponent(component);
                    }
                });
            }
    
            if (changes.connections) {
                changes.connections.forEach(connection => {
                    this.addConnection(connection.from, connection.to);
                });
            }
    
            this.saveState();
        }
    
        validateConnection(fromPort, toPort) {
            const fromComponent = this.components.find(c => fromPort.startsWith(c.id));
            const toComponent = this.components.find(c => toPort.startsWith(c.id));
            
            if (!fromComponent || !toComponent) return false;
            
            const fromPortData = fromComponent.outputs.find(p => `${fromComponent.id}-${p.id}` === fromPort);
            const toPortData = toComponent.inputs.find(p => `${toComponent.id}-${p.id}` === toPort);
            
            if (!fromPortData || !toPortData) return false;
            
            return fromPortData.type === 'any' || 
                   toPortData.type === 'any' || 
                   fromPortData.type === toPortData.type;
        }
    }

    
    document.addEventListener('DOMContentLoaded', () => {
        window.blueprintCanvas = new BlueprintCanvas();
    });