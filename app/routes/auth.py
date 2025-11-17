"""
Authentication routes for BlueprintBuddy
"""

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app.models import db, User
from datetime import datetime
import re

bp = Blueprint('auth', __name__, url_prefix='/auth')


def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"
    return True, None


@bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'No data provided'
        }), 400

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    # Validate required fields
    if not all([username, email, password]):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400

    # Validate username
    if len(username) < 3 or len(username) > 80:
        return jsonify({
            'success': False,
            'error': 'Username must be between 3 and 80 characters'
        }), 400

    # Validate email
    if not validate_email(email):
        return jsonify({
            'success': False,
            'error': 'Invalid email format'
        }), 400

    # Validate password
    valid, error = validate_password(password)
    if not valid:
        return jsonify({
            'success': False,
            'error': error
        }), 400

    # Check if user already exists
    if User.query.filter_by(username=username).first():
        return jsonify({
            'success': False,
            'error': 'Username already exists'
        }), 400

    if User.query.filter_by(email=email).first():
        return jsonify({
            'success': False,
            'error': 'Email already registered'
        }), 400

    # Create new user
    try:
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        current_app.logger.info(f"New user registered: {username}")

        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user': user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error registering user: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to register user'
        }), 500


@bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'No data provided'
        }), 400

    username = data.get('username')
    password = data.get('password')

    if not all([username, password]):
        return jsonify({
            'success': False,
            'error': 'Missing username or password'
        }), 400

    # Find user
    user = User.query.filter_by(username=username).first()

    if not user or not user.check_password(password):
        return jsonify({
            'success': False,
            'error': 'Invalid username or password'
        }), 401

    if not user.is_active:
        return jsonify({
            'success': False,
            'error': 'Account is deactivated'
        }), 403

    # Update last login
    user.last_login = datetime.utcnow()
    db.session.commit()

    # Login user
    login_user(user, remember=data.get('remember', False))

    current_app.logger.info(f"User logged in: {username}")

    return jsonify({
        'success': True,
        'message': 'Logged in successfully',
        'user': user.to_dict()
    }), 200


@bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Logout user"""
    username = current_user.username
    logout_user()

    current_app.logger.info(f"User logged out: {username}")

    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200


@bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current user info"""
    return jsonify({
        'success': True,
        'user': current_user.to_dict()
    }), 200


@bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Change user password"""
    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'No data provided'
        }), 400

    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not all([current_password, new_password]):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400

    # Verify current password
    if not current_user.check_password(current_password):
        return jsonify({
            'success': False,
            'error': 'Current password is incorrect'
        }), 401

    # Validate new password
    valid, error = validate_password(new_password)
    if not valid:
        return jsonify({
            'success': False,
            'error': error
        }), 400

    # Update password
    try:
        current_user.set_password(new_password)
        db.session.commit()

        current_app.logger.info(f"Password changed for user: {current_user.username}")

        return jsonify({
            'success': True,
            'message': 'Password changed successfully'
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error changing password: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to change password'
        }), 500


@bp.route('/check', methods=['GET'])
def check_auth():
    """Check if user is authenticated"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': current_user.to_dict()
        }), 200
    else:
        return jsonify({
            'authenticated': False
        }), 200
