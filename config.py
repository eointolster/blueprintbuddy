import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change-in-production'
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'

    # Anthropic Claude AI
    ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///blueprintbuddy.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Session
    SESSION_TYPE = os.environ.get('SESSION_TYPE', 'filesystem')
    PERMANENT_SESSION_LIFETIME = int(os.environ.get('PERMANENT_SESSION_LIFETIME', 3600))

    # WebSocket
    WEBSOCKET_PORT = int(os.environ.get('WEBSOCKET_PORT', 5001))

    # CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:5000').split(',')

    # File Upload
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    ALLOWED_EXTENSIONS = {'json', 'svg', 'png'}

    # Code mapping
    CODEBASE_ROOT = os.environ.get('CODEBASE_ROOT', os.getcwd())
    CODEMAP_MAX_FILES = int(os.environ.get('CODEMAP_MAX_FILES', 200))
    CODEMAP_EXCLUDE_DIRS = os.environ.get('CODEMAP_EXCLUDE_DIRS', 'venv,.venv,__pycache__,.git,node_modules').split(',')

class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    DEBUG = False
    TESTING = False

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///test_blueprintbuddy.db'

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
