/**
 * ComponentManager - Handles component creation, rendering, and manipulation
 */
class ComponentManager {
    constructor(mainGroup, drag, portManager) {
        this.mainGroup = mainGroup;
        this.drag = drag;
        this.portManager = portManager;
        this.componentIdCounter = 1;
        this.onConnectionStart = null;
        this.onConnectionFinish = null;
        this.onComponentUpdate = null;
    }

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

    /**
     * Create a new component
     */
    createComponent(x, y, type = 'function') {
        const typeConfig = ComponentManager.COMPONENT_TYPES[type.toUpperCase()];
        if (!typeConfig) {
            console.error(`Invalid component type: ${type}`);
            return null;
        }

        const component = {
            id: `component-${this.componentIdCounter++}`,
            x: x,
            y: y,
            width: 200,
            height: 100,
            name: `New ${type}`,
            type: type,
            inputs: JSON.parse(JSON.stringify(typeConfig.defaultPorts.inputs)),
            outputs: JSON.parse(JSON.stringify(typeConfig.defaultPorts.outputs))
        };

        return component;
    }

    /**
     * Render a component on the canvas
     */
    renderComponent(component) {
        const typeConfig = ComponentManager.COMPONENT_TYPES[component.type.toUpperCase()];

        if (!typeConfig) {
            console.error(`Invalid component type: ${component.type}`);
            return null;
        }

        const g = this.mainGroup.append('g')
            .attr('class', 'component')
            .attr('id', component.id)
            .attr('transform', `translate(${component.x},${component.y})`)
            .style('cursor', 'move');

        // Calculate required height based on inputs and outputs
        const portSpacing = 30;
        const headerHeight = 30;
        const portPadding = 20;

        const inputsHeight = component.inputs.length * portSpacing;
        const outputsHeight = component.outputs.length * portSpacing;
        const totalPortsHeight = Math.max(inputsHeight, outputsHeight);

        component.height = headerHeight + totalPortsHeight + (portPadding * 2);

        // Calculate minimum width based on component name
        const tempText = g.append('text')
            .text(component.name)
            .attr('font-size', '14px');
        const textWidth = tempText.node().getComputedTextLength();
        tempText.remove();

        component.width = Math.max(150, textWidth + 40);

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
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .text(component.name)
            .attr('fill', '#90caf9')
            .attr('font-size', '14px');

        // Double-click to edit name
        titleText.on('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.editComponentName(g, component);
        });

        // Render ports
        this.renderPorts(g, component, 'inputs');
        this.renderPorts(g, component, 'outputs');

        // Apply drag behavior
        if (this.drag) {
            g.call(this.drag);
        }

        return g;
    }

    /**
     * Re-render a component (after changes)
     */
    rerenderComponent(component) {
        const oldGroup = d3.select(`#${component.id}`);
        const transform = oldGroup.attr('transform');
        oldGroup.remove();

        const g = this.renderComponent(component);
        if (g && transform) {
            g.attr('transform', transform);
        }

        return g;
    }

    /**
     * Render ports for a component
     */
    renderPorts(g, component, type) {
        const isInput = type === 'inputs';
        const ports = component[type];
        if (!ports || ports.length === 0) return;

        const portSpacing = (component.height - 25) / (ports.length + 1);

        ports.forEach((port, index) => {
            const portGroup = g.append('g')
                .attr('class', `port ${type}`)
                .attr('id', `${component.id}-${port.id}`);

            const yPosition = 25 + (index + 1) * portSpacing;

            // Port circle
            const portCircle = portGroup.append('circle')
                .attr('class', 'port-circle')
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

            // Port interactions for connections
            portCircle.on('mousedown', (event) => {
                event.stopPropagation();
                // For output ports, start connection
                if (!isInput && this.onConnectionStart) {
                    this.onConnectionStart(portGroup);
                }
                // For input ports, finish connection
                else if (isInput && this.onConnectionFinish) {
                    this.onConnectionFinish(portGroup);
                }
            });

            // Port label double-click for deletion
            portLabel.on('dblclick', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (ports.length > 1 && this.portManager) {
                    this.portManager.removePort(component, port.id, type);
                    this.rerenderComponent(component);
                    if (this.onComponentUpdate) {
                        this.onComponentUpdate(component);
                    }
                }
            });
        });
    }

    /**
     * Edit component name inline
     */
    editComponentName(g, component) {
        const titleText = g.select('.component-title');
        const currentName = titleText.text();

        // Hide the text
        titleText.style('display', 'none');

        // Create a foreignObject for HTML input
        const foreign = g.append('foreignObject')
            .attr('x', component.width / 2 - 75)
            .attr('y', 5)
            .attr('width', 150)
            .attr('height', 30);

        const input = foreign.append('xhtml:input')
            .attr('type', 'text')
            .attr('value', currentName)
            .style('width', '100%')
            .style('text-align', 'center')
            .style('background', '#1a237e')
            .style('color', '#90caf9')
            .style('border', '1px solid #29b6f6')
            .style('font-family', 'Courier New, monospace')
            .style('font-size', '14px')
            .node();

        input.focus();
        input.select();

        const finishEdit = () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                component.name = newName;
                titleText.text(newName);
                if (this.onComponentUpdate) {
                    this.onComponentUpdate(component);
                }
            }
            foreign.remove();
            titleText.style('display', null);
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                finishEdit();
            } else if (event.key === 'Escape') {
                foreign.remove();
                titleText.style('display', null);
            }
        });
    }

    /**
     * Delete a component from the canvas
     */
    deleteComponent(componentId) {
        d3.select(`#${componentId}`).remove();
        return true;
    }

    /**
     * Select a component (visual feedback)
     */
    selectComponent(componentId) {
        d3.select(`#${componentId}`)
            .select('rect')
            .attr('stroke-width', 3);
    }

    /**
     * Deselect a component (remove visual feedback)
     */
    deselectComponent(componentId) {
        d3.select(`#${componentId}`)
            .select('rect')
            .attr('stroke-width', 2);
    }

    /**
     * Get component bounds
     */
    getComponentBounds(componentId) {
        const element = d3.select(`#${componentId}`);
        if (element.empty()) return null;

        const bounds = element.node().getBBox();
        const transform = element.attr('transform');
        const [x, y] = this.parseTransform(transform);

        return {
            x: x,
            y: y,
            width: bounds.width,
            height: bounds.height
        };
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
     * Update component position
     */
    updateComponentPosition(componentId, x, y) {
        d3.select(`#${componentId}`)
            .attr('transform', `translate(${x},${y})`);
    }

    /**
     * Validate component structure
     */
    validateComponent(component) {
        const errors = [];

        if (!component.id) errors.push('Component must have an id');
        if (!component.type) errors.push('Component must have a type');
        if (!component.name) errors.push('Component must have a name');
        if (typeof component.x !== 'number') errors.push('Component must have numeric x coordinate');
        if (typeof component.y !== 'number') errors.push('Component must have numeric y coordinate');
        if (!Array.isArray(component.inputs)) errors.push('Component must have inputs array');
        if (!Array.isArray(component.outputs)) errors.push('Component must have outputs array');

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}
