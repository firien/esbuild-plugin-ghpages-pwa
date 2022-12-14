// @ts-check
import { test, expect } from '@playwright/test'
import testConfig from '../../playwright.config.js'
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'


const __dirname = dirname(fileURLToPath(import.meta.url))

test('development mode - build', async ({ page }) => {
  await page.goto(`http://localhost:${testConfig.webServer.port}/test/`)
  let [h1Text] = await page.locator('h1').allTextContents()
  // from served html
  expect(h1Text).toBe('Hello')
  // h2 inserted via js
  let [h2Text] = await page.locator('h2').allTextContents()
  expect(h2Text).toBe('World')
})

test('development mode - auto reload', async ({ page }) => {
  await page.goto(`http://localhost:${testConfig.webServer.port}/test/`)
  // modify js
  appendFileSync(join(__dirname, '../site/javascripts/other.js'), 'console.log(42)')
  await page.waitForNavigation() // service worker reload
})
