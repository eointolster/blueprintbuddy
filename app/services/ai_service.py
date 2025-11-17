"""
AI Service for BlueprintBuddy
Handles interactions with Claude AI API for diagram analysis and code generation
"""

import anthropic
from flask import current_app
import json
from typing import Dict, List, Optional, Any


class AIService:
    """Service for AI-powered diagram analysis and assistance"""

    def __init__(self):
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize the Anthropic client"""
        try:
            api_key = current_app.config.get('ANTHROPIC_API_KEY')
            if not api_key:
                current_app.logger.warning("ANTHROPIC_API_KEY not configured")
                return
            self.client = anthropic.Anthropic(api_key=api_key)
        except Exception as e:
            current_app.logger.error(f"Failed to initialize Anthropic client: {e}")

    def chat(self, message: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Send a chat message to Claude AI

        Args:
            message: User's message
            context: Optional context including diagram state, history, etc.

        Returns:
            Dict containing response and metadata
        """
        if not self.client:
            return {
                'error': 'AI service not configured. Please set ANTHROPIC_API_KEY.',
                'response': None
            }

        try:
            # Build the prompt with context
            system_prompt = self._build_system_prompt(context)

            # Call Claude API
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2048,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": message}
                ]
            )

            response_text = response.content[0].text

            return {
                'response': response_text,
                'error': None,
                'usage': {
                    'input_tokens': response.usage.input_tokens,
                    'output_tokens': response.usage.output_tokens
                }
            }

        except anthropic.APIError as e:
            current_app.logger.error(f"Anthropic API error: {e}")
            return {
                'error': f'AI service error: {str(e)}',
                'response': None
            }
        except Exception as e:
            current_app.logger.error(f"Unexpected error in chat: {e}")
            return {
                'error': f'Unexpected error: {str(e)}',
                'response': None
            }

    def analyze_diagram(self, diagram_data: Dict) -> Dict[str, Any]:
        """
        Analyze a diagram and provide insights

        Args:
            diagram_data: JSON representation of the diagram

        Returns:
            Dict containing analysis results
        """
        if not self.client:
            return {'error': 'AI service not configured'}

        try:
            components = diagram_data.get('components', [])
            connections = diagram_data.get('connections', [])

            prompt = f"""
            Analyze this system design diagram:

            Components ({len(components)}):
            {json.dumps(components, indent=2)}

            Connections ({len(connections)}):
            {json.dumps(connections, indent=2)}

            Please provide:
            1. A brief description of what this system does
            2. Any potential issues or improvements
            3. Suggestions for missing components or connections
            4. Code architecture recommendations
            """

            response = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2048,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            return {
                'analysis': response.content[0].text,
                'error': None
            }

        except Exception as e:
            current_app.logger.error(f"Error analyzing diagram: {e}")
            return {
                'error': str(e),
                'analysis': None
            }

    def suggest_connections(self, diagram_data: Dict) -> Dict[str, Any]:
        """
        Suggest potential connections between components

        Args:
            diagram_data: JSON representation of the diagram

        Returns:
            Dict containing suggested connections
        """
        if not self.client:
            return {'error': 'AI service not configured'}

        try:
            components = diagram_data.get('components', [])
            existing_connections = diagram_data.get('connections', [])

            prompt = f"""
            Given these components:
            {json.dumps(components, indent=2)}

            And existing connections:
            {json.dumps(existing_connections, indent=2)}

            Suggest logical connections that are missing.
            Return as JSON array of objects with 'from', 'to', and 'reason' fields.
            """

            response = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            suggestions_text = response.content[0].text

            # Try to extract JSON from response
            try:
                # Look for JSON array in the response
                start_idx = suggestions_text.find('[')
                end_idx = suggestions_text.rfind(']') + 1
                if start_idx != -1 and end_idx > start_idx:
                    suggestions = json.loads(suggestions_text[start_idx:end_idx])
                else:
                    suggestions = []
            except json.JSONDecodeError:
                suggestions = []
                current_app.logger.warning("Could not parse JSON from AI response")

            return {
                'suggestions': suggestions,
                'raw_response': suggestions_text,
                'error': None
            }

        except Exception as e:
            current_app.logger.error(f"Error suggesting connections: {e}")
            return {
                'error': str(e),
                'suggestions': []
            }

    def generate_code(self, component: Dict, language: str = 'python') -> Dict[str, Any]:
        """
        Generate code for a component

        Args:
            component: Component data
            language: Target programming language

        Returns:
            Dict containing generated code
        """
        if not self.client:
            return {'error': 'AI service not configured'}

        try:
            prompt = f"""
            Generate {language} code for this component:

            Name: {component.get('name')}
            Type: {component.get('type')}
            Inputs: {json.dumps(component.get('inputs', []))}
            Outputs: {json.dumps(component.get('outputs', []))}
            Description: {component.get('description', 'No description')}

            Generate clean, well-documented code with type hints and docstrings.
            """

            response = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2048,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            code = response.content[0].text

            return {
                'code': code,
                'language': language,
                'error': None
            }

        except Exception as e:
            current_app.logger.error(f"Error generating code: {e}")
            return {
                'error': str(e),
                'code': None
            }

    def _build_system_prompt(self, context: Optional[Dict] = None) -> str:
        """Build system prompt with context"""
        base_prompt = """
        You are BlueprintBuddy, an AI assistant specialized in helping users design
        and understand software system architectures through visual diagrams.

        You help users:
        - Design system architectures
        - Understand component relationships
        - Generate code from diagrams
        - Identify potential issues in designs
        - Suggest improvements and best practices

        You communicate clearly and provide actionable advice.
        """

        if context and context.get('diagram_data'):
            diagram_data = context['diagram_data']
            components_count = len(diagram_data.get('components', []))
            connections_count = len(diagram_data.get('connections', []))

            base_prompt += f"""

            Current diagram context:
            - {components_count} components
            - {connections_count} connections
            """

        return base_prompt


# Global instance
ai_service = AIService()


def get_ai_service() -> AIService:
    """Get the global AI service instance"""
    return ai_service
