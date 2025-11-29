"""
CodeMap Service
Builds a lightweight blueprint graph from a Python codebase.
"""

import ast
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from flask import current_app
import re
from app.services.ai_service import get_ai_service


@dataclass
class FunctionInfo:
    """Information about a discovered function"""
    component_id: str
    name: str
    class_name: Optional[str]
    module: str
    file_path: Path
    calls: List[Dict[str, str]] = field(default_factory=list)  # {type,name,base}
    event_names: List[str] = field(default_factory=list)


class CodeMapService:
    """Maps a Python codebase into a Blueprint-compatible graph"""

    def __init__(self):
        self.base_path: Path = Path(os.getcwd()).resolve()
        self._id_regex = re.compile(r'[^a-zA-Z0-9_-]+')

    def initialize(self):
        """Initialize the service with app config"""
        root = current_app.config.get("CODEBASE_ROOT")
        self.base_path = Path(root or os.getcwd()).resolve()

    def _safe_path(self, subpath: str) -> Path:
        """Resolve a subpath under the allowed base path"""
        requested = (self.base_path / (subpath or ".")).resolve()
        if self.base_path not in requested.parents and requested != self.base_path:
            raise ValueError("Requested path is outside the allowed codebase root")
        return requested

    def _is_excluded(self, path: Path, exclude: Set[str]) -> bool:
        """Check if any part of the path should be excluded"""
        return any(part in exclude for part in path.parts)

    def _iter_python_files(
        self,
        root_path: Path,
        max_files: int,
        exclude_dirs: Set[str]
    ) -> List[Path]:
        """Collect python files under root respecting limits/exclusions"""
        files: List[Path] = []
        for file_path in sorted(root_path.rglob("*.py")):
            if self._is_excluded(file_path, exclude_dirs):
                continue
            files.append(file_path)
            if len(files) >= max_files:
                break
        return files

    def _parse_functions(self, file_path: Path, module_name: str) -> List[FunctionInfo]:
        """Parse a file for top-level functions, class methods, and their call graph"""
        try:
            source = file_path.read_text(encoding="utf-8")
            tree = ast.parse(source)
        except Exception:
            return []

        functions: List[FunctionInfo] = []
        current_func: Optional[FunctionInfo] = None
        current_class: Optional[str] = None

        class Visitor(ast.NodeVisitor):
            def visit_ClassDef(self, node):
                nonlocal current_class
                prev_class = current_class
                current_class = node.name
                self.generic_visit(node)
                current_class = prev_class

            def visit_FunctionDef(self, node):
                nonlocal current_func
                func_id = f"{module_name}-{current_class + '-' if current_class else ''}{node.name}"

                # Detect socketio.on("event") style decorators
                event_names: List[str] = []
                for dec in node.decorator_list:
                    if isinstance(dec, ast.Call):
                        dec_info = self._get_call_info(dec.func)
                        dec_name = dec_info["name"] if isinstance(dec_info, dict) else None
                        if isinstance(dec_name, str) and dec_name.lower().endswith("on") and dec.args:
                            first_arg = dec.args[0]
                            if isinstance(first_arg, ast.Str):
                                event_names.append(first_arg.s)
                            elif isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
                                event_names.append(first_arg.value)

                info = FunctionInfo(
                    component_id=func_id,
                    name=node.name,
                    class_name=current_class,
                    module=module_name,
                    file_path=file_path,
                    calls=[],
                    event_names=event_names,
                )
                functions.append(info)
                prev = current_func
                current_func = info
                self.generic_visit(node)
                current_func = prev

            def visit_AsyncFunctionDef(self, node):
                self.visit_FunctionDef(node)

            def visit_Call(self, node):
                if current_func is None:
                    return
                call_info = self._get_call_info(node.func)
                if call_info:
                    current_func.calls.append(call_info)
                self.generic_visit(node)

            def _get_call_info(self, func):
                """
                Returns a dict with call info:
                {
                  "type": "self"|"name"|"attr",
                  "name": <str>,
                  "base": <str or None>
                }
                """
                if isinstance(func, ast.Name):
                    return {"type": "name", "name": func.id, "base": None}
                if isinstance(func, ast.Attribute):
                    if isinstance(func.value, ast.Name) and func.value.id == "self":
                        return {"type": "self", "name": func.attr, "base": "self"}
                    if isinstance(func.value, ast.Name):
                        return {"type": "attr", "name": func.attr, "base": func.value.id}
                return None

        Visitor().visit(tree)
        return functions

    def _layout_components(self, components: List[Dict]) -> None:
        """Assign simple grid positions to components for readability"""
        if not components:
            return
        cols = 4
        spacing_x = 260
        spacing_y = 180
        start_x = 80
        start_y = 120

        for idx, component in enumerate(components):
            row = idx // cols
            col = idx % cols
            component["x"] = start_x + col * spacing_x
            component["y"] = start_y + row * spacing_y

    def map_codebase(
        self,
        root_subpath: str,
        max_files: Optional[int] = None,
        exclude_dirs: Optional[Set[str]] = None
    ) -> Dict:
        """
        Build a blueprint representation from Python files under root_subpath.
        """
        try:
            root_path = self._safe_path(root_subpath)
        except ValueError as exc:
            return {"success": False, "error": str(exc)}

        limit = max_files or current_app.config.get("CODEMAP_MAX_FILES", 200)
        exclude = exclude_dirs or set(current_app.config.get("CODEMAP_EXCLUDE_DIRS", []))
        if not exclude:
            exclude = {"venv", ".venv", "__pycache__", ".git", "node_modules"}

        python_files = self._iter_python_files(root_path, limit, exclude)

        all_functions: List[FunctionInfo] = []
        for file_path in python_files:
            rel_module = file_path.relative_to(self.base_path).with_suffix("")
            module_name = ".".join(rel_module.parts)
            all_functions.extend(self._parse_functions(file_path, module_name))

        # Build component map
        components: List[Dict] = []
        by_short_name: Dict[str, List[FunctionInfo]] = {}
        for func in all_functions:
            by_short_name.setdefault(func.name, []).append(func)
            comp_id = self._sanitize_id(func.component_id)
            func.component_id = comp_id  # update to sanitized for downstream connections
            label = f"{func.module}.{func.class_name + '.' if func.class_name else ''}{func.name}"
            components.append({
                "id": comp_id,
                "type": "function",
                "name": label,
                "width": 220,
                "height": 120,
                "inputs": [{"id": "in", "name": "input", "type": "any"}],
                "outputs": [{"id": "out", "name": "output", "type": "any"}],
                "metadata": {
                    "module": func.module,
                    "file": str(func.file_path),
                    "class": func.class_name
                }
            })

        # Build connections only when the target name is unambiguous
        connections: List[Dict] = []
        for func in all_functions:
            for call in func.calls:
                call_type = call.get("type")
                call_name = call.get("name")
                base = call.get("base")
                targets = by_short_name.get(call_name, [])

                target = None
                # Prefer same-class resolution for self calls
                if call_type == "self" and func.class_name:
                    target = next((t for t in targets if t.class_name == func.class_name), None)

                # If only one candidate by name, use it
                if target is None and len(targets) == 1:
                    target = targets[0]

                # If base matches a class name in this file, prefer that
                if target is None and base:
                    target = next((t for t in targets if t.class_name == base or t.name == base), None)

                if target is None:
                    continue  # ambiguous or not found

                connections.append({
                    "from": f"{func.component_id}-out",
                    "to": f"{target.component_id}-in",
                })

        self._layout_components(components)

        return {
            "success": True,
            "blueprint": {
                "components": components,
                "connections": connections,
                "metadata": {
                    "generated_by": "code_map_service",
                    "root": str(root_path),
                    "file_count": len(python_files),
                },
            },
            "stats": {
                "files_scanned": len(python_files),
                "functions": len(all_functions),
                "connections": len(connections),
            },
        }

    def _sanitize_id(self, raw: str) -> str:
        """Make a safe DOM-friendly id"""
        return self._id_regex.sub("-", raw)

    def generate_from_prompt(self, prompt: str, base_blueprint: Optional[Dict] = None, use_ai: bool = True) -> Dict:
        """
        Generate a blueprint structure from a natural-language prompt.
        If use_ai is True, try the AI model first; fall back to heuristic mapper.
        """
        if not prompt or not isinstance(prompt, str):
            return {"success": False, "error": "Prompt is required"}

        if use_ai:
            ai_service = get_ai_service()
            ai_result = ai_service.generate_blueprint(prompt, base_blueprint)
            if not ai_result.get('error'):
                normalized = self._normalize_ai_blueprint(ai_result, base_blueprint, prompt)
                if normalized.get("success"):
                    return normalized

        p = prompt.lower()
        specs = [
            {
                "match": ["arduino", "microcontroller", "stepper", "laser", "sensor", "keyboard", "keys"],
                "nodes": [
                    ("Computer Input (WASD)", "module"),
                    ("Serial Link", "module"),
                    ("Arduino / MCU", "module"),
                    ("Motor Driver", "module"),
                    ("Stepper Motors", "module"),
                    ("Laser Module", "module"),
                    ("Sensors / Limits", "module"),
                    ("Control Loop", "function"),
                    ("Telemetry", "function"),
                ],
                "edges": [
                    ("Computer Input (WASD)", "Serial Link"),
                    ("Serial Link", "Arduino / MCU"),
                    ("Arduino / MCU", "Control Loop"),
                    ("Control Loop", "Motor Driver"),
                    ("Motor Driver", "Stepper Motors"),
                    ("Control Loop", "Laser Module"),
                    ("Sensors / Limits", "Control Loop"),
                    ("Control Loop", "Telemetry"),
                    ("Telemetry", "Computer Input (WASD)"),
                ]
            },
            {
                "match": ["ecommerce", "shop", "product", "order", "cart", "checkout"],
                "preset": "ecommerce"
            },
            {
                "match": ["analytics", "warehouse", "pipeline", "etl", "stream"],
                "nodes": [
                    ("Ingestion", "function"),
                    ("Stream Processor", "function"),
                    ("Data Lake", "module"),
                    ("Warehouse", "module"),
                    ("Dashboard", "module"),
                    ("ML Service", "function"),
                ],
                "edges": [
                    ("Ingestion", "Stream Processor"),
                    ("Stream Processor", "Data Lake"),
                    ("Stream Processor", "Warehouse"),
                    ("Warehouse", "Dashboard"),
                    ("Data Lake", "ML Service"),
                    ("ML Service", "Warehouse"),
                ]
            }
        ]

        spec = None
        for candidate in specs:
            if any(k in p for k in candidate.get("match", [])):
                spec = candidate
                break

        # Default generic graph
        if spec is None:
            spec = {
                "nodes": [
                    ("Client", "module"),
                    ("API", "module"),
                    ("Service A", "function"),
                    ("Service B", "function"),
                    ("Database", "module"),
                ],
                "edges": [
                    ("Client", "API"),
                    ("API", "Service A"),
                    ("API", "Service B"),
                    ("Service A", "Database"),
                    ("Service B", "Database"),
                ]
            }

        # Reuse existing preset generator if requested
        if spec.get("preset"):
            if spec["preset"] == "ecommerce":
                nodes = [
                    ("Clients", "module"),
                    ("API Gateway", "module"),
                    ("Auth Service", "function"),
                    ("Product Service", "function"),
                    ("Order Service", "function"),
                    ("Payment Service", "function"),
                    ("Inventory Service", "function"),
                    ("Search Service", "function"),
                    ("Message Queue", "module"),
                    ("Cache", "module"),
                    ("Database", "module"),
                    ("Object Storage", "module")
                ]
                edges = [
                    ("Clients", "API Gateway"),
                    ("API Gateway", "Auth Service"),
                    ("API Gateway", "Product Service"),
                    ("API Gateway", "Order Service"),
                    ("API Gateway", "Search Service"),
                    ("Order Service", "Payment Service"),
                    ("Order Service", "Message Queue"),
                    ("Payment Service", "Message Queue"),
                    ("Inventory Service", "Message Queue"),
                    ("Message Queue", "Inventory Service"),
                    ("Product Service", "Cache"),
                    ("Product Service", "Database"),
                    ("Order Service", "Database"),
                    ("Inventory Service", "Database"),
                    ("Search Service", "Object Storage"),
                    ("Product Service", "Object Storage")
                ]
            else:
                nodes = []
                edges = []
        else:
            nodes = spec.get("nodes", [])
            edges = spec.get("edges", [])

        # Start from base blueprint if provided
        components: List[Dict] = []
        connections: List[Dict] = []
        existing_names: Dict[str, str] = {}

        if base_blueprint:
            for comp in base_blueprint.get("components", []):
                components.append(comp)
                if comp.get("name"):
                    existing_names[comp["name"]] = comp["id"]
            for conn in base_blueprint.get("connections", []):
                connections.append(conn)

        id_by_name: Dict[str, str] = dict(existing_names)

        def ensure_component(name: str, ctype: str) -> str:
            if name in id_by_name:
                return id_by_name[name]
            base_id = self._sanitize_id(f"gen-{name}")
            comp_id = base_id
            suffix = 1
            existing_ids = {c["id"] for c in components}
            while comp_id in existing_ids:
                suffix += 1
                comp_id = f"{base_id}-{suffix}"
            components.append({
                "id": comp_id,
                "type": ctype,
                "name": name,
                "width": 220,
                "height": 120,
                "inputs": [{"id": "in", "name": "input", "type": "any"}],
                "outputs": [{"id": "out", "name": "output", "type": "any"}],
                "metadata": {"generated_from": prompt}
            })
            id_by_name[name] = comp_id
            return comp_id

        for name, ctype in nodes:
            ensure_component(name, ctype)

        # Augment based on extra keywords in prompt
        def has_kw(*kws):
            return any(k in p for k in kws)

        # Web UI / dashboard
        if has_kw('web', 'dashboard', 'ui', 'interface'):
            ensure_component("Web Interface", "module")
            ensure_component("API", "module")
            edges.append(("Web Interface", "API"))
            edges.append(("API", "Telemetry"))

        # Payment system
        if has_kw('payment', 'billing', 'stripe', 'pay'):
            ensure_component("Payment Gateway", "module")
            ensure_component("Billing Service", "function")
            ensure_component("Database", "module")
            edges.append(("API", "Payment Gateway"))
            edges.append(("Payment Gateway", "Billing Service"))
            edges.append(("Billing Service", "Database"))

        # More motor controls / axes
        if has_kw('motor', 'axis', 'stepper'):
            ensure_component("Motor Driver 2", "module")
            ensure_component("Stepper Motors 2", "module")
            ensure_component("Control Loop", "function")
            edges.append(("Control Loop", "Motor Driver 2"))
            edges.append(("Motor Driver 2", "Stepper Motors 2"))

        # Sensor expansion
        if has_kw('sensor', 'limit', 'feedback'):
            ensure_component("Sensor Array", "module")
            ensure_component("Control Loop", "function")
            edges.append(("Sensor Array", "Control Loop"))

        # Laser specific
        if has_kw('laser'):
            ensure_component("Laser Module", "module")
            ensure_component("Control Loop", "function")
            edges.append(("Control Loop", "Laser Module"))

        def first_input(comp_id: str) -> Optional[str]:
            comp = next((c for c in components if c["id"] == comp_id), None)
            if not comp:
                return None
            ports = comp.get("inputs") or []
            return ports[0]["id"] if ports else None

        def first_output(comp_id: str) -> Optional[str]:
            comp = next((c for c in components if c["id"] == comp_id), None)
            if not comp:
                return None
            ports = comp.get("outputs") or []
            return ports[0]["id"] if ports else None

        existing_conn = {(c["from"], c["to"]) for c in connections}

        for from_name, to_name in edges:
            from_id = ensure_component(from_name, "function")
            to_id = ensure_component(to_name, "function")
            from_port = first_output(from_id)
            to_port = first_input(to_id)
            if not from_port or not to_port:
                continue
            conn = (f"{from_id}-{from_port}", f"{to_id}-{to_port}")
            if conn in existing_conn:
                continue
            connections.append({"from": conn[0], "to": conn[1]})
            existing_conn.add(conn)

        self._layout_components(components)

        return {
            "success": True,
            "blueprint": {
                "components": components,
                "connections": connections,
                "metadata": {
                    "generated_by": "prompt_mapper",
                    "prompt": prompt
                },
            },
            "stats": {
                "functions": len(components),
                "connections": len(connections),
            },
        }

    def _normalize_ai_blueprint(self, ai_result: Dict, base_blueprint: Optional[Dict], prompt: str) -> Dict:
        """Sanitize AI-produced blueprint and merge with base diagram"""
        components: List[Dict] = []
        connections: List[Dict] = []
        id_by_name: Dict[str, str] = {}

        existing_components = base_blueprint.get("components", []) if base_blueprint else []
        existing_connections = base_blueprint.get("connections", []) if base_blueprint else []

        for comp in existing_components:
            components.append(comp)
            if comp.get("name"):
                id_by_name[comp["name"]] = comp["id"]

        for conn in existing_connections:
            connections.append(conn)

        ai_components = ai_result.get("components", []) or []
        ai_connections = ai_result.get("connections", []) or []

        def ensure_component(comp: Dict) -> Optional[str]:
            name = comp.get("name") or comp.get("id")
            ctype = comp.get("type", "function")
            if not name:
                return None
            if name in id_by_name:
                return id_by_name[name]
            base_id = self._sanitize_id(str(comp.get("id") or f"gen-{name}"))
            comp_id = base_id
            suffix = 1
            existing_ids = {c["id"] for c in components}
            while comp_id in existing_ids:
                suffix += 1
                comp_id = f"{base_id}-{suffix}"
            components.append({
                "id": comp_id,
                "type": ctype,
                "name": name,
                "width": 220,
                "height": 120,
                "inputs": [{"id": "in", "name": "input", "type": "any"}],
                "outputs": [{"id": "out", "name": "output", "type": "any"}],
                "metadata": {"generated_from": prompt, "source": "ai_model"}
            })
            id_by_name[name] = comp_id
            return comp_id

        for comp in ai_components:
            ensure_component(comp)

        existing_conn = {(c["from"], c["to"]) for c in connections}

        def first_input(comp_id: str) -> Optional[str]:
            comp = next((c for c in components if c["id"] == comp_id), None)
            if not comp:
                return None
            ports = comp.get("inputs") or []
            return ports[0]["id"] if ports else None

        def first_output(comp_id: str) -> Optional[str]:
            comp = next((c for c in components if c["id"] == comp_id), None)
            if not comp:
                return None
            ports = comp.get("outputs") or []
            return ports[0]["id"] if ports else None

        for conn in ai_connections:
            from_name = conn.get("from_name")
            to_name = conn.get("to_name")
            from_id = conn.get("from")
            to_id = conn.get("to")

            if from_name:
                from_id = ensure_component({"name": from_name, "type": "function"})
            elif from_id and '-' in from_id:
                from_id = from_id.rsplit('-', 1)[0]
            if to_name:
                to_id = ensure_component({"name": to_name, "type": "function"})
            elif to_id and '-' in to_id:
                to_id = to_id.rsplit('-', 1)[0]

            if not from_id or not to_id:
                continue

            from_port = first_output(from_id)
            to_port = first_input(to_id)
            if not from_port or not to_port:
                continue

            conn_tuple = (f"{from_id}-{from_port}", f"{to_id}-{to_port}")
            if conn_tuple in existing_conn:
                continue

            connections.append({"from": conn_tuple[0], "to": conn_tuple[1]})
            existing_conn.add(conn_tuple)

        self._layout_components(components)

        return {
            "success": True,
            "blueprint": {
                "components": components,
                "connections": connections,
                "metadata": {
                    "generated_by": "ai_model",
                    "prompt": prompt
                },
            },
            "stats": {
                "functions": len(components),
                "connections": len(connections),
            },
        }

    def map_file(self, file_subpath: str) -> Dict:
        """
        Build a blueprint representation from a single Python file.
        """
        try:
            file_path = self._safe_path(file_subpath)
        except ValueError as exc:
            return {"success": False, "error": str(exc)}

        if not file_path.exists() or not file_path.is_file():
            return {"success": False, "error": f"File not found: {file_subpath}"}

        module_name = ".".join(file_path.relative_to(self.base_path).with_suffix("").parts)
        functions = self._parse_functions(file_path, module_name)

        components: List[Dict] = []
        event_nodes: Dict[str, str] = {}
        # Build event nodes first
        for func in functions:
            for ev in func.event_names:
                if ev not in event_nodes:
                    raw_id = f"{module_name}-event-{ev}"
                    ev_id = self._sanitize_id(raw_id)
                    event_nodes[ev] = ev_id
                    components.append({
                        "id": ev_id,
                        "type": "module",
                        "name": f"event: {ev}",
                        "width": 200,
                        "height": 100,
                        "inputs": [],
                        "outputs": [{"id": "out", "name": "emit", "type": "any"}],
                        "metadata": {"event": ev, "file": str(file_path), "original_id": raw_id}
                    })

        for func in functions:
            comp_id = self._sanitize_id(func.component_id)
            func.component_id = comp_id
            label = f"{func.class_name + '.' if func.class_name else ''}{func.name}()"
            components.append({
                "id": comp_id,
                "type": "function",
                "name": label,
                "width": 220,
                "height": 120,
                "inputs": [{"id": "in", "name": "input", "type": "any"}],
                "outputs": [{"id": "out", "name": "output", "type": "any"}],
                "metadata": {
                    "module": func.module,
                    "file": str(file_path),
                    "class": func.class_name,
                    "events": func.event_names
                }
            })

        connections: List[Dict] = []
        # Event -> handler links
        for func in functions:
            for ev in func.event_names:
                ev_id = event_nodes.get(ev)
                if ev_id:
                    connections.append({
                        "from": f"{ev_id}-out",
                        "to": f"{func.component_id}-in",
                    })

        # Intra-file call links
        for func in functions:
            for call in func.calls:
                call_type = call.get("type")
                call_name = call.get("name")
                base = call.get("base")
                candidates = [f for f in functions if f.name == call_name]
                target = None
                if call_type == "self" and func.class_name:
                    target = next((f for f in candidates if f.class_name == func.class_name), None)
                if target is None and len(candidates) == 1:
                    target = candidates[0]
                if target is None and base:
                    target = next((f for f in candidates if f.class_name == base or f.name == base), None)
                if not target:
                    continue
                connections.append({
                    "from": f"{func.component_id}-out",
                    "to": f"{target.component_id}-in",
                })

        self._layout_components(components)

        return {
            "success": True,
            "blueprint": {
                "components": components,
                "connections": connections,
                "metadata": {
                    "generated_by": "code_map_service",
                    "file": str(file_path),
                    "module": module_name,
                },
            },
            "stats": {
                "files_scanned": 1,
                "functions": len(functions),
                "connections": len(connections),
            },
        }


# Global instance for app use
code_map_service = CodeMapService()


def get_code_map_service() -> CodeMapService:
    """Return the shared CodeMapService"""
    return code_map_service
