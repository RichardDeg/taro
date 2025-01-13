import * as path from 'node:path'
// 试试参考下：https://nodejs.org/docs/latest/api/zlib.html
// TODO: 这个包已废弃，找找新的轮子
import * as AdmZip from 'adm-zip'
// TODO: 这个包已废弃，找找新的轮子
import * as download from 'download-git-repo'
import * as ora from 'ora'
import axios from 'axios'
import { chalk, fs } from '@tarojs/helper'

import { getTemplateSourceType, readDirWithFileTypes } from '../util'
import { TEMPLATE_CREATOR } from './constants'

import type { FileStat } from '@tarojs/helper'

const TEMP_DOWNLOAD_FOLDER = 'taro-temp'

export interface ITemplates {
  name: string
  value: string
  platforms?: string | string[]
  desc?: string
  compiler?: string[]
}

export default async function fetchTemplate (templateSource: string, templateRootPath: string, clone?: boolean): Promise<ITemplates[]> {
  const templateSourceType = getTemplateSourceType(templateSource)
  const isGitTemplate = templateSourceType === 'git'
  const isUrlTemplate = templateSourceType === 'url'

  // 下载文件的缓存目录
  const templateDownloadDir = path.join(templateRootPath, TEMP_DOWNLOAD_FOLDER)
  if (fs.existsSync(templateDownloadDir)) await fs.remove(templateDownloadDir)
  await fs.ensureDir(templateRootPath)
  await fs.mkdir(templateDownloadDir)

  const spinner = ora(`正在从 ${templateSource} 拉取远程模板...`).start()

  // eslint-disable-next-line no-async-promise-executor
  return new Promise<{ error: string; templateSourceName: string } >(async (resolve) => {
    if (isGitTemplate) {
      const templateSourceName = path.basename(templateSource)
      download(templateSource, path.join(templateDownloadDir, templateSourceName), { clone }, async error => {
        if (error) await fs.remove(templateDownloadDir)
        return resolve({ error, templateSourceName })
      })
    }
    if (isUrlTemplate) {
      try {
        // url 模板源，因为不知道来源名称，临时取名方便后续开发者从列表中选择
        const originTemplateSourceName = 'from-remote-url'
        const zipPath = path.join(templateDownloadDir, `${originTemplateSourceName}.zip`)
        const unzipDir = path.join(templateDownloadDir, originTemplateSourceName)
        const response = await axios.get<fs.ReadStream>(templateSource, { responseType: 'stream' })
        const ws = fs.createWriteStream(zipPath)
        response.data.pipe(ws)

        ws.on('finish', () => {
          /* 解压 zip 包 到 unzipDir 目录下 */
          const zip = new AdmZip(zipPath)
          zip.extractAllTo(unzipDir, true)

          const files = readDirWithFileTypes(unzipDir).filter(filterFileByStatFn)
          const isSuccessful = files.length === 1
          const error = !isSuccessful ? `${new Error('远程模板源组织格式错误')}` : ''
          const mergedTemplateSourceName = isSuccessful ? path.join(originTemplateSourceName, files[0].name) : originTemplateSourceName
          return resolve({ error, templateSourceName: mergedTemplateSourceName })
        })
        ws.on('error', error => {
          throw error
        })
      } catch (error) {
        await fs.remove(templateDownloadDir)
        return resolve(error)
      }
    }
  }).then(({ error, templateSourceName }) => {
    if (error) {
      spinner.color = 'red'
      spinner.fail(chalk.red(`拉取远程模板仓库失败！\n${error}`))
      console.log(error)
    } else {
      spinner.color = 'green'
      spinner.succeed(`${chalk.grey('拉取远程模板仓库成功！')}`)
    }
    return templateSourceName
  }).then(async (templateSourceName: string) => {
    const templateDir = templateSourceName ? path.join(templateDownloadDir, templateSourceName) : ''

    /*************************** 默认空模板 **********************************/
    if (!fs.existsSync(templateDir)) return []

    const packageJsonPath = path.join(templateDir, 'package.json')
    const packageJsonTmplPath = path.join(templateDir, 'package.json.tmpl')
    const hasSingleTemplate = fs.existsSync(packageJsonPath) || fs.existsSync(packageJsonTmplPath)

    /*************************** 单模板 *************************************/
    if (hasSingleTemplate) {
      await fs.move(templateDir, path.join(templateRootPath, templateSourceName), { overwrite: true })
      await fs.remove(templateDownloadDir)

      const defaultTemplateDesc = isUrlTemplate ? templateSource : ''
      const mergedTemplateItem = transformFile2Template(templateRootPath, templateSourceName, defaultTemplateDesc)
      return [mergedTemplateItem]
    }

    /*************************** 模板组 *************************************/
    const files = readDirWithFileTypes(templateDir)
    const mergedFiles = files.filter(filterFileByStatFn)

    await Promise.all(mergedFiles.map(({ name: filename }) => {
      const src = path.join(templateDir, filename)
      const dest = path.join(templateRootPath, filename)
      return fs.move(src, dest, { overwrite: true })
    }))
    await fs.remove(templateDownloadDir)

    const mergedTemplateList: ITemplates[] = []
    for(const file of mergedFiles) {
      const mergedTemplateItem = transformFile2Template(templateRootPath, file.name)
      mergedTemplateList.push(mergedTemplateItem)
    }
    return mergedTemplateList
  })
}

const transformFile2Template = (templateRootPath: string, filename: string, defaultDesc?: string):ITemplates => {
  const mergedTemplate: ITemplates = { name: filename, value: filename, desc: defaultDesc }
  const creatorFile = path.join(templateRootPath, filename, TEMPLATE_CREATOR)

  if (fs.existsSync(creatorFile)) {
    const { name, platforms, desc, isPrivate, compiler } = require(creatorFile)
    // 私有化模版不展示
    if (!isPrivate) {
      mergedTemplate.name = name || filename || ''
      mergedTemplate.desc = desc || defaultDesc || ''
      mergedTemplate.platforms = platforms || ''
      mergedTemplate.compiler = compiler
    }
  }

  return mergedTemplate
}

const filterFileByStatFn = ({ name, isDirectory }: FileStat): boolean => {
  return isDirectory && !name.startsWith('.') && name !== '__MACOSX'
}
