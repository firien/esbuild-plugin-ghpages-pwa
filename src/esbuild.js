import { rm, writeFile, readFile, readdir, stat, copyFile } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import { sep, join, extname, basename, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pug from 'pug';
import { createHash } from 'crypto';
import pngDimensions from './png.js';
import { makeServer } from './server.js';
import { Buffer } from 'buffer';

const __dirname = dirname(fileURLToPath(import.meta.url))

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
    path,
    contents: new Uint8Array(Buffer.from(text, 'utf8')),
    get text() {
      return text
    }
  }
}

const buildViews = async function*(opts, files) {
  // console.log(files)
  const fullOutDir = opts.fullOutDir
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
    if (typeof asset === 'string') {
      return asset.replace(`${opts.outdir}${sep}`, '')
    } else {
      return asset.path.replace(`${fullOutDir}${sep}`, '')
    }
  }
  // include sha256 integrity attribute
  const scriptAttributes = function(path) {
    let asset = assetPath(path);
    let source, assetName
    if (asset.path) { //in memory
      source = asset.contents
      assetName = asset.path.replace(`${fullOutDir}${sep}`, '')
    } else {// a real file
      let path = opts.absWorkingDir ? join(opts.absWorkingDir, asset) : asset
      source = readFileSync(path, 'utf8')
      assetName = asset.replace(`${opts.outdir}${sep}`, '')
    }
    let sha256 = createHash('sha256').update(source).digest('base64');
    return {
      src: assetName,
      integrity: `sha256-${sha256}`,
      type: 'module'
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
  const themeColor = () => opts?.theme_color
  const desc = () => opts?.description
  const name = () => opts?.name
  let locals = {
    webAssetPath,
    scriptAttributes,
    iconLinks,
    themeColor,
    desc,
    name,
    pretty: true
  };
  if (opts.pugLocals) {
    Object.assign(locals, opts.pugLocals)
  }
  const baseViewPath = opts.absWorkingDir ? join(opts.absWorkingDir, './views') : './views'
  const views = await readdir(baseViewPath)
  for (let view of views) {
    if (/\.pug/.test(view)) {
      let filePath = resolve(baseViewPath, view);
      let html = pug.renderFile(filePath, locals);
      let newFileName = view.replace(/pug$/, 'html');
      yield {
        path: join(opts.outdir, newFileName),
        content: html
      }
    }
  }
}

const defaultOutDir = 'docs'

export default (opts) => {
  let plugin = {
    name: 'githubPages',
    setup(build) {
      let server;
      const fullOutDir = join(opts.absWorkingDir ?? process.cwd(), build.initialOptions.outdir)
      if (isProduction) {
        build.initialOptions.inject = [join(__dirname, 'pwa.js')]
      } else {
        build.initialOptions.inject = [join(__dirname, 'reloader.js')]
        if (opts.serve) {
          let port = opts.serve ?? 3000
          server = makeServer(opts.app, fullOutDir).listen(port)
          console.log(`http://localhost:${port}/${opts.app}/`)
        }
      }
      build.onStart(async () => {
        if (isProduction) {
          // clear outdir
          await rm(build.initialOptions.outdir, { recursive: true, force: true })
        }
      })
      build.onEnd(async (result) => {
        console.log('build!!!')
        let files = [];
        let outdir = build.initialOptions.outdir
        // delete "js" images
        for (let file of Object.keys(result.metafile.outputs)) {
          if ((/images\/.*js.*/).test(file)) {
            if (isProduction) {
              let path = file.replace(`${outdir}${sep}`, '')
              await rm(join(fullOutDir, path))
            }
          } else {
            files.push(file)
          }
        }
        // build manifest.webmanifest
        let manifest = buildManifest(files, opts, fullOutDir)
        let manifestPath = join(fullOutDir, 'manifest.webmanifest')
        let manifestText = JSON.stringify(manifest, null, 2)
        if (isProduction) {
          await writeFile(manifestPath, manifestText);
        } else {
          result.outputFiles.push(memoryFile(manifestPath, manifestText))
        }
        // build html
        let viewOptions = Object.assign({}, opts, { outdir, fullOutDir });
        for await (let file of buildViews(viewOptions, isProduction ? files : result.outputFiles)) {
          let fullPath = join(fullOutDir, basename(file.path))
          if (isProduction) {
            await writeFile(fullPath, file.content);
          } else {
            result.outputFiles.push(memoryFile(fullPath, file.content))
          }
          files.push(file.path)
        }
        // include root
        files.push(`/${opts.app}/`)
        // build service.js
        let service = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'service.js'), 'utf8')
        // REPLACEMENTS
        let appFiles = files.map(file => file.replace(`${outdir}${sep}`, `/${opts.app}/`))
        let urls = JSON.stringify(appFiles, null, 2);
        service = service.replace('%PREFIX%', opts.app.toUpperCase())
        service = service.replace("['%URLS%']", urls)
        service = service.replace('%TAG%', opts.cacheTag || 1)
        let servicePath = join(fullOutDir, 'service.js')
        if (isProduction) {
          await writeFile(servicePath, service);
        } else {
          result.outputFiles.push(memoryFile(servicePath, service))
        }
        // copy favicon
        if (isProduction) {
          try {
            let favicon = 'favicon.ico';
            await stat(favicon)
            await copyFile(favicon, join(fullOutDir, favicon))
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
    outdir: defaultOutDir,
    // minify: true, //breaks script integrity check
    loader: { '.png': 'file' },
    assetNames: 'images/[name]-[hash]',
    metafile: true,
    watch: !isProduction,
    // ignoreAnnotations: true,
    write: isProduction,
  }
  if (opts.absWorkingDir) {
    buildOptions.absWorkingDir = opts.absWorkingDir
  }
  return { plugin, buildOptions };
}

