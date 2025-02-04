import { join } from 'path';
import { createServer } from 'http';
import { parse } from 'url';

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

let clients = []

export const makeServer = (dir) => {
  let server = createServer((request, response) => {
    let uri = parse(request.url).pathname
    if (uri === '/reload') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      })
      const data = `event: ping\ndata: hello\n\n`;
      response.write(data)
      const clientId = Date.now()
      const newClient = {
        id: clientId,
        response
      }
      clients.push(newClient)
      request.on('close', () => {
        console.log(`${clientId} Connection closed`)
        clients = clients.filter(client => client.id !== clientId)
      })
      return
    }
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
      response.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': file.contents.length
      })
      response.write(file.contents)
      response.end()
    }
  })
  server.on('gh.esbuild', (data) => {
    memoryFiles = data
    // send to event source
    for (const client of clients) {
      client.response.write(`event: message\ndata: reload\n\n`)
    }
  })
  return server
}

