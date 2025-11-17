# BlueprintBuddy

A Visual AI-Assisted System Design Tool that combines interactive diagramming with Claude AI to help you design, understand, and generate software system architectures.

## Features

### Core Functionality
- **Interactive Canvas**: SVG-based diagram editor with drag-and-drop components
- **Component System**: Create functions, classes, and modules with customizable ports
- **Connection Management**: Visual spline connections between component ports
- **AI Integration**: Claude AI-powered assistance for diagram analysis and code generation
- **Real-time Collaboration**: WebSocket-based multi-user editing sessions
- **Save/Load System**: JSON-based blueprint persistence
- **User Authentication**: Secure user accounts and blueprint ownership

### Component Features
- Multiple component types (Function, Class, Module)
- Dynamic input/output port management
- Drag-and-drop positioning
- Double-click to rename
- Context menu operations
- Copy/paste functionality
- Undo/redo support

### AI Capabilities
- Natural language chat interface
- Diagram analysis and insights
- Connection suggestions
- Code generation from diagrams
- Architecture recommendations

## Technology Stack

### Frontend
- HTML5/CSS3
- JavaScript (ES6+)
- D3.js v7 for SVG manipulation
- Socket.IO for WebSocket communication

### Backend
- Python 3.11+
- Flask 3.0+ web framework
- Flask-SocketIO for real-time updates
- Flask-SQLAlchemy for database ORM
- Flask-Login for authentication
- Anthropic Claude AI API

## Installation

### Prerequisites
- Python 3.11 or higher
- pip package manager
- Virtual environment (recommended)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd blueprintbuddy
```

2. Create and activate virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your configuration
```

Required environment variables:
- `SECRET_KEY`: Flask secret key (generate a random string)
- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude AI
- `DATABASE_URL`: Database connection string (optional, defaults to SQLite)

5. Initialize the database:
```bash
# Database tables are created automatically on first run
python run.py
```

## Configuration

Configuration is managed through environment variables and `config.py`:

### Development
```bash
FLASK_ENV=development
FLASK_DEBUG=True
```

### Production
```bash
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=<strong-random-key>
```

## Running the Application

### Development Server
```bash
python run.py
```

The application will be available at `http://localhost:5000`

### Production
For production deployment, use a WSGI server like Gunicorn:

```bash
pip install gunicorn eventlet
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 "app:create_app()"
```

## API Documentation

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "user123",
  "password": "SecurePass123"
}
```

### Blueprint Endpoints

#### Save Blueprint
```http
POST /api/blueprints
Content-Type: application/json

{
  "blueprint": {
    "components": [...],
    "connections": [...]
  },
  "filename": "my_blueprint.json"
}
```

#### Load Blueprint
```http
GET /api/blueprints/<filename>
```

#### List Blueprints
```http
GET /api/blueprints
```

### AI Endpoints

#### Chat with AI
```http
POST /api/ai/chat
Content-Type: application/json

{
  "message": "How can I improve this architecture?",
  "context": {
    "diagram_data": {...}
  }
}
```

#### Analyze Diagram
```http
POST /api/ai/analyze
Content-Type: application/json

{
  "diagram": {
    "components": [...],
    "connections": [...]
  }
}
```

#### Generate Code
```http
POST /api/ai/generate-code
Content-Type: application/json

{
  "component": {...},
  "language": "python"
}
```

## WebSocket Events

### Connection
- `connect`: Client connects to server
- `disconnect`: Client disconnects
- `join_session`: Join a collaborative session
- `leave_session`: Leave a session

### Diagram Updates
- `component_added`: New component created
- `component_updated`: Component modified
- `component_deleted`: Component removed
- `connection_added`: New connection created
- `connection_deleted`: Connection removed

### Chat
- `chat_message`: User sends a message
- `ai_response`: AI responds to a message

## Testing

Run the test suite:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_api.py

# Run specific test
pytest tests/test_api.py::TestBlueprintAPI::test_health_check
```

Test files are located in the `tests/` directory:
- `test_api.py`: API endpoint tests
- `test_services.py`: Service layer tests

## Project Structure

```
blueprintbuddy/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── models/               # Database models
│   │   └── __init__.py       # User, Blueprint, Session models
│   ├── routes/               # Route handlers
│   │   ├── main.py           # Main routes
│   │   ├── api.py            # API routes
│   │   └── auth.py           # Authentication routes
│   ├── services/             # Business logic
│   │   ├── ai_service.py     # Claude AI integration
│   │   ├── component_service.py  # Component management
│   │   └── file_service.py   # File operations
│   ├── static/               # Static files
│   │   ├── css/              # Stylesheets
│   │   └── js/               # JavaScript files
│   ├── templates/            # HTML templates
│   └── websocket.py          # WebSocket handlers
├── tests/                    # Test suite
│   ├── __init__.py
│   ├── conftest.py           # Test fixtures
│   ├── test_api.py
│   └── test_services.py
├── config.py                 # Configuration
├── requirements.txt          # Python dependencies
├── run.py                    # Application entry point
├── pytest.ini                # Pytest configuration
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

## Development

### Code Quality

The project uses several tools for code quality:

- **Black**: Code formatting
- **Flake8**: Linting
- **MyPy**: Type checking
- **Pytest**: Testing

Run code quality checks:

```bash
# Format code
black app/ tests/

# Lint code
flake8 app/ tests/

# Type check
mypy app/
```

### Adding New Features

1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit pull request

## Known Issues and Future Improvements

### Immediate Improvements Needed
- [ ] **Refactor canvas.js** (3,545 lines) into modular components:
  - ComponentManager.js
  - ConnectionManager.js
  - PortManager.js
  - UIManager.js
  - StateManager.js

### Feature Enhancements
- [ ] Database migrations with Flask-Migrate
- [ ] Blueprint versioning and history
- [ ] Export diagrams to PNG/SVG
- [ ] Code generation for multiple languages
- [ ] Template library for common architectures
- [ ] Diagram validation and linting
- [ ] Auto-layout algorithms
- [ ] Plugin system for extensibility

### Performance Optimizations
- [ ] Component rendering optimization
- [ ] Connection path caching
- [ ] Virtual scrolling for large diagrams
- [ ] WebSocket message batching

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

[Add your license here]

## Support

For issues, questions, or suggestions:
- Create an issue on GitHub
- Contact the development team

## Acknowledgments

- Anthropic Claude AI for intelligent assistance
- D3.js for powerful SVG manipulation
- Flask community for excellent web framework
- All contributors and users

---

Built with ❤️ for developers who design visually
