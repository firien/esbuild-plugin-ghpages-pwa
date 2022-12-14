import esbuild from 'esbuild'
import ghPages from '../../index.js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, truncateSync, writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// gitignored
// use this file to test auto reloads
let otherFile = join(__dirname, 'javascripts', 'other.js')
if (existsSync(otherFile)) {
  truncateSync(otherFile)
} else {
  writeFileSync(otherFile, '')
}

let { plugin: githubPages, buildOptions } = ghPages({
  app: 'test',
  description: 'Probably does something cool',
  cacheTag: 4,//used to clear old browser caches
  serve: 3099,// port for local web server
  absWorkingDir: dirname(fileURLToPath(import.meta.url))
})


try {
  await esbuild.build(Object.assign(buildOptions, {
    entryPoints: [
      'javascripts/index.js',
      'stylesheets/index.css',
      'images/debug.png'
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
