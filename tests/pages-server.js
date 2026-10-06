const { spawn } = require('child_process');
// Static python3 server for a directory, sending GitHub Pages' Cache-Control so stale HTTP-cache reads show up.
// Port 0: the OS picks a free port and the server prints it, so parallel or leftover runs never collide.
// Used by sw-test.js and upgrade-test.js (not a suite itself; run-all.sh lists suites by name).
const PAGES_LIKE_SERVER = `
import http.server, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'max-age=600')
        super().end_headers()
    def log_message(self, *a): pass
s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
print(s.server_address[1], flush=True)
s.serve_forever()
`;
const START_TIMEOUT_MS = 10000;

// resolves { base, server } once listening; rejects if python exits or prints nothing in time
function startPagesServer(dir) {
  return new Promise((resolve, reject) => {
    const server = spawn('python3', ['-c', PAGES_LIKE_SERVER], { cwd: dir, stdio: ['ignore', 'pipe', 'inherit'] });
    const timer = setTimeout(() => { server.kill(); reject(new Error('http.server did not start')); }, START_TIMEOUT_MS);
    server.on('exit', code => { clearTimeout(timer); reject(new Error('http.server exited early, code ' + code)); });
    server.stdout.once('data', d => {
      clearTimeout(timer);
      resolve({ base: `http://127.0.0.1:${parseInt(d.toString(), 10)}/`, server });
    });
  });
}

module.exports = { startPagesServer };
