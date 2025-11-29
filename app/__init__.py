from flask import Flask
from flask_cors import CORS
from flask_login import LoginManager
from config import Config
import os


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Enable CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": app.config.get('CORS_ORIGINS', ['http://localhost:5000'])
        },
        r"/auth/*": {
            "origins": app.config.get('CORS_ORIGINS', ['http://localhost:5000']),
            "supports_credentials": True
        }
    })

    # Initialize database
    from app.models import db, User
    db.init_app(app)

    # Initialize login manager
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Create upload folder if it doesn't exist
    upload_folder = app.config.get('UPLOAD_FOLDER')
    if upload_folder and not os.path.exists(upload_folder):
        os.makedirs(upload_folder, exist_ok=True)

    # Initialize WebSocket
    from app.websocket import init_socketio
    socketio = init_socketio(app)
    app.socketio = socketio

    # Initialize services
    with app.app_context():
        from app.services.file_service import get_file_service
        from app.services.ai_service import get_ai_service
        from app.services.code_map_service import get_code_map_service

        # Create database tables
        db.create_all()

        file_service = get_file_service()
        file_service.initialize()

        ai_service = get_ai_service()
        # AI service initializes in its constructor

        code_map_service = get_code_map_service()
        code_map_service.initialize()

    # Register blueprints
    from app.routes import main, api, auth
    app.register_blueprint(main.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(auth.bp)

    # Register error handlers
    register_error_handlers(app)

    return app


def register_error_handlers(app):
    """Register error handlers"""

    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"Internal error: {error}")
        return {'error': 'Internal server error'}, 500

    @app.errorhandler(413)
    def request_entity_too_large(error):
        return {'error': 'File too large'}, 413
