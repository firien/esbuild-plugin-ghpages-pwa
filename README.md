An [esbuild](https://esbuild.github.io) plugin for small PWA that are hosted on GitHub.

Assumes the project is hosted from `main` branch's `docs/` folder. This is not the default option and needs to be [setup](https://help.github.com/articles/configuring-a-publishing-source-for-github-pages) on GitHub.

### Convention over Configuration

Assumes the following directory structure

    root
    ┣ stylesheets/
    ┃ ┣ index.css
    ┃ ┗ other.css
    ┣ javascripts/
    ┃ ┣ index.js
    ┃ ┗ other.js
    ┣ images/
    ┃ ┣ icon-192.png
    ┃ ┗ icon-512.png
    ┣ favicon.ico (optional)
    ┗ views/
      ┗ index.pug

#### Images
All images/icon-*.png will be used as icon listings in `manifest.webmanifest` and as `<link rel=apple-touch-icon>`

#### Views
All pug files will be rendered to html

##### Pug Helpers

* webAssetPath
* scriptAttributes
* iconLinks
* themeColor
* name
* desc

`views/index.pug` head tag should look something like this:

```pug
doctype html
html(lang="en")
  head
    title=name()
    meta(charset="UTF-8")
    meta(name="Description" content=desc())
    meta(name="theme-color" content=themeColor())
    meta(name="apple-mobile-web-app-capable" content="yes")
    meta(name="viewport" content="width=device-width, initial-scale=1")
    // scripts
    script&attributes(scriptAttributes('index.js'))
    // css
    link(rel='stylesheet' href=webAssetPath('index.css'))
    // icons
    link(rel="icon" href="favicon.ico" type="image/x-icon")
    each icon in iconLinks()
      link(rel=icon.rel sizes=icon.sizes href=icon.href)
    // pwa
    link(rel="manifest", href="manifest.webmanifest")
```


> node ./build.js

In development mode, a local web server serves in memory files created by esbuild. HTML files will have a simple web socket script injected that will auto reload the page when assets are modified on disk. (This is a simple page reload - no fancy HMR)

> NODE_ENV=production node ./build.js

Clears and build `docs/` dir.

---

Example build script
```js
import esbuild from 'esbuild';
import ghPages from 'esbuild-plugin-ghpages-pwa';

let { plugin: githubPages, buildOptions } = ghPages({
  app: 'rasterizer',
  description: 'Probably does something cool',
  cacheTag: 4,//used to clear old browser caches
  serve: 3014// port for local web server
})

try {
  await esbuild.build(Object.assign(buildOptions, {
    entryPoints: [
      'javascripts/index.js',
      'stylesheets/index.css',
      'images/icon-152.png',
      'images/icon-167.png',
      'images/icon-180.png',
      'images/icon-192.png',
      'images/icon-512.png'
    ],
    target: ['chrome78', 'safari13'],
    plugins: [
      githubPages
    ]
  }))
} catch (err) {
  console.error(err)
  process.exit(1)
}
```