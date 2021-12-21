import * as fs from 'fs';
import { join } from 'path';
import { createServer } from 'http';
import { parse } from 'url';
import { parseMessage, constructReply, generateAcceptValue } from './web-socket.js';

export default (dir) => {
  let server = createServer((request, response) => {
    let uri = parse(request.url).pathname
    //serve docs, like github
    let filePath = join(process.cwd(), 'docs', uri.replace(`/${dir}`, ''))
    if (fs.existsSync(filePath)) {
      if (fs.statSync(filePath).isDirectory()) {
        filePath = join(filePath, "index.html")
        let stat = fs.statSync(filePath)
        response.writeHead(200, {
          'Content-Type': "text/html",
          'Content-Length': stat.size
        })
        let readStream = fs.createReadStream(filePath);
        readStream.pipe(response);
      } else {
        let stat = fs.statSync(filePath)
        let mime;
        if ((/js$/).test(filePath)) {
          mime = "text/javascript"
        } else if  ((/html$/).test(filePath)) {
          mime = "text/html"
        } else if  ((/css$/).test(filePath)) {
          mime = "text/css"
        } else if  ((/svg$/).test(filePath)) {
          mime = "image/svg+xml"
        } else if  ((/ttf$/).test(filePath)) {
          mime = "application/x-font-ttf"
        } else if  ((/webmanifest$/).test(filePath)) {
          mime = "application/manifest+json"
        } else if  ((/json$/).test(filePath)) {
          mime = "application/json"
        } else if  ((/pdf$/).test(filePath)) {
          mime = "application/pdf"
        } else {
          mime = 'text/plain'
        }
        response.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': stat.size
        })
        let readStream = fs.createReadStream(filePath);
        readStream.pipe(response);
      }
    }
  })
  server.on('upgrade', (req, socket) => {
    if (req.headers['upgrade'] !== 'websocket') {
      socket.end('HTTP/1.1 400 Bad Request');
      return;
    }
    // Read the websocket key provided by the client: 
    const acceptKey = req.headers['sec-websocket-key']; 
    // Generate the response value to use in the response: 
    const hash = generateAcceptValue(acceptKey); 
    // Write the HTTP response into an array of response lines: 
    const responseHeaders = [ 'HTTP/1.1 101 Web Socket Protocol Handshake', 'Upgrade: WebSocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${hash}` ]; 
    // Read the subprotocol from the client request headers:
    const protocol = req.headers['sec-websocket-protocol'];
    // If provided, they'll be formatted as a comma-delimited string of protocol
    // names that the client supports; we'll need to parse the header value, if
    // provided, and see what options the client is offering:
    const protocols = !protocol ? [] : protocol.split(',').map(s => s.trim());
    // To keep it simple, we'll just see if JSON was an option, and if so, include
    // it in the HTTP response:
    if (protocols.includes('json')) {
      // Tell the client that we agree to communicate with JSON data
      responseHeaders.push(`Sec-WebSocket-Protocol: json`);
    }
    // Write the response back to the client socket, being sure to append two 
    // additional newlines so that the browser recognises the end of the response 
    // header and doesn't continue to wait for more header data: 
    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
    socket.on('data', (buffer) => {
      const message = parseMessage(buffer);
      if (message) {
        // For our convenience, so we can see what the client sent
        console.log(message);
        // We'll just send a hardcoded message in this example 
        socket.write(constructReply({ message: 'Hello from the server!' })); 
      } else if (message === null) { 
        // console.log('WebSocket connection closed by the client.'); 
      }
    });
    server.on('esbuild', () => {
      socket.write(constructReply({ message: 'reload' })); 
    });
  });
  return server
}

