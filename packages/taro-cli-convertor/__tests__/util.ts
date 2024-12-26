import generate from '@babel/generator'
import * as t from '@babel/types'

// 最低限度的转义： https://github.com/mathiasbynens/jsesc#minimal
export function generateMinimalEscapeCode (ast: t.File) {
  return generate(ast as any, {
    jsescOption: {
      minimal: true,
    },
  }).code
}

// 自定义序列化器函数，用于去除反斜杠const
export const removeBackslashesSerializer = {
  test: (value) => typeof value === 'string',
  print: (value) => value.replace(/\\/g, '')
}

export const changeBackslashesSerializer = {
  test: (value) => typeof value === 'string',
  // TODO: 待梳理定义统一处理路径的方法: normalizePath, 分别处理路径分隔符不同，win32, darwin 等 Platform ｜ 正则表达式的不同 ｜ 方法的不同： replace、startWith
  print: (value) => value.replace(/\\/g, '/').replace(/\/\//g, '/')
}
