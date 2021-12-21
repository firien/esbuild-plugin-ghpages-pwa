import { rm, writeFile, readFile, readdir, stat, copyFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { sep, join, extname, basename, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pug from 'pug';
import { createHash } from 'crypto';
import pngDimensions from './png.js';
import { makeServer } from './server.js';
import { Buffer } from 'buffer';

const buildManifest = (files, opts, outdir) => {
  let name = opts.app.replace(/^\w/, c => c.toUpperCase());
  return {
    "name": name,
    "short_name": name,
    "start_url": ".",
    "display": "standalone",
    "background_color": "#555555",
    "theme_color": "#fffff0",
    "description": opts.description,
    "icons": files.filter(file => (/icon.*png/).test(file)).map((file) => {
      let size = file.match((/icon-(\d+)-/))?.[1]
      return {
        "src": file.replace(`${outdir}${sep}`, ''),
        "type": "image/png",
        "sizes": `${size}x${size}`
      }
    })
  }
}

const isProduction = process.env.NODE_ENV === 'production'

// mimic esbuild im-memory outputfile
const memoryFile = (path, text) => {
  return {
    path: join(process.cwd(), path),
    contents: new Uint8Array(Buffer.from(text, 'utf8')),
    get text() {
      return text
    }
  }
}

const buildViews = async function*(opts, files) {
  // =================== start local pug definitions
  const assetPath = function(path) {
    let extName = extname(path);
    let baseName = basename(path, extName);
    let regex = new RegExp(`${baseName}-[A-Z0-9]+\\${extName}(?!\.map)`);
    let foundAsset = files.find((asset) => {
      let name = typeof asset === 'string' ? asset : asset.path
      return regex.test(name)
    })
    if (foundAsset) {
      return foundAsset;
    } else {
      throw `could not find ${path}`;
    }
  };
  const webAssetPath = (path) => {
    let asset = assetPath(path)
    let name = typeof asset === 'string' ? asset : asset.path
    name = name.replace(process.cwd(), '')
    return name.replace(`${opts.outdir}${sep}`, '')
  }
  // include sha256 integrity attribute
  const scriptAttributes = function(path) {
    let asset = assetPath(path);
    let source, assetName
    if (asset.path) { //in memory
      source = asset.contents
      assetName = asset.path.replace(process.cwd(), '')
    } else {// a real file
      source = readFileSync(asset, 'utf8')
      assetName = asset
    }
    let sha256 = createHash('sha256').update(source).digest('base64');
    return {
      src: assetName.replace(`${opts.outdir}${sep}`, ''),
      integrity: `sha256-${sha256}`
    };
  };
  // generate <links> for icon-*.png
  const iconLinks = () => {
    let regex = /icon-.*?\.png/i;
    let links = []
    for (let file of files) {
      let name = typeof file === 'string' ? file : file.path
      if (regex.test(name)) {
        let source
        if (file.path) { //in memory
          source = Buffer.from(file.contents)
          name = name.replace(process.cwd(), '')
        } else {
          source = readFileSync(file)
        }
        let png = pngDimensions(source);
        links.push({
          rel: 'apple-touch-icon',
          sizes: `${png.width}x${png.height}`,
          href: name.replace(`${opts.outdir}${sep}`, '')
        })
      }
    }
    return links;
  };
  const themeColor = (function() {  return opts?.theme_color; }).bind(this);
  const desc = (function() {        return opts?.description; }).bind(this);
  const name = (function() {        return opts?.name;        }).bind(this);
  let locals = {
    webAssetPath,
    scriptAttributes,
    iconLinks,
    themeColor,
    desc,
    name,
    pretty: true
  };
  const views = await readdir('./views')
  for (let view of views) {
    if (/\.pug/.test(view)) {
      let filePath = resolve('./views', view);
      let html = pug.renderFile(filePath, locals);
      let newFileName = view.replace(/pug$/, 'html');
      yield {
        path: join(opts.outdir, newFileName),
        content: html
      }
    }
  }
}

export default (opts) => {
  let server;
  if (opts.serve && !isProduction) {
    let port = opts.serve ?? 3000
    server = makeServer(opts.app).listen(port)
    console.log(`http://localhost:${port}/${opts.app}/`)
  }
  let plugin = {
    name: 'githubPages',
    setup(build) {
      build.onStart(async () => {
        if (isProduction) {
          await rm(build.initialOptions.outdir, { recursive: true, force: true })
        }
      })
      build.onEnd(async (result) => {
        let files = [];
        let outdir = build.initialOptions.outdir
        // delete "js" images
        for (let file of Object.keys(result.metafile.outputs)) {
          if ((/images\/.*js.*/).test(file)) {
            if (isProduction) {
              await rm(file)
            }
          } else {
            files.push(file)
          }
        }
        // build manifest.webmanifest
        let manifest = buildManifest(files, opts, outdir)
        let manifestPath = join(outdir, 'manifest.webmanifest')
        let manifestText = JSON.stringify(manifest, null, 2)
        if (isProduction) {
          await writeFile(manifestPath, manifestText);
        } else {
          result.outputFiles.push(memoryFile(manifestPath, manifestText))
        }
        // build service.js
        let service = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'service.js'), 'utf8')
        // REPLACEMENTS
        let appFiles = files.map(file => file.replace(`${outdir}${sep}`, `${sep}${opts.app}${sep}`))
        let urls = JSON.stringify(appFiles, null, 2);
        service = service.replace('%PREFIX%', opts.app.toUpperCase())
        service = service.replace("['%URLS%']", urls)
        service = service.replace('%TAG%', opts.cacheTag || 1)
        let servicePath = join(outdir, 'service.js')
        if (isProduction) {
          await writeFile(servicePath, service);
        } else {
          result.outputFiles.push(memoryFile(servicePath, service))
        }
        // build html
        let viewOptions = Object.assign({}, opts, { outdir });
        for await (let file of buildViews(viewOptions, isProduction ? files : result.outputFiles)) {
          if (isProduction) {
            await writeFile(file.path, file.content);
          } else {
            result.outputFiles.push(memoryFile(file.path, file.content))
            // console.log(file.content)
          }
        }
        // copy favicon
        if (isProduction) {
          try {
            let favicon = 'favicon.ico';
            await stat(favicon)
            await copyFile(favicon, join(outdir, favicon))
          } catch (err) {
            console.log(err)
          }
        }
        server?.emit('gh.esbuild', result.outputFiles);
      });
    }
  }
  let buildOptions = {
    bundle: true,
    sourcemap: true,
    entryNames: '[dir]/[name]-[hash]',
    treeShaking: true,
    outdir: 'docs',
    // minify: true, //breaks script integrity check
    loader: { '.png': 'file' },
    assetNames: 'images/[name]-[hash]',
    metafile: true,
    watch: !isProduction,
    // ignoreAnnotations: true,
    write: isProduction,
  }
  return { plugin, buildOptions};
}

