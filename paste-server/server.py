#!/usr/bin/env python3
"""
Reply Guy Paste Server

A local HTTP server that uses PyAutoGUI to paste text into any focused application.
This bypasses browser security restrictions that block programmatic text injection.

Usage:
    python server.py

The server runs on http://localhost:8765 and accepts:
    POST /paste - Paste text from request body
    GET /health - Health check
"""

import json
import subprocess
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

try:
    import pyautogui
except ImportError:
    print("ERROR: pyautogui not installed. Run: pip install pyautogui")
    exit(1)

try:
    import pyperclip
except ImportError:
    print("ERROR: pyperclip not installed. Run: pip install pyperclip")
    exit(1)

PORT = 8765

class PasteHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        """Health check endpoint"""
        parsed = urlparse(self.path)

        if parsed.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'service': 'reply-guy-paste-server'}).encode())
        else:
            self.send_response(404)
            self._set_cors_headers()
            self.end_headers()

    def do_POST(self):
        """Handle paste request"""
        parsed = urlparse(self.path)

        if parsed.path == '/paste':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length).decode('utf-8')
                data = json.loads(body)

                text = data.get('text', '')
                delay = data.get('delay', 0.1)  # Delay before pasting (seconds)

                if not text:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self._set_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'No text provided'}).encode())
                    return

                # Copy text to clipboard
                pyperclip.copy(text)
                print(f"[Paste Server] Copied {len(text)} chars to clipboard")

                # Wait for the specified delay (allows focus to settle)
                time.sleep(delay)

                # Simulate Cmd+V (macOS) or Ctrl+V (Windows/Linux)
                import platform
                if platform.system() == 'Darwin':
                    pyautogui.hotkey('command', 'v')
                else:
                    pyautogui.hotkey('ctrl', 'v')

                print(f"[Paste Server] Pasted text: {text[:50]}...")

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'length': len(text)}).encode())

            except json.JSONDecodeError as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'error': f'Invalid JSON: {str(e)}'}).encode())

            except Exception as e:
                print(f"[Paste Server] Error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            self.send_response(404)
            self._set_cors_headers()
            self.end_headers()

    def log_message(self, format, *args):
        """Custom log format"""
        print(f"[Paste Server] {args[0]}")


def main():
    print(f"""
╔════════════════════════════════════════════════════════════╗
║             Reply Guy Paste Server                          ║
╠════════════════════════════════════════════════════════════╣
║  Running on: http://localhost:{PORT}                          ║
║                                                              ║
║  Endpoints:                                                  ║
║    POST /paste  - Paste text (body: {{"text": "..."}})         ║
║    GET  /health - Health check                               ║
║                                                              ║
║  Press Ctrl+C to stop                                        ║
╚════════════════════════════════════════════════════════════╝
""")

    server = HTTPServer(('localhost', PORT), PasteHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Paste Server] Shutting down...")
        server.shutdown()


if __name__ == '__main__':
    main()
