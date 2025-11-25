"""
Pytest configuration and fixtures
"""

import pytest
import os
import tempfile
from app import create_app
from config import TestingConfig


@pytest.fixture
def app():
    """Create and configure a test Flask application"""
    # Create a temporary directory for uploads
    test_upload_folder = tempfile.mkdtemp()

    # Update config for testing
    TestingConfig.UPLOAD_FOLDER = test_upload_folder
    TestingConfig.ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', 'test-key')

    app = create_app(TestingConfig)

    yield app

    # Cleanup
    import shutil
    if os.path.exists(test_upload_folder):
        shutil.rmtree(test_upload_folder)


@pytest.fixture
def client(app):
    """Create a test client for the app"""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create a test CLI runner"""
    return app.test_cli_runner()


@pytest.fixture
def sample_component():
    """Sample component for testing"""
    return {
        'id': 'test-component-1',
        'type': 'function',
        'name': 'Test Function',
        'x': 100,
        'y': 100,
        'width': 200,
        'height': 100,
        'inputs': [
            {'id': 'in1', 'name': 'input1', 'type': 'any'}
        ],
        'outputs': [
            {'id': 'out1', 'name': 'output1', 'type': 'any'}
        ]
    }


@pytest.fixture
def sample_blueprint():
    """Sample blueprint for testing"""
    return {
        'components': [
            {
                'id': 'comp1',
                'type': 'function',
                'name': 'Function 1',
                'x': 100,
                'y': 100,
                'width': 200,
                'height': 100,
                'inputs': [{'id': 'in1', 'name': 'input1', 'type': 'any'}],
                'outputs': [{'id': 'out1', 'name': 'output1', 'type': 'any'}]
            },
            {
                'id': 'comp2',
                'type': 'class',
                'name': 'Class 1',
                'x': 400,
                'y': 100,
                'width': 200,
                'height': 100,
                'inputs': [{'id': 'in2', 'name': 'constructor', 'type': 'any'}],
                'outputs': [{'id': 'out2', 'name': 'instance', 'type': 'object'}]
            }
        ],
        'connections': [
            {
                'from': 'comp1-out1',
                'to': 'comp2-in2'
            }
        ],
        'metadata': {
            'version': '1.0',
            'timestamp': '2024-01-01T00:00:00Z'
        }
    }
