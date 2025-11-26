/**
 * UIManager - Handles UI interactions (context menu, keyboard shortcuts, selection, zoom)
 */
class UIManager {
    constructor(svg, overlayGroup) {
        this.svg = svg;
        this.overlayGroup = overlayGroup;
        this.contextMenu = null;
        this.selectionRect = null;
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectedComponents = new Set();
        this.zoom = null;
        this.currentScale = 1;
        this.currentTranslate = [0, 0];

        // Callbacks
        this.onContextMenuAction = null;
        this.onSelectionChange = null;
        this.onKeyboardAction = null;

        // Store event handlers for cleanup
        this.eventHandlers = {
            documentClick: null,
            keydown: null
        };
    }

    /**
     * Set up context menu
     */
    setupContextMenu() {
        this.contextMenu = d3.select('body')
            .append('div')
            .attr('class', 'blueprint-context-menu')
            .style('display', 'none');

        // Hide context menu on click elsewhere
        this.eventHandlers.documentClick = () => {
            this.hideContextMenu();
        };
        document.addEventListener('click', this.eventHandlers.documentClick);

        // Right-click handler
        this.svg.on('contextmenu', (event) => {
            event.preventDefault();
            const [x, y] = d3.pointer(event);
            this.showContextMenu(event, x, y);
        });
    }

