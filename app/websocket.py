"""
WebSocket handler for BlueprintBuddy
Handles real-time communication between clients
"""

from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
from flask import request
import logging

logger = logging.getLogger(__name__)

# Initialize SocketIO
socketio = SocketIO(cors_allowed_origins="*")


# ============================================================================
# Connection Events
# ============================================================================

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'session_id': request.sid})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")


# ============================================================================
# Room/Session Management
# ============================================================================

@socketio.on('join_session')
def handle_join_session(data):
    """
    Join a collaborative session

    Data format:
    {
        'session_id': 'unique-session-id',
        'user_name': 'optional-user-name'
    }
    """
    session_id = data.get('session_id')
    user_name = data.get('user_name', 'Anonymous')

    if not session_id:
        emit('error', {'message': 'No session_id provided'})
        return

    join_room(session_id)
    logger.info(f"User {user_name} joined session {session_id}")

    # Notify others in the room
    emit('user_joined', {
        'user_name': user_name,
        'session_id': request.sid
    }, room=session_id, skip_sid=request.sid)

    # Send confirmation to joiner
    emit('joined_session', {
        'session_id': session_id,
        'message': f'Joined session {session_id}'
    })


@socketio.on('leave_session')
def handle_leave_session(data):
    """
    Leave a collaborative session

    Data format:
    {
        'session_id': 'unique-session-id'
    }
    """
    session_id = data.get('session_id')

    if not session_id:
        emit('error', {'message': 'No session_id provided'})
        return

    leave_room(session_id)
    logger.info(f"User left session {session_id}")

    # Notify others in the room
    emit('user_left', {
        'session_id': request.sid
    }, room=session_id)

    emit('left_session', {'session_id': session_id})


# ============================================================================
# Diagram Update Events
# ============================================================================

@socketio.on('component_added')
def handle_component_added(data):
    """
    Broadcast component addition to session members

    Data format:
    {
        'session_id': 'session-id',
        'component': {...component data...}
    }
    """
    session_id = data.get('session_id')
    component = data.get('component')

    if not session_id or not component:
        emit('error', {'message': 'Invalid data'})
        return

    # Broadcast to others in the session
    emit('component_added', {
        'component': component,
        'from_user': request.sid
    }, room=session_id, skip_sid=request.sid)


@socketio.on('component_updated')
def handle_component_updated(data):
    """
    Broadcast component update to session members

    Data format:
    {
        'session_id': 'session-id',
        'component_id': 'component-id',
        'updates': {...updated fields...}
    }
    """
    session_id = data.get('session_id')
    component_id = data.get('component_id')
    updates = data.get('updates')

    if not all([session_id, component_id, updates]):
        emit('error', {'message': 'Invalid data'})
        return

    emit('component_updated', {
        'component_id': component_id,
        'updates': updates,
        'from_user': request.sid
    }, room=session_id, skip_sid=request.sid)


@socketio.on('component_deleted')
def handle_component_deleted(data):
    """
    Broadcast component deletion to session members

    Data format:
    {
        'session_id': 'session-id',
        'component_id': 'component-id'
    }
    """
    session_id = data.get('session_id')
    component_id = data.get('component_id')

    if not session_id or not component_id:
        emit('error', {'message': 'Invalid data'})
        return

    emit('component_deleted', {
        'component_id': component_id,
        'from_user': request.sid
    }, room=session_id, skip_sid=request.sid)


@socketio.on('connection_added')
def handle_connection_added(data):
    """
    Broadcast connection addition to session members

    Data format:
    {
        'session_id': 'session-id',
        'connection': {...connection data...}
    }
    """
    session_id = data.get('session_id')
    connection = data.get('connection')

    if not session_id or not connection:
        emit('error', {'message': 'Invalid data'})
        return

    emit('connection_added', {
        'connection': connection,
        'from_user': request.sid
    }, room=session_id, skip_sid=request.sid)


@socketio.on('connection_deleted')
def handle_connection_deleted(data):
    """
    Broadcast connection deletion to session members

    Data format:
    {
        'session_id': 'session-id',
        'connection_id': 'connection-id'
    }
    """
    session_id = data.get('session_id')
    connection_id = data.get('connection_id')

    if not session_id or not connection_id:
        emit('error', {'message': 'Invalid data'})
        return

    emit('connection_deleted', {
        'connection_id': connection_id,
        'from_user': request.sid
    }, room=session_id, skip_sid=request.sid)


# ============================================================================
# Chat Events
# ============================================================================

@socketio.on('chat_message')
def handle_chat_message(data):
    """
    Broadcast chat message to session members

    Data format:
    {
        'session_id': 'session-id',
        'message': 'message text',
        'user_name': 'user name'
    }
    """
    session_id = data.get('session_id')
    message = data.get('message')
    user_name = data.get('user_name', 'Anonymous')

    if not session_id or not message:
        emit('error', {'message': 'Invalid data'})
        return

    emit('chat_message', {
        'message': message,
        'user_name': user_name,
        'from_user': request.sid,
        'timestamp': data.get('timestamp')
    }, room=session_id)


@socketio.on('ai_response')
def handle_ai_response(data):
    """
    Broadcast AI response to session members

    Data format:
    {
        'session_id': 'session-id',
        'response': 'AI response text'
    }
    """
    session_id = data.get('session_id')
    response = data.get('response')

    if not session_id or not response:
        emit('error', {'message': 'Invalid data'})
        return

    emit('ai_response', {
        'response': response,
        'timestamp': data.get('timestamp')
    }, room=session_id)


# ============================================================================
# Cursor/Selection Events (for collaborative editing)
# ============================================================================

@socketio.on('cursor_move')
def handle_cursor_move(data):
    """
    Broadcast cursor position to session members

    Data format:
    {
        'session_id': 'session-id',
        'x': 100,
        'y': 200,
        'user_name': 'user name'
    }
    """
    session_id = data.get('session_id')

    if not session_id:
        emit('error', {'message': 'No session_id provided'})
        return

    emit('cursor_move', {
        'x': data.get('x'),
        'y': data.get('y'),
        'user_name': data.get('user_name', 'Anonymous'),
        'from_user': request.sid
    }, room=session_id, skip_sid=request.sid)


@socketio.on('selection_changed')
def handle_selection_changed(data):
    """
    Broadcast selection changes to session members

    Data format:
    {
        'session_id': 'session-id',
        'selected_components': ['component-id-1', 'component-id-2'],
        'user_name': 'user name'
    }
    """
    session_id = data.get('session_id')

    if not session_id:
        emit('error', {'message': 'No session_id provided'})
        return

    emit('selection_changed', {
        'selected_components': data.get('selected_components', []),
        'user_name': data.get('user_name', 'Anonymous'),
        'from_user': request.sid
    }, room=session_id, skip_sid=request.sid)


def init_socketio(app):
    """Initialize SocketIO with the Flask app"""
    socketio.init_app(app, async_mode='eventlet', logger=True, engineio_logger=True)
    return socketio
