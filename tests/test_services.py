"""
Tests for service modules
"""

import pytest
from app.services.component_service import ComponentService
from app.services.file_service import FileService
from app.services.code_map_service import CodeMapService


class TestComponentService:
    """Tests for ComponentService"""

    def test_create_component(self):
        """Test creating a component"""
        service = ComponentService()
        result = service.create_component('function', 100, 100, 'Test Function')

        assert result['success'] is True
        assert 'component' in result
        component = result['component']
        assert component['type'] == 'function'
        assert component['name'] == 'Test Function'
        assert component['x'] == 100
        assert component['y'] == 100

    def test_create_invalid_type(self):
        """Test creating component with invalid type"""
        service = ComponentService()
        result = service.create_component('invalid_type', 0, 0)

        assert result['success'] is False
        assert 'error' in result

    def test_validate_component_valid(self, sample_component):
        """Test validating a valid component"""
        service = ComponentService()
        result = service.validate_component(sample_component)

        assert result['valid'] is True
        assert len(result['errors']) == 0

    def test_validate_component_missing_fields(self):
        """Test validating component with missing fields"""
        service = ComponentService()
        result = service.validate_component({'type': 'function'})

        assert result['valid'] is False
        assert len(result['errors']) > 0

    def test_add_port(self, sample_component):
        """Test adding a port to component"""
        service = ComponentService()
        result = service.add_port(sample_component, 'inputs', 'new_input')

        assert result['success'] is True
        assert len(sample_component['inputs']) == 2
        assert result['port']['name'] == 'new_input'

    def test_remove_port(self, sample_component):
        """Test removing a port from component"""
        service = ComponentService()
        port_id = sample_component['inputs'][0]['id']
        result = service.remove_port(sample_component, port_id)

        assert result['success'] is True
        assert len(sample_component['inputs']) == 0

    def test_validate_connection(self, sample_blueprint):
        """Test validating a connection"""
        service = ComponentService()
        connection = sample_blueprint['connections'][0]
        components = sample_blueprint['components']

        result = service.validate_connection(components, connection)

        assert result['valid'] is True

    def test_get_component_stats(self, sample_blueprint):
        """Test getting component statistics"""
        service = ComponentService()
        stats = service.get_component_stats(sample_blueprint['components'])

        assert stats['total'] == 2
        assert 'function' in stats['by_type']
        assert 'class' in stats['by_type']


class TestFileService:
    """Tests for FileService"""

    def test_allowed_file(self, app):
        """Test file extension checking"""
        with app.app_context():
            service = FileService()
            service.initialize()

            assert service.allowed_file('test.json') is True
            assert service.allowed_file('test.txt') is False

    def test_save_and_load_blueprint(self, app, sample_blueprint):
        """Test saving and loading a blueprint"""
        with app.app_context():
            service = FileService()
            service.initialize()

            # Save
            save_result = service.save_blueprint(sample_blueprint, 'test.json')
            assert save_result['success'] is True

            # Load
            load_result = service.load_blueprint('test.json')
            assert load_result['success'] is True
            assert 'data' in load_result
            assert len(load_result['data']['components']) == 2

    def test_list_blueprints(self, app, sample_blueprint):
        """Test listing blueprints"""
        with app.app_context():
            service = FileService()
            service.initialize()

            # Save a blueprint first
            service.save_blueprint(sample_blueprint, 'test1.json')

            # List
            result = service.list_blueprints()
            assert result['success'] is True
            assert len(result['blueprints']) >= 1

    def test_delete_blueprint(self, app, sample_blueprint):
        """Test deleting a blueprint"""
        with app.app_context():
            service = FileService()
            service.initialize()

            # Save first
            service.save_blueprint(sample_blueprint, 'test_delete.json')

            # Delete
            result = service.delete_blueprint('test_delete.json')
            assert result['success'] is True

            # Try to load - should fail
            load_result = service.load_blueprint('test_delete.json')
            assert load_result['success'] is False

    def test_validate_blueprint(self, app, sample_blueprint):
        """Test blueprint validation"""
        with app.app_context():
            service = FileService()
            service.initialize()

            assert service._validate_blueprint(sample_blueprint) is True
            assert service._validate_blueprint({}) is False
            assert service._validate_blueprint({'components': []}) is False


class TestCodeMapService:
    """Tests for CodeMapService"""

    def test_maps_simple_codebase(self, app, tmp_path):
        with app.app_context():
            # Create a tiny codebase
            file_a = tmp_path / "module_a.py"
            file_b = tmp_path / "module_b.py"
            file_a.write_text(
                "def alpha():\n"
                "    beta()\n"
            )
            file_b.write_text(
                "def beta():\n"
                "    return 42\n"
            )

            app.config['CODEBASE_ROOT'] = str(tmp_path)
            app.config['CODEMAP_MAX_FILES'] = 10

            service = CodeMapService()
            service.initialize()
            result = service.map_codebase(".")

            assert result["success"] is True
            blueprint = result["blueprint"]
            assert len(blueprint["components"]) == 2
            # Should create a connection alpha -> beta
            assert any(
                conn["from"].endswith("-alpha-out") and conn["to"].endswith("-beta-in")
                for conn in blueprint["connections"]
            )

    def test_maps_single_file(self, app, tmp_path):
        with app.app_context():
            file_a = tmp_path / "single.py"
            file_a.write_text(
                "def foo():\n"
                "    bar()\n"
                "\n"
                "def bar():\n"
                "    return 1\n"
            )

            app.config['CODEBASE_ROOT'] = str(tmp_path)

            service = CodeMapService()
            service.initialize()
            result = service.map_file("single.py")

            assert result["success"] is True
            bp = result["blueprint"]
            assert len(bp["components"]) == 2
            # Intra-file link foo -> bar
            assert any(conn["to"].endswith("-bar-in") for conn in bp["connections"])

    def test_sanitizes_ids(self, app, tmp_path):
        with app.app_context():
            file_a = tmp_path / "pkg.mod.py"
            file_a.write_text("def a_func():\n    return 1\n")
            app.config['CODEBASE_ROOT'] = str(tmp_path)

            service = CodeMapService()
            service.initialize()
            result = service.map_file("pkg.mod.py")

            assert result["success"] is True
            bp = result["blueprint"]
            # IDs should not contain dots
            for comp in bp["components"]:
                assert "." not in comp["id"]
            for conn in bp["connections"]:
                assert "." not in conn["from"]
                assert "." not in conn["to"]
