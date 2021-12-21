import { join } from 'path';
import { createServer } from 'http';
import { parse } from 'url';
import { Buffer } from 'buffer'
import { upgrade, constructReply } from './web-socket.js';
import reloader from './reloader.js';

// holds in memory esbuild files to serve
let memoryFiles;

const getMime = (filePath) => {
  let mime;
  if ((/js$/).test(filePath)) {
    mime = 'text/javascript'
  } else if  ((/html$/).test(filePath)) {
    mime = 'text/html'
  } else if  ((/css$/).test(filePath)) {
    mime = 'text/css'
  } else if  ((/svg$/).test(filePath)) {
    mime = 'image/svg+xml'
  } else if  ((/ttf$/).test(filePath)) {
    mime = 'application/x-font-ttf'
  } else if  ((/webmanifest$/).test(filePath)) {
    mime = 'application/manifest+json'
  } else if  ((/json$/).test(filePath)) {
    mime = 'application/json'
  } else if  ((/pdf$/).test(filePath)) {
    mime = 'application/pdf'
  } else if  ((/map$/).test(filePath)) {
    mime = 'application/json'
  } else {
    mime = 'text/plain'
  }
  return mime;
}

let sockets = []

export const makeServer = (dir) => {
  let server = createServer((request, response) => {
    let uri = parse(request.url).pathname
    // if (uri.)
    //serve docs, like github
    let filePath = join(process.cwd(), 'docs', uri.replace(`/${dir}/`, ''))
    let file = memoryFiles.find(file => file.path === filePath)
    if (!file) {//assume index
      filePath = join(filePath, 'index.html')
    }
    file = memoryFiles.find(file => file.path === filePath)
    if (file) {
      // console.log(`${uri} => ${file.path}`)
      let mime = getMime(file.path)
      if (mime === 'text/html') {
        //inject web socket reload tag
        let jsCode = reloader.toString()
        let contents = file.text.replace(/(\s+)<\/head>/, `$1$1<script>(${jsCode}).call()$1$1</script>\n$1</head>`)
        let buffer = Buffer.from(contents, 'utf8')
        response.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': buffer.length
        })
        response.write(buffer)
      } else {
        response.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': file.contents.length
        })
        response.write(file.contents)
      }
      response.end()
    }
  })
  server.on('gh.esbuild', (data) => {
    memoryFiles = data
    for (let socket of sockets) {
      try {
        socket.write(constructReply({ message: 'reload' }));
      } catch (err) {
        //dead socket?
      }
    }
  });
  server.on('upgrade', (req, socket) => {
    upgrade(req, socket)
    sockets.push(socket)
  });
  return server
}