    /**
     * Show context menu
     */
    showContextMenu(event, x, y) {
        const target = event.target.closest('.component');
        const menuItems = [];

        if (target) {
            // Component context menu
            const componentId = d3.select(target).attr('id');
            menuItems.push(
                { label: 'Rename', action: () => this.triggerAction('rename', componentId) },
                { label: 'Add Input Port', action: () => this.triggerAction('addInputPort', componentId) },
                { label: 'Add Output Port', action: () => this.triggerAction('addOutputPort', componentId) },
                { label: 'Delete Component', action: () => this.triggerAction('deleteComponent', componentId) },
                { label: 'Duplicate', action: () => this.triggerAction('duplicateComponent', componentId) }
            );
        } else {
            // Canvas context menu - create new components
            menuItems.push(
                { label: 'Create Function', action: () => this.triggerAction('createComponent', { x, y, type: 'function' }) },
                { label: 'Create Class', action: () => this.triggerAction('createComponent', { x, y, type: 'class' }) },
                { label: 'Create Module', action: () => this.triggerAction('createComponent', { x, y, type: 'module' }) }
            );
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
                    this.hideContextMenu();
                });
        });
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style('display', 'none');
        }
    }

    /**
     * Trigger context menu action
     */
    triggerAction(action, data) {
        if (this.onContextMenuAction) {
            this.onContextMenuAction(action, data);
        }
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        this.eventHandlers.keydown = (event) => {
            if (event.ctrlKey || event.metaKey) {
                let action = null;
                let preventDefault = false;

                switch (event.key.toLowerCase()) {
                    case 'c':
                        action = 'copy';
                        break;
                    case 'v':
                        action = 'paste';
                        break;
                    case 'x':
                        action = 'cut';
                        break;
                    case 'z':
                        action = event.shiftKey ? 'redo' : 'undo';
                        break;
                    case 'd':
                        action = 'duplicate';
                        preventDefault = true;
                        break;
                    case 'a':
                        action = 'selectAll';
                        preventDefault = true;
                        break;
                    case 's':
                        action = 'save';
                        preventDefault = true;
                        break;
                }

                if (action && this.onKeyboardAction) {
                    if (preventDefault) {
                        event.preventDefault();
                    }
                    this.onKeyboardAction(action);
                }
            } else if (event.key === 'Delete' || event.key === 'Backspace') {
                if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                    event.preventDefault();
                    if (this.onKeyboardAction) {
                        this.onKeyboardAction('delete');
                    }
                }
            } else if (event.key === 'Escape') {
                this.clearSelection();
            }
        };
        document.addEventListener('keydown', this.eventHandlers.keydown);
    }

    /**
     * Set up selection box (drag to select multiple components)
     */
    setupSelectionBox() {
        this.svg.on('mousedown', (event) => {
            // Only start selection on SVG background or grid
            if (event.target.tagName === 'svg' ||
                event.target.classList.contains('grid-layer') ||
                event.target.closest('.grid-layer')) {
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

        this.svg.on('mousemove', (event) => {
            if (this.isSelecting && this.selectionRect) {
                this.updateSelectionBox(event);
            }
        });

        this.svg.on('mouseup', (event) => {
            if (this.isSelecting) {
                this.isSelecting = false;
                if (this.selectionRect) {
                    const box = this.selectionRect.node().getBBox();
                    this.selectComponentsInBox(box, event.shiftKey);
                    this.selectionRect.remove();
                    this.selectionRect = null;
                }
            }
        });
    }

    /**
     * Update selection box as mouse moves
     */
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

    /**
     * Select components within a box
     */
    selectComponentsInBox(box, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }

        const mainGroup = this.svg.select('.main-group');
        mainGroup.selectAll('.component').each((d, i, nodes) => {
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

            // Check if component intersects with selection box
            if (x + bounds.x < box.x + box.width &&
                x + bounds.x + bounds.width > box.x &&
                y + bounds.y < box.y + box.height &&
                y + bounds.y + bounds.height > box.y) {
                this.selectComponent(node.id);
            }
        });
    }

    /**
     * Select a component
     */
    selectComponent(componentId, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }

        this.selectedComponents.add(componentId);
        d3.select(`#${componentId}`)
            .select('rect')
            .attr('stroke-width', 3);

        if (this.onSelectionChange) {
            this.onSelectionChange(Array.from(this.selectedComponents));
        }
    }

    /**
     * Deselect a component
     */
    deselectComponent(componentId) {
        this.selectedComponents.delete(componentId);
        d3.select(`#${componentId}`)
            .select('rect')
            .attr('stroke-width', 2);

        if (this.onSelectionChange) {
            this.onSelectionChange(Array.from(this.selectedComponents));
        }
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        this.selectedComponents.forEach(componentId => {
            d3.select(`#${componentId}`)
                .select('rect')
                .attr('stroke-width', 2);
        });
        this.selectedComponents.clear();

        if (this.onSelectionChange) {
            this.onSelectionChange([]);
        }
    }

    /**
     * Get selected components
     */
    getSelectedComponents() {
        return Array.from(this.selectedComponents);
    }

    /**
     * Select all components
     */
    selectAll() {
        const mainGroup = this.svg.select('.main-group');
        mainGroup.selectAll('.component').each((d, i, nodes) => {
            const componentId = d3.select(nodes[i]).attr('id');
            this.selectComponent(componentId, true);
        });
    }

    /**
     * Set up zoom and pan
     */
    setupZoom(onZoom) {
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.currentScale = event.transform.k;
                this.currentTranslate = [event.transform.x, event.transform.y];

                // Apply zoom to main group and connection layer
                const mainGroup = this.svg.select('.main-group');
                const connectionLayer = this.svg.select('.connection-layer');

                mainGroup.attr('transform', event.transform);
                connectionLayer.attr('transform', event.transform);

                if (onZoom) {
                    onZoom(event.transform);
                }
            });

        this.svg.call(this.zoom);
    }

    /**
     * Reset zoom
     */
    resetZoom() {
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, d3.zoomIdentity);
    }

    /**
     * Zoom to fit all components
     */
    zoomToFit(components) {
        if (!components || components.length === 0) return;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        components.forEach(comp => {
            minX = Math.min(minX, comp.x);
            minY = Math.min(minY, comp.y);
            maxX = Math.max(maxX, comp.x + comp.width);
            maxY = Math.max(maxY, comp.y + comp.height);
        });

        const padding = 50;
        const width = maxX - minX + 2 * padding;
        const height = maxY - minY + 2 * padding;

        const svgWidth = parseInt(this.svg.attr('width'));
        const svgHeight = parseInt(this.svg.attr('height'));

        const scale = Math.min(svgWidth / width, svgHeight / height, 1);
        const translateX = (svgWidth - scale * (minX + maxX)) / 2;
        const translateY = (svgHeight - scale * (minY + maxY)) / 2;

        const transform = d3.zoomIdentity
            .translate(translateX, translateY)
            .scale(scale);

        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, transform);
    }

    /**
     * Clean up
     */
    destroy() {
        // Remove context menu
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }

        // Remove document event listeners
        if (this.eventHandlers.documentClick) {
            document.removeEventListener('click', this.eventHandlers.documentClick);
            this.eventHandlers.documentClick = null;
        }
        if (this.eventHandlers.keydown) {
            document.removeEventListener('keydown', this.eventHandlers.keydown);
            this.eventHandlers.keydown = null;
        }

        // Remove SVG event listeners
        if (this.svg) {
            this.svg.on('contextmenu', null);
            this.svg.on('mousedown', null);
            this.svg.on('mousemove', null);
            this.svg.on('mouseup', null);
        }

        // Remove zoom behavior
        if (this.zoom && this.svg) {
            this.svg.on('.zoom', null);
        }

        // Clear selection rect if exists
        if (this.selectionRect) {
            this.selectionRect.remove();
            this.selectionRect = null;
        }

        // Clear references
        this.selectedComponents.clear();
        this.onContextMenuAction = null;
        this.onSelectionChange = null;
        this.onKeyboardAction = null;
    }
}
