#!/usr/bin/env node

import { mkdirSync, existsSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))


const dirs = ['javascripts', 'stylesheets', 'images', 'views']
for (let dir of dirs) {
  if (!existsSync(dir)) {
    mkdirSync(dir)
  }
}

mkdirSync(join('.github', 'workflows'), { recursive: true })


cpSync(join(__dirname, '..', 'src', 'templates', 'pages.yml'), join('.github', 'workflows', 'pages.yml'))
cpSync(join(__dirname, '..', 'src', 'templates', 'index.pug'), join('views', 'index.pug'))

let name, description
if (existsSync('package.json')) {
  let pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  pkg.scripts.build = 'node ./build.js'
  writeFileSync('package.json', JSON.stringify(pkg, null, 2))
  name = pkg.name
  description = pkg.description
}

let buildTemplate = join(__dirname, '..', 'src', 'templates', 'build.js')
let builder = readFileSync(buildTemplate, 'utf8')
if (name?.length > 0) {
  builder = builder.replace('{APP}', name)
}
if (description?.length > 0) {
  builder = builder.replace('{DESCRIPTION}', description)
}
writeFileSync('build.js', builder)
