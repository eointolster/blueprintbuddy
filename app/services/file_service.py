"""
File Service for BlueprintBuddy
Handles saving, loading, and managing blueprint files
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from flask import current_app
from werkzeug.utils import secure_filename


class FileService:
    """Service for file operations on blueprints"""

    def __init__(self):
        self.upload_folder = None

    def initialize(self):
        """Initialize the file service with app config"""
        self.upload_folder = current_app.config.get('UPLOAD_FOLDER')
        if self.upload_folder and not os.path.exists(self.upload_folder):
            os.makedirs(self.upload_folder, exist_ok=True)

    def allowed_file(self, filename: str) -> bool:
        """Check if file extension is allowed"""
        allowed_extensions = current_app.config.get('ALLOWED_EXTENSIONS', {'json'})
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in allowed_extensions

    def save_blueprint(self, blueprint_data: Dict, filename: Optional[str] = None,
                      user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Save a blueprint to disk

        Args:
            blueprint_data: The blueprint data to save
            filename: Optional filename (will be auto-generated if not provided)
            user_id: Optional user ID for organizing files

        Returns:
            Dict containing save result
        """
        try:
            # Validate blueprint data
            if not self._validate_blueprint(blueprint_data):
                return {
                    'success': False,
                    'error': 'Invalid blueprint data'
                }

            # Generate filename if not provided
            if not filename:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f'blueprint_{timestamp}.json'
            else:
                filename = secure_filename(filename)
                if not filename.endswith('.json'):
                    filename += '.json'

            # Create user directory if user_id provided
            if user_id:
                user_folder = os.path.join(self.upload_folder, secure_filename(user_id))
                os.makedirs(user_folder, exist_ok=True)
                filepath = os.path.join(user_folder, filename)
            else:
                filepath = os.path.join(self.upload_folder, filename)

            # Add metadata
            blueprint_data['metadata'] = {
                **blueprint_data.get('metadata', {}),
                'saved_at': datetime.now().isoformat(),
                'version': '1.0'
            }

            # Save to file
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(blueprint_data, f, indent=2, ensure_ascii=False)

            current_app.logger.info(f"Blueprint saved: {filepath}")

            return {
                'success': True,
                'filename': filename,
                'filepath': filepath,
                'size': os.path.getsize(filepath)
            }

        except Exception as e:
            current_app.logger.error(f"Error saving blueprint: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def load_blueprint(self, filename: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Load a blueprint from disk

        Args:
            filename: Name of the file to load
            user_id: Optional user ID for file location

        Returns:
            Dict containing blueprint data or error
        """
        try:
            filename = secure_filename(filename)

            # Determine filepath
            if user_id:
                user_folder = os.path.join(self.upload_folder, secure_filename(user_id))
                filepath = os.path.join(user_folder, filename)
            else:
                filepath = os.path.join(self.upload_folder, filename)

            # Check if file exists
            if not os.path.exists(filepath):
                return {
                    'success': False,
                    'error': 'File not found'
                }

            # Load blueprint
            with open(filepath, 'r', encoding='utf-8') as f:
                blueprint_data = json.load(f)

            # Validate loaded data
            if not self._validate_blueprint(blueprint_data):
                return {
                    'success': False,
                    'error': 'Invalid blueprint file format'
                }

            current_app.logger.info(f"Blueprint loaded: {filepath}")

            return {
                'success': True,
                'data': blueprint_data,
                'filename': filename
            }

        except json.JSONDecodeError as e:
            current_app.logger.error(f"Invalid JSON in blueprint file: {e}")
            return {
                'success': False,
                'error': 'Invalid JSON format'
            }
        except Exception as e:
            current_app.logger.error(f"Error loading blueprint: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def list_blueprints(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        List all available blueprints

        Args:
            user_id: Optional user ID to filter blueprints

        Returns:
            Dict containing list of blueprints
        """
        try:
            if user_id:
                user_folder = os.path.join(self.upload_folder, secure_filename(user_id))
                search_folder = user_folder if os.path.exists(user_folder) else None
            else:
                search_folder = self.upload_folder

            if not search_folder or not os.path.exists(search_folder):
                return {
                    'success': True,
                    'blueprints': []
                }

            blueprints = []
            for filename in os.listdir(search_folder):
                if filename.endswith('.json'):
                    filepath = os.path.join(search_folder, filename)
                    stat = os.stat(filepath)

                    # Try to load metadata
                    metadata = None
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            metadata = data.get('metadata', {})
                    except:
                        pass

                    blueprints.append({
                        'filename': filename,
                        'size': stat.st_size,
                        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'metadata': metadata
                    })

            # Sort by modification time (newest first)
            blueprints.sort(key=lambda x: x['modified'], reverse=True)

            return {
                'success': True,
                'blueprints': blueprints
            }

        except Exception as e:
            current_app.logger.error(f"Error listing blueprints: {e}")
            return {
                'success': False,
                'error': str(e),
                'blueprints': []
            }

    def delete_blueprint(self, filename: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Delete a blueprint file

        Args:
            filename: Name of the file to delete
            user_id: Optional user ID for file location

        Returns:
            Dict containing deletion result
        """
        try:
            filename = secure_filename(filename)

            # Determine filepath
            if user_id:
                user_folder = os.path.join(self.upload_folder, secure_filename(user_id))
                filepath = os.path.join(user_folder, filename)
            else:
                filepath = os.path.join(self.upload_folder, filename)

            # Check if file exists
            if not os.path.exists(filepath):
                return {
                    'success': False,
                    'error': 'File not found'
                }

            # Delete file
            os.remove(filepath)
            current_app.logger.info(f"Blueprint deleted: {filepath}")

            return {
                'success': True,
                'filename': filename
            }

        except Exception as e:
            current_app.logger.error(f"Error deleting blueprint: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def export_svg(self, svg_content: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Export diagram as SVG file

        Args:
            svg_content: SVG content as string
            filename: Optional filename

        Returns:
            Dict containing export result
        """
        try:
            if not filename:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f'blueprint_{timestamp}.svg'
            else:
                filename = secure_filename(filename)
                if not filename.endswith('.svg'):
                    filename += '.svg'

            filepath = os.path.join(self.upload_folder, filename)

            # Save SVG
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(svg_content)

            current_app.logger.info(f"SVG exported: {filepath}")

            return {
                'success': True,
                'filename': filename,
                'filepath': filepath
            }

        except Exception as e:
            current_app.logger.error(f"Error exporting SVG: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _validate_blueprint(self, blueprint_data: Dict) -> bool:
        """
        Validate blueprint data structure

        Args:
            blueprint_data: Blueprint data to validate

        Returns:
            True if valid, False otherwise
        """
        try:
            # Check required fields
            if not isinstance(blueprint_data, dict):
                return False

            # Must have components and connections
            if 'components' not in blueprint_data or 'connections' not in blueprint_data:
                return False

            # Components must be a list
            if not isinstance(blueprint_data['components'], list):
                return False

            # Connections must be a list
            if not isinstance(blueprint_data['connections'], list):
                return False

            # Validate each component has required fields
            for component in blueprint_data['components']:
                if not all(key in component for key in ['id', 'type', 'name']):
                    return False

            return True

        except Exception as e:
            current_app.logger.error(f"Blueprint validation error: {e}")
            return False


# Global instance
file_service = FileService()


def get_file_service() -> FileService:
    """Get the global file service instance"""
    return file_service
