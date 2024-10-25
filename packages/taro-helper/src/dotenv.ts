import * as path from 'node:path'
import * as fs from 'fs-extra'

import { parse } from 'dotenv'
import { expand } from 'dotenv-expand'

import type { IProjectConfig } from '@tarojs/taro/types/compile'

// 支持 --env-prefix=TARO_APP_,aa 类型参数
export const formatPrefix = (prefixs: string | string[] = ['TARO_APP_']): string[] => {
  const prefixsArr = (Array.isArray(prefixs) ? prefixs : prefixs.split(',')).map(prefix => prefix.trim()).filter(prefix => !!prefix)
  return prefixsArr
}

// 使用 dotenv 库，解析获取所有 .env[.*][.locol] 文件内容
const parseEnvFiles = (root:string, envFiles: Set<string>): Record<string, string> => {
  let mergedEnvFileContent = {}

  const readEnvFileFn = (envFilePath: string) => {
    if (!fs.existsSync(envFilePath)) return
    const targetEnvFileContent = parse(fs.readFileSync(envFilePath))
    mergedEnvFileContent = { ...mergedEnvFileContent, ...targetEnvFileContent }
  }

  envFiles.forEach(envFilePath => {
    readEnvFileFn(path.resolve(root, envFilePath))
  })

  return mergedEnvFileContent
}

// 获取 .env 相关配置文件信息
export const dotenvParse = (root: string, prefixs: string | string[] = ['TARO_APP_'], mode?: string): Record<string, string> => {
  const envFiles = new Set([`.env`, `.env.local`])
  if (mode) {
    envFiles.add(`.env.${mode}`)
    envFiles.add(`.env.${mode}.local`)
  }

  const prefixArr = formatPrefix(prefixs)
  const originEnvFileContentObj = parseEnvFiles(root, envFiles)
  const mergedEnvFileContentObj = {}
  Object.entries(originEnvFileContentObj).forEach(([envKey, envValue]) => {
    const isTargetEnv = ['TARO_APP_ID'].includes(envKey)
    const hasTargetPrefix = prefixArr.some(prefixKey => envKey.startsWith(prefixKey))
    if (isTargetEnv || hasTargetPrefix) {
      mergedEnvFileContentObj[envKey] = envValue
    }
  })
  expand({ parsed: mergedEnvFileContentObj })

  return mergedEnvFileContentObj
}

// 扩展 env
export const patchEnv = (config: IProjectConfig, expandEnv: Record<string, string>) => {
  const expandEnvStringify = {}
  for (const key in expandEnv) {
    expandEnvStringify[key] = JSON.stringify(expandEnv[key])
  }
  return {
    ...config.env,
    ...expandEnvStringify
  }
}
