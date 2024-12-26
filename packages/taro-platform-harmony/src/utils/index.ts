import path from 'node:path'

export * from './api-loader'
export * from './constants'

export function parseRelativePath (from: string, to: string) {
  // TODO: 待梳理定义统一处理路径的方法: normalizePath, 分别处理路径分隔符不同，win32, darwin 等 Platform ｜ 正则表达式的不同 ｜ 方法的不同： replace、startWith
  const relativePath = path.relative(from, to).replace(/\\/g, '/')

  return /^\.{1,2}[\\/]/.test(relativePath)
    ? relativePath
    : /^\.{1,2}$/.test(relativePath)
      ? `${relativePath}/`
      : `./${relativePath}`
}
