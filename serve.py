# Local preview server for the notebook: python3 serve.py, then open http://localhost:8000
# Same as `python3 -m http.server 8000`, except it tells the browser not to keep old
# copies of the files, so after a `git pull` a normal refresh shows the new version.
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

print(f'Serving the notebook at http://localhost:{PORT}  (Ctrl+C to stop)')
http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler).serve_forever()
