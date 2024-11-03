class BlueprintCanvas {
    static get COMPONENT_TYPES() {
        return {
            FUNCTION: {
                name: 'function',
                color: 'rgba(13, 71, 161, 0.6)',
                borderColor: '#29b6f6'
            },
            CLASS: {
                name: 'class',
                color: 'rgba(56, 142, 60, 0.6)',
                borderColor: '#66bb6a'
            },
            MODULE: {
                name: 'module',
                color: 'rgba(136, 14, 79, 0.6)',
                borderColor: '#ec407a'
            }
        };
    }

    constructor() {
        console.log('Initializing BlueprintCanvas');
        this.svg = d3.select('#main-canvas');
        this.components = [];
        this.connections = [];
        this.currentConnection = null;
        this.nextId = 1;
        
        // Create layers with specific order (only create once)
        this.gridLayer = this.svg.append('g').attr('class', 'grid-layer');
        this.connectionLayer = this.svg.append('g').attr('class', 'connection-layer');
        this.mainGroup = this.svg.append('g').attr('class', 'main-group');
        
        this.width = this.svg.node().parentElement.clientWidth;
        this.height = this.svg.node().parentElement.clientHeight;
        
        console.log('Canvas dimensions:', this.width, this.height);
        
        this.svg
            .attr('width', this.width)
            .attr('height', this.height);

        // Add connection line generator
        this.lineGenerator = d3.line()
            .curve(d3.curveBasis);

        this.setupGrid();

        // Simplified drag behavior
        this.drag = d3.drag()
        .on('drag', (event) => {
            const g = d3.select(event.sourceEvent.target.parentNode);
            const currentTransform = g.attr('transform');
            let x = 0, y = 0;
            
            if (currentTransform) {
                const parts = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
                if (parts) {
                    x = parseFloat(parts[1]);
                    y = parseFloat(parts[2]);
                }
            }
            
            g.attr('transform', `translate(${x + event.dx},${y + event.dy})`);
            
            // Update all connections involving this component
            this.updateConnectionsForComponent(g.attr('id'));
        });

        this.svg.on('dblclick', (event) => {
            console.log('Double click detected');
            this.createComponent(event);
        });

        // Add state for connection creation
        this.isCreatingConnection = false;
        this.tempConnection = null;
        this.startPort = null;

        // Add mouse move handler for drawing temporary connection
        this.svg.on('mousemove', (event) => {
            if (this.isCreatingConnection) {
                this.updateTempConnection(event);
            }
        });

        this.svg.on('contextmenu', (event) => {
            event.preventDefault();
        });
    }

    // Add these new methods for connection updates
    updateConnectionsForComponent(componentId) {
        this.connections.forEach(connection => {
            if (connection.from.startsWith(componentId) || connection.to.startsWith(componentId)) {
                this.updateConnection(connection);
            }
        });
    }

    updateConnection(connection) {
        const connectionPath = d3.select(`#${connection.id}`);
        const fromEl = d3.select(`#${connection.from}`);
        const toEl = d3.select(`#${connection.to}`);
        
        if (!fromEl.empty() && !toEl.empty()) {
            const fromPos = this.getPortPosition(fromEl);
            const toPos = this.getPortPosition(toEl);
            const path = this.calculateConnectionPath(fromPos, toPos);
            connectionPath.attr('d', path);
        }
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
            .attr('pointer-events', 'none');

        this.gridLayer.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'url(#major-grid)')
            .attr('pointer-events', 'none');
    }

    addConnection(fromPort, toPort) {
        const connection = {
            id: `conn-${this.connections.length}`,
            from: fromPort,
            to: toPort
        };
        
        this.connections.push(connection);
        this.renderConnection(connection);
        console.log(`Created connection from ${fromPort} to ${toPort}`);
        return connection;
    }

    removeConnection(connectionId) {
        const index = this.connections.findIndex(conn => conn.id === connectionId);
        if (index !== -1) {
            this.connections.splice(index, 1);
            d3.select(`#${connectionId}`).remove();
            console.log(`Removed connection ${connectionId}`);
        }
    }

    renderConnection(connection) {
        const fromEl = d3.select(`#${connection.from}`);
        const toEl = d3.select(`#${connection.to}`);
        
        if (!fromEl.empty() && !toEl.empty()) {
            const fromPos = this.getPortPosition(fromEl);
            const toPos = this.getPortPosition(toEl);
            
            // Create curved path
            const path = this.calculateConnectionPath(fromPos, toPos);
            
            const connectionPath = this.connectionLayer.append('path')
                .attr('id', connection.id)
                .attr('class', 'connection')
                .attr('d', path)
                .attr('stroke', '#29b6f6')
                .attr('stroke-width', 2)
                .attr('fill', 'none');
    
            // Add event listeners
            connectionPath.on('contextmenu', (event) => {
                event.preventDefault();
                event.stopPropagation();
                console.log('Removing connection:', connection.id);
                this.removeConnection(connection.id);
            });
    
            connectionPath.on('mouseover', function() {
                d3.select(this)
                    .attr('stroke-width', 3)
                    .attr('stroke', '#ff4081');
            });
    
            connectionPath.on('mouseout', function() {
                d3.select(this)
                    .attr('stroke-width', 2)
                    .attr('stroke', '#29b6f6');
            });
        }
    }

    getPortPosition(portEl) {
        // Get the component group (parent of port group)
        const componentGroup = d3.select(portEl.node().parentNode);
        const transform = componentGroup.attr('transform');
        let translateX = 0, translateY = 0;
        
        if (transform) {
            const matches = transform.match(/translate\(([^,]+),([^)]+)\)/);
            if (matches) {
                translateX = parseFloat(matches[1]);
                translateY = parseFloat(matches[2]);
            }
        }
        
        const circle = portEl.select('circle');
        return {
            x: translateX + parseFloat(circle.attr('cx')),
            y: translateY + parseFloat(circle.attr('cy'))
        };
    }

    calculateConnectionPath(from, to) {
        const controlPoint1 = {
            x: from.x + Math.abs(to.x - from.x) * 0.5,
            y: from.y
        };
        
        const controlPoint2 = {
            x: to.x - Math.abs(to.x - from.x) * 0.5,
            y: to.y
        };

        return this.lineGenerator([
            [from.x, from.y],
            [controlPoint1.x, controlPoint1.y],
            [controlPoint2.x, controlPoint2.y],
            [to.x, to.y]
        ]);
    }

    createComponent(event) {
        console.log('Creating component');
        const coords = d3.pointer(event);
        
        const component = {
            id: `component-${this.nextId++}`,
            x: coords[0],
            y: coords[1],
            width: 150,
            height: 100,
            name: 'New Component',
            inputs: [
                { name: 'input1', id: 'in1' }
            ],
            outputs: [
                { name: 'output1', id: 'out1' }
            ],
            type: 'function'  // default type
        };
    
        this.components.push(component);
        this.renderComponent(component);
    }

    initializeComponentEditing(g, component) {
        // Make title editable on double click
        g.select('text')
            .on('dblclick', (event) => {
                event.stopPropagation();
                this.editComponentName(g, component);
            });
    
        // Add type selector
        const typeSelector = g.append('g')
            .attr('class', 'type-selector')
            .attr('transform', `translate(${component.width - 25}, 5)`);
    
        typeSelector.append('rect')
            .attr('width', 20)
            .attr('height', 20)
            .attr('rx', 3)
            .attr('fill', BlueprintCanvas.COMPONENT_TYPES[component.type.toUpperCase()].color)
            .on('click', (event) => {
                event.stopPropagation();
                this.showTypeMenu(component, typeSelector);
            });
    }
    
    editComponentName(g, component) {
        const textElement = g.select('text');
        const currentName = component.name;
        
        // Hide existing text
        textElement.style('display', 'none');
        
        // Create foreign object for input
        const fo = g.append('foreignObject')
            .attr('x', component.width / 2 - 60)
            .attr('y', 10)
            .attr('width', 120)
            .attr('height', 25);
        
        const input = fo.append('xhtml:input')
            .attr('type', 'text')
            .attr('value', currentName)
            .style('width', '100%')
            .style('background', 'transparent')
            .style('border', '1px solid #29b6f6')
            .style('color', '#90caf9')
            .style('text-align', 'center');
        
        input.node().focus();
        
        input.on('blur', () => {
            const newName = input.node().value.trim() || currentName;
            component.name = newName;
            textElement.text(newName);
            textElement.style('display', null);
            fo.remove();
        });
        
        input.on('keydown', (event) => {
            if (event.key === 'Enter') {
                input.node().blur();
            } else if (event.key === 'Escape') {
                textElement.style('display', null);
                fo.remove();
            }
        });
    }
    
    showTypeMenu(component, typeSelector) {
        const types = Object.entries(BlueprintCanvas.COMPONENT_TYPES);
        const menu = typeSelector.append('g')
            .attr('class', 'type-menu')
            .attr('transform', 'translate(0, 20)');
        
        types.forEach(([type, config], index) => {
            const item = menu.append('g')
                .attr('transform', `translate(0, ${index * 25})`);
            
            item.append('rect')
                .attr('width', 80)
                .attr('height', 20)
                .attr('fill', config.color)
                .attr('rx', 3);
            
            item.append('text')
                .attr('x', 5)
                .attr('y', 15)
                .attr('fill', '#ffffff')
                .text(config.name);
                
            item.on('click', (event) => {
                event.stopPropagation();
                this.changeComponentType(component, type);
                menu.remove();
            });
        });
        
        // Close menu when clicking outside
        d3.select('body').on('click.typemenu', () => {
            menu.remove();
            d3.select('body').on('click.typemenu', null);
        });
    }
    
    changeComponentType(component, newType) {
        component.type = newType.toLowerCase();
        const typeConfig = BlueprintCanvas.COMPONENT_TYPES[newType];
        
        const g = d3.select(`#${component.id}`);
        g.select('rect')
            .attr('fill', typeConfig.color)
            .attr('stroke', typeConfig.borderColor);
    }



    renderComponent(component) {
        const typeConfig = BlueprintCanvas.COMPONENT_TYPES[component.type.toUpperCase()];
        
        const g = this.mainGroup.append('g')
            .attr('class', 'component')
            .attr('id', component.id)
            .attr('transform', `translate(${component.x},${component.y})`)
            .style('cursor', 'move');
    
        // Main box
        g.append('rect')
            .attr('width', component.width)
            .attr('height', component.height)
            .attr('rx', 5)
            .attr('ry', 5)
            .attr('fill', typeConfig.color)
            .attr('stroke', typeConfig.borderColor)
            .attr('stroke-width', 2)
            .style('pointer-events', 'all');
    
        // Component name
        g.append('text')
            .attr('x', component.width / 2)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .text(component.name)
            .attr('fill', '#90caf9')
            .attr('font-size', '14px')
            .style('pointer-events', 'none');
    
        // Initialize editing capabilities
        this.initializeComponentEditing(g, component);
    
        // Render ports
        this.renderPorts(g, component, 'inputs');
        this.renderPorts(g, component, 'outputs');
    
        // Apply drag behavior
        g.call(this.drag);
    }

    finishConnection(endPortEl) {
        console.log('Finishing connection to', endPortEl.attr('id'));
        if (!this.startPort || !this.isCreatingConnection) return;
    
        const startPortId = this.startPort.attr('id');
        const endPortId = endPortEl.attr('id');
    
        // Remove temporary connection line
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
    
        // Create permanent connection
        this.addConnection(startPortId, endPortId);
    
        // Reset connection state
        this.isCreatingConnection = false;
        this.startPort = null;
    }


    // Add these new methods for connection interaction
    initializePortInteraction() {
        // Add click handlers to all port circles
        d3.selectAll('.port circle')
            .on('click', (event) => {
                event.stopPropagation();
                const portGroup = d3.select(event.target.parentNode);
                const portType = portGroup.attr('class');
                this.handlePortClick(portGroup, portType);
            });
    }

    handlePortClick(portEl, portType) {
        const isOutput = portType.includes('outputs');
        
        if (!this.isCreatingConnection) {
            // Start new connection from output port only
            if (isOutput) {
                this.startConnection(portEl);
            }
        } else {
            // Finish connection to input port only
            if (!isOutput) {
                this.finishConnection(portEl);
            }
        }
    }

    startConnection(portEl) {
        console.log('Starting connection from', portEl.attr('id'));
        this.isCreatingConnection = true;
        this.startPort = portEl;
        
        // Create temporary connection line
        this.tempConnection = this.connectionLayer.append('path')
            .attr('class', 'connection temp')
            .attr('stroke', '#29b6f6')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .attr('fill', 'none');
    }
    
    updateTempConnection(event) {
        if (!this.tempConnection) return;
    
        const startPos = this.getPortPosition(this.startPort);
        const mousePos = d3.pointer(event);
        
        const path = this.calculateConnectionPath(startPos, {x: mousePos[0], y: mousePos[1]});
        this.tempConnection.attr('d', path);
    }


    renderPorts(g, component, type) {
        const isInput = type === 'inputs';
        const ports = component[type];
        const portSpacing = component.height / (ports.length + 1);
        
        ports.forEach((port, index) => {
            const portGroup = g.append('g')
                .attr('class', `port ${type}`)
                .attr('id', `${component.id}-${port.id}`);

            // Port circle
            portGroup.append('circle')
                .attr('cx', isInput ? 0 : component.width)
                .attr('cy', (index + 1) * portSpacing)
                .attr('r', 5)
                .attr('fill', '#29b6f6')
                .attr('stroke', '#90caf9')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer');

            // Port label
            portGroup.append('text')
                .attr('x', isInput ? 10 : component.width - 10)
                .attr('y', (index + 1) * portSpacing)
                .attr('dy', '0.3em')
                .attr('text-anchor', isInput ? 'start' : 'end')
                .text(port.name)
                .attr('fill', '#90caf9')
                .attr('font-size', '12px')
                .style('pointer-events', 'none');
        });
        // After creating ports, initialize interaction
        this.initializePortInteraction();
    }

    // Add method to cancel connection creation
    cancelConnection() {
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
        this.isCreatingConnection = false;
        this.startPort = null;
            // Add click handler to cancel connection
        this.svg.on('click', () => {
            if (this.isCreatingConnection) {
                this.cancelConnection();
            }
        });
        }

    // Add method for AI to create connections
    aiCreateConnection(fromComponentId, fromPortId, toComponentId, toPortId) {
        const fromPort = `${fromComponentId}-${fromPortId}`;
        const toPort = `${toComponentId}-${toPortId}`;
        return this.addConnection(fromPort, toPort);
    }

    // Add method to get current diagram state (for AI)
    getDiagramState() {
        return {
            components: this.components,
            connections: this.connections
        };
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    window.blueprintCanvas = new BlueprintCanvas();
});