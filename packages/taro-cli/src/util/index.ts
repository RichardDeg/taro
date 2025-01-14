import * as path from 'node:path'
import * as child_process from 'node:child_process'

import { chalk, fs, isWindows } from '@tarojs/helper'

export function getRootPath (): string {
  return path.resolve(__dirname, '../../')
}

export function getPkgVersion (): string {
  return require(path.join(getRootPath(), 'package.json')).version
}

export function getPkgItemByKey (key: string) {
  const packageMap = require(path.join(getRootPath(), 'package.json'))
  if (Object.keys(packageMap).indexOf(key) === -1) {
    return {}
  } else {
    return packageMap[key]
  }
}

export function printPkgVersion () {
  const taroVersion = getPkgVersion()
  console.log(`👽 Taro v${taroVersion}`)
  console.log()
}

export const getAllFilesInFolder = async (
  folder: string,
  filter: string[] = []
): Promise<string[]> => {
  let files: string[] = []
  const list = readDirWithFileTypes(folder)

  await Promise.all(
    list.map(async item => {
      const itemPath = path.join(folder, item.name)
      if (item.isDirectory) {
        const _files = await getAllFilesInFolder(itemPath, filter)
        files = [...files, ..._files]
      } else if (item.isFile) {
        if (!filter.find(rule => rule === item.name)) files.push(itemPath)
      }
    })
  )

  return files
}

export function getTemplateSourceType (url: string) {
  return /^(github|gitlab|direct):/.test(url) ?'git' :'url'
}

interface FileStat {
  name: string
  isDirectory: boolean
  isFile: boolean
}

export function readDirWithFileTypes (folder: string): FileStat[] {
  const fileList = fs.readdirSync(folder, { withFileTypes: true })
  const mergedFileList = fileList.map(file => ({
    name: file.name,
    isDirectory: file.isDirectory(),
    isFile: file.isFile()
  }))
  return mergedFileList
}

export function printDevelopmentTip (platform: string) {
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    let exampleCommand
    if (isWindows) {
      exampleCommand = `$ set NODE_ENV=production && taro build --type ${platform} --watch`
    } else {
      exampleCommand = `$ NODE_ENV=production taro build --type ${platform} --watch`
    }
    console.log(chalk.yellowBright(`Tips: 预览模式生成的文件较大，设置 NODE_ENV 为 production 可以开启压缩。
Example:
${exampleCommand}
`))
  }
}

export function clearConsole () {
  const readline = require('readline')
  if (process.stdout.isTTY) {
    const blank = '\n'.repeat(process.stdout.rows)
    console.log(blank)
    readline.cursorTo(process.stdout, 0, 0)
    readline.clearScreenDown(process.stdout)
  }
}

// TODO: 看到这里了，待区分 child_process.exec 中参数的作用 与返回值 stdout?.on 手动监听事件有什么不同
export function execCommand (params: {
  command: string
  successCallback?: (data: string) => void
  failCallback?: (data: string) => void
}) {
  const { command, successCallback, failCallback } = params
  const child = child_process.exec(command)
  child.stdout?.on('data', function (data) {
    successCallback?.(data)
  })
  child.stderr?.on('data', function (data) {
    failCallback?.(data)
  })
}

export function getPkgNameByFilterVersion (pkgString: string) {
  const versionFlagIndex = pkgString.lastIndexOf('@')
  return versionFlagIndex === 0 ? pkgString : pkgString.slice(0, versionFlagIndex)
}

export function isNil (value: any): value is null | undefined {
  return value === null || value === undefined
}
