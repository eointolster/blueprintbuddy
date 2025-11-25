import sys
from app import create_app

try:
    app = create_app()
except Exception as e:
    print(f"FATAL ERROR: Failed to create app: {e}", file=sys.stderr)
    sys.exit(1)

if __name__ == '__main__':
    try:
        # Use socketio.run instead of app.run for WebSocket support
        if not hasattr(app, 'socketio'):
            print("ERROR: SocketIO not initialized on app. Check app/__init__.py", file=sys.stderr)
            sys.exit(1)

        socketio = app.socketio
        print("Starting BlueprintBuddy server on http://0.0.0.0:5000")
        socketio.run(app, debug=True, host='0.0.0.0', port=5000)
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")
        sys.exit(0)
    except Exception as e:
        print(f"FATAL ERROR: Server failed to start: {e}", file=sys.stderr)
        sys.exit(1)