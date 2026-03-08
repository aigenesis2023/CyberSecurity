#!/usr/bin/env python3
"""
AI Data Guard Terminal — local dev server
Runs at http://localhost:8080
Serves index.html + assets/audio/* with correct MIME types.
"""
import http.server, socketserver, os

PORT = 8080
DIR  = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
    }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)
    def log_message(self, fmt, *args):
        print(f"  {self.address_string()} — {fmt % args}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.allow_reuse_address = True
    print(f"\n  AI Data Guard Terminal dev server")
    print(f"  ➜  http://localhost:{PORT}\n")
    print("  Ctrl+C to stop\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
