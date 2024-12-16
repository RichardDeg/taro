import * as path from 'node:path'

import { chalk, fs } from '@tarojs/helper'
import * as AdmZip from 'adm-zip'
import axios from 'axios'
import * as download from 'download-git-repo'
import * as ora from 'ora'

import { getTemplateSourceType, readDirWithFileTypes } from '../util'
import { TEMPLATE_CREATOR } from './constants'

const TEMP_DOWNLOAD_FOLDER = 'taro-temp'

export interface ITemplates {
  name: string
  value: string
  platforms?: string | string[]
  desc?: string
  compiler?: string[]
}

// TODO: 看到这里了
export default async function fetchTemplate (templateSource: string, templateRootPath: string, clone?: boolean): Promise<ITemplates[]> {
  const templateSourceType = getTemplateSourceType(templateSource)
  const isGitTemplate = templateSourceType === 'git'
  const isUrlTemplate = templateSourceType === 'url'

  const templateDownloadDir = path.join(templateRootPath, TEMP_DOWNLOAD_FOLDER)
  let name: string

  // TODO: 尝试将最外层 promise 转为 async... await... 写法，是否可行
  // eslint-disable-next-line no-async-promise-executor
  return new Promise<void>(async (resolve) => {
    // 下载文件的缓存目录
    if (fs.existsSync(templateDownloadDir)) await fs.remove(templateDownloadDir)
    await fs.ensureDir(templateRootPath)
    await fs.mkdir(templateDownloadDir)

    const spinner = ora(`正在从 ${templateSource} 拉取远程模板...`).start()
    if (isGitTemplate) {
      name = path.basename(templateSource)
      download(templateSource, path.join(templateDownloadDir, name), { clone }, async error => {
        if (error) {
          spinner.color = 'red'
          spinner.fail(chalk.red('拉取远程模板仓库失败！'))
          console.log(error)
          await fs.remove(templateDownloadDir)
        } else {
          spinner.color = 'green'
          spinner.succeed(`${chalk.grey('拉取远程模板仓库成功！')}`)
        }
        return resolve()
      })
    }
    if (isUrlTemplate) {
      try {
        // url 模板源，因为不知道来源名称，临时取名方便后续开发者从列表中选择
        name = 'from-remote-url'
        const zipPath = path.join(templateDownloadDir, `${name}.zip`)
        const unzipDir = path.join(templateDownloadDir, name)
        const response = await axios.get<fs.ReadStream>(templateSource, { responseType: 'stream' })
        const ws = fs.createWriteStream(zipPath)
        response.data.pipe(ws)

        ws.on('finish', () => {
          /* 解压 zip 包 到 unzipDir 目录下 */
          const zip = new AdmZip(zipPath)
          zip.extractAllTo(unzipDir, true)

          const files = readDirWithFileTypes(unzipDir).filter(
            file => !file.name.startsWith('.') && file.isDirectory && file.name !== '__MACOSX'
          )
          if (files.length !== 1) {
            spinner.color = 'red'
            spinner.fail(chalk.red(`拉取远程模板仓库失败！\n${new Error('远程模板源组织格式错误')}`))
          } else {
            spinner.color = 'green'
            spinner.succeed(`${chalk.grey('拉取远程模板仓库成功！')}`)
            name = path.join(name, files[0].name)
          }
          return resolve()
        })
        ws.on('error', error => {
          throw error
        })
      } catch (error) {
        spinner.color = 'red'
        spinner.fail(chalk.red(`拉取远程模板仓库失败！\n${error}`))
        await fs.remove(templateDownloadDir)
        return resolve()
      }
    }
  }).then(async () => {
    // 下载失败，只显示默认模板
    const templateDir = name ? path.join(templateDownloadDir, name) : ''
    if (!fs.existsSync(templateDir)) return []

    const packageJsonPath = path.join(templateDir, 'package.json')
    const packageJsonTmplPath = path.join(templateDir, 'package.json.tmpl')
    const isTemplateGroup = !fs.existsSync(packageJsonPath) && !fs.existsSync(packageJsonTmplPath)

    // TODO: 看到这里了
    if (isTemplateGroup) {
      // 模板组
      const files = readDirWithFileTypes(templateDir)
        .filter(file => !file.name.startsWith('.') && file.isDirectory && file.name !== '__MACOSX')
        .map(file => file.name)
      await Promise.all(
        files.map(file => {
          const src = path.join(templateDir, file)
          const dest = path.join(templateRootPath, file)
          return fs.move(src, dest, { overwrite: true })
        })
      )
      await fs.remove(templateDownloadDir)

      const res: ITemplates[] = files.map(name => {
        const creatorFile = path.join(templateRootPath, name, TEMPLATE_CREATOR)

        if (!fs.existsSync(creatorFile)) return { name, value: name }
        const { name: displayName, platforms = '', desc = '', isPrivate = false, compiler } = require(creatorFile)
        if (isPrivate) return null

        return {
          name: displayName || name,
          value: name,
          platforms,
          compiler,
          desc
        }
      }).filter(Boolean) as ITemplates[]

      return res
    } else {
      // 单模板
      await fs.move(templateDir, path.join(templateRootPath, name), { overwrite: true })
      await fs.remove(templateDownloadDir)

      let res: ITemplates = { name, value: name, desc: isUrlTemplate ? templateSource : '' }

      const creatorFile = path.join(templateRootPath, name, TEMPLATE_CREATOR)

      if (fs.existsSync(creatorFile)) {
        const { name: displayName, platforms = '', desc = '', compiler } = require(creatorFile)

        res = {
          name: displayName || name,
          value: name,
          platforms,
          compiler,
          desc: desc || templateSource
        }
      }

      return [res]
    }
  })
}
