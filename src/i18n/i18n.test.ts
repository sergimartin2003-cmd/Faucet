/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EN } from '.'

const ROOT = join(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !path.includes(`${join('src', 'i18n')}`) ? [path] : []
  })
}

// Every literal passed to t() must have an English entry.
function keysIn(code: string) {
  const keys: string[] = []
  const pattern = /\bt\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g
  for (const match of code.matchAll(pattern)) keys.push(match[2].replace(/\\(['"`\\])/g, '$1'))
  return keys
}

describe('translations', () => {
  const files = sourceFiles(ROOT)
  it('has an English entry for every t() literal', () => {
    const missing = files.flatMap((file) => keysIn(readFileSync(file, 'utf8')).filter((key) => !(key in EN)).map((key) => `${file.replace(ROOT, 'src')}: ${key}`))
    expect(missing).toEqual([])
  })
  it('never interpolates inside a t() literal', () => {
    const dynamic = files.flatMap((file) => keysIn(readFileSync(file, 'utf8')).filter((key) => key.includes('${')).map((key) => `${file.replace(ROOT, 'src')}: ${key}`))
    expect(dynamic).toEqual([])
  })
})
