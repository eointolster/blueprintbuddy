"""
Component Service for BlueprintBuddy
Handles component management, validation, and operations
"""

from typing import Dict, List, Optional, Any
from flask import current_app
import uuid


class ComponentService:
    """Service for managing diagram components"""

    COMPONENT_TYPES = {
        'function': {
            'color': 'rgba(13, 71, 161, 0.6)',
            'borderColor': '#29b6f6',
            'defaultPorts': {
                'inputs': [{'name': 'input1', 'type': 'any'}],
                'outputs': [{'name': 'output1', 'type': 'any'}]
            }
        },
        'class': {
            'color': 'rgba(56, 142, 60, 0.6)',
            'borderColor': '#66bb6a',
            'defaultPorts': {
                'inputs': [{'name': 'constructor', 'type': 'any'}],
                'outputs': [{'name': 'instance', 'type': 'object'}]
            }
        },
        'module': {
            'color': 'rgba(136, 14, 79, 0.6)',
            'borderColor': '#ec407a',
            'defaultPorts': {
                'inputs': [{'name': 'import', 'type': 'any'}],
                'outputs': [{'name': 'export', 'type': 'any'}]
            }
        }
    }

    def create_component(self, component_type: str, x: float, y: float,
                        name: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new component

        Args:
            component_type: Type of component (function, class, module)
            x: X coordinate
            y: Y coordinate
            name: Optional component name

        Returns:
            Dict containing component data
        """
        try:
            if component_type not in self.COMPONENT_TYPES:
                return {
                    'success': False,
                    'error': f'Invalid component type: {component_type}'
                }

            type_config = self.COMPONENT_TYPES[component_type]
            component_id = str(uuid.uuid4())

            component = {
                'id': component_id,
                'type': component_type,
                'name': name or f'New {component_type}',
                'x': x,
                'y': y,
                'width': 200,
                'height': 100,
                'inputs': [
                    {**port, 'id': str(uuid.uuid4())}
                    for port in type_config['defaultPorts']['inputs']
                ],
                'outputs': [
                    {**port, 'id': str(uuid.uuid4())}
                    for port in type_config['defaultPorts']['outputs']
                ],
                'description': '',
                'metadata': {}
            }

            return {
                'success': True,
                'component': component
            }

        except Exception as e:
            current_app.logger.error(f"Error creating component: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def validate_component(self, component: Dict) -> Dict[str, Any]:
        """
        Validate a component's structure

        Args:
            component: Component data to validate

        Returns:
            Dict containing validation result
        """
        errors = []

        # Check required fields
        required_fields = ['id', 'type', 'name', 'x', 'y']
        for field in required_fields:
            if field not in component:
                errors.append(f"Missing required field: {field}")

        # Check type is valid
        if 'type' in component and component['type'] not in self.COMPONENT_TYPES:
            errors.append(f"Invalid component type: {component['type']}")

        # Check inputs/outputs are lists
        if 'inputs' in component and not isinstance(component['inputs'], list):
            errors.append("Inputs must be a list")

        if 'outputs' in component and not isinstance(component['outputs'], list):
            errors.append("Outputs must be a list")

        # Validate ports
        for port_type in ['inputs', 'outputs']:
            if port_type in component:
                for i, port in enumerate(component[port_type]):
                    if not isinstance(port, dict):
                        errors.append(f"{port_type}[{i}] must be an object")
                    elif 'name' not in port:
                        errors.append(f"{port_type}[{i}] missing 'name' field")

        return {
            'valid': len(errors) == 0,
            'errors': errors
        }

    def add_port(self, component: Dict, port_type: str,
                port_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Add a port to a component

        Args:
            component: Component to modify
            port_type: 'inputs' or 'outputs'
            port_name: Optional port name

        Returns:
            Dict containing updated component
        """
        try:
            if port_type not in ['inputs', 'outputs']:
                return {
                    'success': False,
                    'error': 'Invalid port type. Must be "inputs" or "outputs"'
                }

            if port_type not in component:
                component[port_type] = []

            port_count = len(component[port_type])
            port_label = 'input' if port_type == 'inputs' else 'output'

            new_port = {
                'id': str(uuid.uuid4()),
                'name': port_name or f'{port_label}{port_count + 1}',
                'type': 'any'
            }

            component[port_type].append(new_port)

            # Adjust component height based on port count
            max_ports = max(len(component.get('inputs', [])),
                          len(component.get('outputs', [])))
            component['height'] = max(100, 25 + (max_ports + 1) * 30)

            return {
                'success': True,
                'component': component,
                'port': new_port
            }

        except Exception as e:
            current_app.logger.error(f"Error adding port: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def remove_port(self, component: Dict, port_id: str) -> Dict[str, Any]:
        """
        Remove a port from a component

        Args:
            component: Component to modify
            port_id: ID of port to remove

        Returns:
            Dict containing updated component
        """
        try:
            port_removed = False

            for port_type in ['inputs', 'outputs']:
                if port_type in component:
                    original_length = len(component[port_type])
                    component[port_type] = [
                        p for p in component[port_type] if p.get('id') != port_id
                    ]
                    if len(component[port_type]) < original_length:
                        port_removed = True
                        break

            if not port_removed:
                return {
                    'success': False,
                    'error': 'Port not found'
                }

            # Adjust component height
            max_ports = max(len(component.get('inputs', [])),
                          len(component.get('outputs', [])))
            component['height'] = max(100, 25 + (max_ports + 1) * 30)

            return {
                'success': True,
                'component': component,
                'port_id': port_id
            }

        except Exception as e:
            current_app.logger.error(f"Error removing port: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def validate_connection(self, components: List[Dict], connection: Dict) -> Dict[str, Any]:
        """
        Validate a connection between ports

        Args:
            components: List of all components
            connection: Connection data with 'from' and 'to' fields

        Returns:
            Dict containing validation result
        """
        try:
            # Parse connection format: "componentId-portId"
            from_str = connection.get('from', '')
            to_str = connection.get('to', '')

            if not from_str or not to_str:
                return {
                    'valid': False,
                    'error': 'Invalid connection format'
                }

            # Extract component and port IDs
            # Format is either "componentId-portId" or could have multiple hyphens
            # We need to find the component ID first, then the rest is the port ID
            from_parts = from_str.split('-')
            to_parts = to_str.split('-')

            # Find source component by trying to match the beginning of the string
            source_component = None
            source_port_id = None
            for c in components:
                if from_str.startswith(c['id'] + '-'):
                    source_component = c
                    source_port_id = from_str[len(c['id']) + 1:]  # +1 for the hyphen
                    break

            # Find target component
            target_component = None
            target_port_id = None
            for c in components:
                if to_str.startswith(c['id'] + '-'):
                    target_component = c
                    target_port_id = to_str[len(c['id']) + 1:]  # +1 for the hyphen
                    break

            if not source_component:
                return {
                    'valid': False,
                    'error': 'Source component not found'
                }

            if not target_component:
                return {
                    'valid': False,
                    'error': 'Target component not found'
                }

            # Find source and target ports
            source_port = next(
                (p for p in source_component.get('outputs', [])
                 if p['id'] == source_port_id),
                None
            )
            target_port = next(
                (p for p in target_component.get('inputs', [])
                 if p['id'] == target_port_id),
                None
            )

            if not source_port:
                return {
                    'valid': False,
                    'error': 'Source port not found'
                }

            if not target_port:
                return {
                    'valid': False,
                    'error': 'Target port not found'
                }

            # Check type compatibility (if types are specified)
            source_type = source_port.get('type', 'any')
            target_type = target_port.get('type', 'any')

            if source_type != 'any' and target_type != 'any' and source_type != target_type:
                return {
                    'valid': True,  # Warning, not error
                    'warning': f'Type mismatch: {source_type} -> {target_type}'
                }

            return {
                'valid': True,
                'error': None
            }

        except Exception as e:
            current_app.logger.error(f"Error validating connection: {e}")
            return {
                'valid': False,
                'error': str(e)
            }

    def get_component_stats(self, components: List[Dict]) -> Dict[str, Any]:
        """
        Get statistics about components

        Args:
            components: List of components

        Returns:
            Dict containing statistics
        """
        stats = {
            'total': len(components),
            'by_type': {},
            'total_ports': {
                'inputs': 0,
                'outputs': 0
            }
        }

        for component in components:
            comp_type = component.get('type', 'unknown')
            stats['by_type'][comp_type] = stats['by_type'].get(comp_type, 0) + 1

            stats['total_ports']['inputs'] += len(component.get('inputs', []))
            stats['total_ports']['outputs'] += len(component.get('outputs', []))

        return stats


# Global instance
component_service = ComponentService()


def get_component_service() -> ComponentService:
    """Get the global component service instance"""
    return component_service
