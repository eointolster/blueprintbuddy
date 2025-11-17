"""Database models for BlueprintBuddy"""

from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    """User model for authentication"""

    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    blueprints = db.relationship('Blueprint', backref='owner', lazy='dynamic',
                                cascade='all, delete-orphan')

    def set_password(self, password):
        """Set password hash"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Check password"""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'is_active': self.is_active
        }

    def __repr__(self):
        return f'<User {self.username}>'


class Blueprint(db.Model):
    """Blueprint model for storing diagrams"""

    __tablename__ = 'blueprints'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    data = db.Column(db.JSON, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_public = db.Column(db.Boolean, default=False)
    version = db.Column(db.String(20), default='1.0')

    # Indexes
    __table_args__ = (
        db.Index('idx_user_created', 'user_id', 'created_at'),
    )

    def to_dict(self, include_data=False):
        """Convert to dictionary"""
        result = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_public': self.is_public,
            'version': self.version
        }

        if include_data:
            result['data'] = self.data

        return result

    def __repr__(self):
        return f'<Blueprint {self.name}>'


class Session(db.Model):
    """Session model for collaborative editing"""

    __tablename__ = 'sessions'

    id = db.Column(db.String(100), primary_key=True)
    blueprint_id = db.Column(db.Integer, db.ForeignKey('blueprints.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    max_users = db.Column(db.Integer, default=10)

    # Relationships
    blueprint = db.relationship('Blueprint', backref='sessions')

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'blueprint_id': self.blueprint_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_active': self.is_active,
            'max_users': self.max_users
        }

    def __repr__(self):
        return f'<Session {self.id}>'
