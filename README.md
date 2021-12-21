An [esbuild](https://esbuild.github.io) plugin for small PWA that are hosted on GitHub.

They are all hosted on the `main` branch's `docs/` folder. This is not the default option and needs to be [setup](https://help.github.com/articles/configuring-a-publishing-source-for-github-pages) on GitHub.

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
