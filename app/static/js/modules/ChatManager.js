/**
 * ChatManager - Handles AI chat interactions
 */
class ChatManager {
    constructor() {
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-message');
        this.messagesContainer = document.querySelector('.chat-messages');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => this.sendMessage());

        // Enter key in input
        this.chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // Clear input
        this.chatInput.value = '';

        // Add user message to UI
        this.addMessage(message, 'user');

        // Client-side commands to control the canvas without roundtrip
        if (this.handleLocalCommand(message)) {
            return;
        }

        try {
            // Show loading state?

            // Build a lightweight diagram summary to help the AI answer with context
            const diagramSummary = this.buildDiagramSummary();
            const messageWithContext = diagramSummary
                ? `${message}\n\n[Diagram Summary]\n${diagramSummary}`
                : message;

            // Prepare context (current diagram state)
            const context = {
                diagram_data: {
                    components: window.blueprintCanvas ? window.blueprintCanvas.components : [],
                    connections: window.blueprintCanvas ? window.blueprintCanvas.connections : []
                }
            };

            // Call API
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: messageWithContext,
                    context: context
                })
            });

            const data = await response.json();

            if (data.error) {
                this.addMessage(`Error: ${data.error}`, 'system');
            } else {
                this.addMessage(data.response, 'ai');
            }

        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage('Error: Failed to send message', 'system');
        }
    }

    addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        // Convert newlines to <br> for display
        const formattedText = text.replace(/\n/g, '<br>');
        messageDiv.innerHTML = formattedText;

        this.messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    buildDiagramSummary() {
        if (!window.blueprintCanvas || !window.blueprintCanvas.components) return '';
        const components = window.blueprintCanvas.components.slice(0, 40);
        const connections = window.blueprintCanvas.connections.slice(0, 80);

        const compLines = components.map(c => `- ${c.name || c.id}`);
        const connLines = connections.map(conn => `${conn.from} -> ${conn.to}`);

        const parts = [];
        if (compLines.length) {
            parts.push(`Components (${compLines.length}):\n${compLines.join('\n')}`);
        }
        if (connLines.length) {
            parts.push(`Connections (${connLines.length}):\n${connLines.join('\n')}`);
        }
        return parts.join('\n\n');
    }

    handleLocalCommand(message) {
        const normalized = message.toLowerCase();
        const isLayout = normalized.startsWith('/layout') ||
            normalized.includes('auto layout') ||
            normalized.includes('layout blueprint');

        if (isLayout && window.blueprintCanvas) {
            window.blueprintCanvas.autoLayout();
            this.addMessage('Auto layout applied to current components.', 'system');
            return true;
        }

        const wantsRealtime = normalized.includes('realtime') || normalized.includes('real-time');
        const wantsAnalytics = normalized.includes('analytics');
        const wantsGateway = normalized.includes('gateway');
        if ((wantsRealtime || wantsAnalytics || wantsGateway) && window.blueprintCanvas) {
            window.blueprintCanvas.createPresetBlueprint('realtime_analytics_gateway');
            this.addMessage('Placed a starter realtime + analytics + API gateway blueprint for you.', 'system');
            return true;
        }

        if (normalized.includes('blueprint') && window.blueprintCanvas) {
            this.generateBlueprintFromPrompt(message);
            return true;
        }

        // Quick file-import via chat: "import app/websocket.py"
        const importMatch = normalized.match(/import\s+([\\w\\/\\.\\-]+\\.py)/);
        if (importMatch) {
            const path = importMatch[1];
            this.addMessage(`Importing ${path}...`, 'system');
            this.importFile(path);
            return true;
        }

        return false;
    }

    async importFile(path) {
        try {
            const response = await fetch('/api/code/map-file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path })
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || 'Failed to import file');
            }
            if (payload.blueprint && window.blueprintCanvas) {
                window.blueprintCanvas.loadBlueprint(payload.blueprint);
                this.addMessage(`Imported ${path}: ${payload.stats?.functions || 0} functions.`, 'system');
            }
        } catch (error) {
            console.error('Chat import error:', error);
            this.addMessage(`Error importing ${path}: ${error.message}`, 'system');
        }
    }

    async generateBlueprintFromPrompt(prompt) {
        try {
            const base = window.blueprintCanvas ? {
                components: window.blueprintCanvas.components || [],
                connections: window.blueprintCanvas.connections || []
            } : null;

            const response = await fetch('/api/blueprints/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt, blueprint: base })
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || 'Failed to generate blueprint');
            }
            if (payload.blueprint && window.blueprintCanvas) {
                window.blueprintCanvas.loadBlueprint(payload.blueprint);
                this.addMessage('Generated a blueprint from your prompt.', 'system');
            }
        } catch (error) {
            console.error('Blueprint generation error:', error);
            this.addMessage(`Error generating blueprint: ${error.message}`, 'system');
        }
    }
}
