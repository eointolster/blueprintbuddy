"""
Tests for API endpoints
"""

import pytest
import json


class TestBlueprintAPI:
    """Tests for blueprint API endpoints"""

    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get('/api/health')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'healthy'

    def test_save_blueprint(self, client, sample_blueprint):
        """Test saving a blueprint"""
        response = client.post(
            '/api/blueprints',
            data=json.dumps({
                'blueprint': sample_blueprint,
                'filename': 'test_blueprint.json'
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'filename' in data

    def test_save_blueprint_no_data(self, client):
        """Test saving blueprint with no data"""
        response = client.post(
            '/api/blueprints',
            data=json.dumps({}),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_list_blueprints(self, client):
        """Test listing blueprints"""
        response = client.get('/api/blueprints')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'blueprints' in data


class TestComponentAPI:
    """Tests for component API endpoints"""

    def test_create_component(self, client):
        """Test creating a component"""
        response = client.post(
            '/api/components/create',
            data=json.dumps({
                'type': 'function',
                'x': 100,
                'y': 100,
                'name': 'Test Component'
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'component' in data

    def test_validate_component(self, client, sample_component):
        """Test component validation"""
        response = client.post(
            '/api/components/validate',
            data=json.dumps({'component': sample_component}),
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'valid' in data

    def test_component_stats(self, client, sample_blueprint):
        """Test component statistics"""
        response = client.post(
            '/api/components/stats',
            data=json.dumps({'components': sample_blueprint['components']}),
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'total' in data
        assert data['total'] == 2


class TestAIAPI:
    """Tests for AI API endpoints"""

    @pytest.mark.integration
    def test_ai_chat_no_api_key(self, client, app):
        """Test AI chat without API key"""
        # Temporarily remove API key
        app.config['ANTHROPIC_API_KEY'] = None

        response = client.post(
            '/api/ai/chat',
            data=json.dumps({'message': 'Hello'}),
            content_type='application/json'
        )
        # Should still return 500 with error message
        assert response.status_code == 500

    def test_ai_chat_no_message(self, client):
        """Test AI chat without message"""
        response = client.post(
            '/api/ai/chat',
            data=json.dumps({}),
            content_type='application/json'
        )
        assert response.status_code == 400
