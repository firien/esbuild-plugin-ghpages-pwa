import { rm, writeFile, readFile, readdir, stat, copyFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { sep, join, extname, basename, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pug from 'pug';
import { createHash } from 'crypto';
import pngDimensions from './png.js';
import makeServer from './server.js';


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

const buildView = async (opts, files) => {
  // =================== start local pug definitions
  const assetPath = function(path) {
    let extName = extname(path);
    let baseName = basename(path, extName);
    let regex = new RegExp(`${baseName}-[A-Z0-9]+\\${extName}(?!\.map)`);
    let foundAsset = files.find(asset => regex.test(asset))
    if (foundAsset) {
      return foundAsset;
    } else {
      throw `could not find ${path}`;
    }
  };
  const webAssetPath = (path) => {
    return assetPath(path).replace(`${opts.outdir}${sep}`, '')
  }
  // include sha256 integrity attribute
  const scriptAttributes = function(path) {
    let asset = assetPath(path)
    let source = readFileSync(asset, 'utf8')
    let sha256 = createHash('sha256').update(source).digest('base64');
    return {
      src: asset.replace(`${opts.outdir}${sep}`, ''),
      integrity: `sha256-${sha256}`
    };
  };
  // generate <links> for icon-*.png
  const iconLinks = () => {
    let regex = /icon-.*?\.png/i;
    let links = []
    for (let file of files) {
      if (regex.test(file)) {
        let source = readFileSync(file)
        let png = pngDimensions(source);
        links.push({
          rel: 'apple-touch-icon',
          sizes: `${png.width}x${png.height}`,
          href: file.replace(`${opts.outdir}${sep}`, '')
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
      await writeFile(join(opts.outdir, newFileName), html);
    }
  }
}

export default (opts) => {
  let server;
  if (opts.serve) {
    let port = opts.serve ?? 3000
    server = makeServer(opts.app).listen(port)
    console.log(`http://localhost:${port}/${opts.app}/`)
  }
  let plugin = {
    name: 'githubPages',
    setup(build) {
      build.onStart(async () => {
        await rm(build.initialOptions.outdir, { recursive: true, force: true })
      })
      build.onEnd(async (result) => {
        let files = [];
        let outdir = build.initialOptions.outdir
        // delete "js" images
        for (let file of Object.keys(result.metafile.outputs)) {
          if ((/images\/.*js.*/).test(file)) {
            await rm(file)
          } else {
            files.push(file)
          }
        }
        // build manifest.webmanifest
        let manifest = buildManifest(files, opts, outdir)
        let manifestPath = join(outdir, 'manifest.webmanifest')
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        // build service.js
        let service = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'service.js'), 'utf8')
        // REPLACEMENTS
        let appFiles = files.map(file => file.replace(`${outdir}${sep}`, `${sep}${opts.app}${sep}`))
        let urls = JSON.stringify(appFiles, null, 2);
        service = service.replace('%PREFIX%', opts.app.toUpperCase())
        service = service.replace("['%URLS%']", urls)
        service = service.replace('%TAG%', opts.cacheTag)        
        let servicePath = join(outdir, 'service.js')
        await writeFile(servicePath, service);
        // build html
        await buildView(Object.assign({}, opts, { outdir }), files)
        // copy favicon
        try {
          let favicon = 'favicon.ico';
          await stat(favicon)
          await copyFile(favicon, join(outdir, favicon))
        } catch (err) {
          console.log(err)
        }
        server?.emit('esbuild');
      });
    }
  }
  return plugin;
}

