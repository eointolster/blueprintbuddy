"""
API Routes for BlueprintBuddy
Handles REST API endpoints for blueprints, AI, and components
"""

from flask import Blueprint, request, jsonify, current_app
from app.services.ai_service import get_ai_service
from app.services.file_service import get_file_service
from app.services.component_service import get_component_service
from app.services.code_map_service import get_code_map_service
from functools import wraps
import traceback

bp = Blueprint('api', __name__, url_prefix='/api')


def handle_errors(f):
    """Decorator to handle errors in API endpoints"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            current_app.logger.error(f"API error in {f.__name__}: {e}")
            current_app.logger.error(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    return decorated_function


# ============================================================================
# Blueprint/Diagram Endpoints
# ============================================================================

@bp.route('/blueprints', methods=['GET'])
@handle_errors
def list_blueprints():
    """List all saved blueprints"""
    file_service = get_file_service()
    result = file_service.list_blueprints()

    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 500


@bp.route('/blueprints', methods=['POST'])
@handle_errors
def save_blueprint():
    """Save a blueprint"""
    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'No data provided'
        }), 400

    file_service = get_file_service()
    filename = data.get('filename')
    blueprint_data = data.get('blueprint')

    if not blueprint_data:
        return jsonify({
            'success': False,
            'error': 'No blueprint data provided'
        }), 400

    result = file_service.save_blueprint(blueprint_data, filename)

    if result['success']:
        return jsonify(result), 201
    else:
        return jsonify(result), 500


@bp.route('/blueprints/<filename>', methods=['GET'])
@handle_errors
def load_blueprint(filename):
    """Load a specific blueprint"""
    file_service = get_file_service()
    result = file_service.load_blueprint(filename)

    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 404 if 'not found' in result.get('error', '').lower() else 500


@bp.route('/blueprints/<filename>', methods=['DELETE'])
@handle_errors
def delete_blueprint(filename):
    """Delete a blueprint"""
    file_service = get_file_service()
    result = file_service.delete_blueprint(filename)

    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 404 if 'not found' in result.get('error', '').lower() else 500


# ============================================================================
# AI Endpoints
# ============================================================================

@bp.route('/ai/chat', methods=['POST'])
@handle_errors
def ai_chat():
    """Chat with AI assistant"""
    data = request.get_json()

    if not data or 'message' not in data:
        return jsonify({
            'success': False,
            'error': 'No message provided'
        }), 400

    message = data['message']
    context = data.get('context')

    ai_service = get_ai_service()
    result = ai_service.chat(message, context)

    if result.get('error'):
        return jsonify(result), 500
    else:
        return jsonify(result), 200


@bp.route('/ai/analyze', methods=['POST'])
@handle_errors
def analyze_diagram():
    """Analyze a diagram with AI"""
    data = request.get_json()

    if not data or 'diagram' not in data:
        return jsonify({
            'success': False,
            'error': 'No diagram data provided'
        }), 400

    ai_service = get_ai_service()
    result = ai_service.analyze_diagram(data['diagram'])

    if result.get('error'):
        return jsonify(result), 500
    else:
        return jsonify(result), 200


@bp.route('/ai/suggest-connections', methods=['POST'])
@handle_errors
def suggest_connections():
    """Get AI suggestions for connections"""
    data = request.get_json()

    if not data or 'diagram' not in data:
        return jsonify({
            'success': False,
            'error': 'No diagram data provided'
        }), 400

    ai_service = get_ai_service()
    result = ai_service.suggest_connections(data['diagram'])

    if result.get('error'):
        return jsonify(result), 500
    else:
        return jsonify(result), 200


@bp.route('/ai/generate-code', methods=['POST'])
@handle_errors
def generate_code():
    """Generate code for a component"""
    data = request.get_json()

    if not data or 'component' not in data:
        return jsonify({
            'success': False,
            'error': 'No component data provided'
        }), 400

    component = data['component']
    language = data.get('language', 'python')

    ai_service = get_ai_service()
    result = ai_service.generate_code(component, language)

    if result.get('error'):
        return jsonify(result), 500
    else:
        return jsonify(result), 200


# ============================================================================
# Component Endpoints
# ============================================================================

@bp.route('/components/create', methods=['POST'])
@handle_errors
def create_component():
    """Create a new component"""
    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'No data provided'
        }), 400

    component_type = data.get('type', 'function')
    x = data.get('x', 0)
    y = data.get('y', 0)
    name = data.get('name')

    component_service = get_component_service()
    result = component_service.create_component(component_type, x, y, name)

    if result['success']:
        return jsonify(result), 201
    else:
        return jsonify(result), 400


@bp.route('/components/validate', methods=['POST'])
@handle_errors
def validate_component():
    """Validate a component"""
    data = request.get_json()

    if not data or 'component' not in data:
        return jsonify({
            'success': False,
            'error': 'No component data provided'
        }), 400

    component_service = get_component_service()
    result = component_service.validate_component(data['component'])

    return jsonify(result), 200


@bp.route('/components/stats', methods=['POST'])
@handle_errors
def component_stats():
    """Get component statistics"""
    data = request.get_json()

    if not data or 'components' not in data:
        return jsonify({
            'success': False,
            'error': 'No components data provided'
        }), 400

    component_service = get_component_service()
    stats = component_service.get_component_stats(data['components'])

    return jsonify(stats), 200


@bp.route('/connections/validate', methods=['POST'])
@handle_errors
def validate_connection():
    """Validate a connection"""
    data = request.get_json()

    if not data or 'connection' not in data or 'components' not in data:
        return jsonify({
            'success': False,
            'error': 'Missing connection or components data'
        }), 400

    component_service = get_component_service()
    result = component_service.validate_connection(
        data['components'],
        data['connection']
    )

    return jsonify(result), 200


# ============================================================================
# Export Endpoints
# ============================================================================

@bp.route('/export/svg', methods=['POST'])
@handle_errors
def export_svg():
    """Export diagram as SVG"""
    data = request.get_json()

    if not data or 'svg' not in data:
        return jsonify({
            'success': False,
            'error': 'No SVG data provided'
        }), 400

    filename = data.get('filename')
    svg_content = data['svg']

    file_service = get_file_service()
    result = file_service.export_svg(svg_content, filename)

    if result['success']:
        return jsonify(result), 201
    else:
        return jsonify(result), 500


# ============================================================================
# Code Mapping (visualize codebase)
# ============================================================================

@bp.route('/code/map', methods=['POST'])
@handle_errors
def map_codebase():
    """Generate a blueprint from a Python codebase"""
    data = request.get_json() or {}
    root_subpath = data.get('path', '.')
    max_files = data.get('max_files')

    code_map_service = get_code_map_service()
    result = code_map_service.map_codebase(root_subpath, max_files=max_files)

    status = 200 if result.get('success') else 400
    return jsonify(result), status


@bp.route('/code/map-file', methods=['POST'])
@handle_errors
def map_code_file():
    """Generate a blueprint from a single Python file"""
    data = request.get_json() or {}
    file_path = data.get('path')
    if not file_path:
        return jsonify({"success": False, "error": "No file path provided"}), 400

    code_map_service = get_code_map_service()
    result = code_map_service.map_file(file_path)

    status = 200 if result.get('success') else 400
    return jsonify(result), status


@bp.route('/blueprints/generate', methods=['POST'])
@handle_errors
def generate_blueprint_from_prompt():
    """Generate a blueprint from a natural-language prompt"""
    data = request.get_json() or {}
    prompt = data.get('prompt')
    base_blueprint = data.get('blueprint')
    if not prompt:
        return jsonify({"success": False, "error": "Prompt is required"}), 400

    code_map_service = get_code_map_service()
    result = code_map_service.generate_from_prompt(prompt, base_blueprint=base_blueprint)
    status = 200 if result.get('success') else 400
    return jsonify(result), status


# ============================================================================
# Health Check
# ============================================================================

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'version': '1.0',
        'services': {
            'ai': current_app.config.get('ANTHROPIC_API_KEY') is not None,
            'file_storage': True
        }
    }), 200
