from __future__ import annotations
import http.server
from pathlib import Path
import webbrowser

ROOT=Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),Handler)
print('Открыто: http://127.0.0.1:8765/  (Ctrl+C для остановки)',flush=True)
webbrowser.open('http://127.0.0.1:8765/')
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
