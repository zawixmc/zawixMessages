const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

function getContentType(filePath) {
    const ext = path.extname(filePath);
    const types = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
    };
    return types[ext] || 'text/plain';
}

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        res.writeHead(200, { 
            'Content-Type': getContentType(filePath),
            'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
	console.log("🚀 SERVER URUCHOMIONY!");
	console.log(`🌐 PORT STRONY: ${PORT}`);
	console.log(`🔗 ADRES: http://localhost:${PORT}`);
	console.log("✅ WSZYSTKO DZIAŁA POPRAWNIE!");
});

module.exports = server;