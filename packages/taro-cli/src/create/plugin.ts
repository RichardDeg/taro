import * as path from 'node:path'

import { createPlugin } from '@tarojs/binding'
import { chalk, fs } from '@tarojs/helper'

import { getRootPath } from '../util'
import Creator from './creator'

export interface IPluginConf {
  projectName: string
  projectDir: string
  template: string
  pluginName: string
  type: string
  version: string
  description?: string
}
type IPluginOptions = Omit<IPluginConf, 'projectName' | 'version'> & {
  projectName?: string
  version?: string
}

// TODO: 看到这里了
export default class Plugin extends Creator {
  public conf: IPluginConf

  constructor (options: IPluginOptions) {
    super()
    this.conf = {
      ...options,
      projectName: path.basename(options.projectDir),
      version: this.getCliVersion()
    }
  }

  getCliVersion () {
    const pkgPath = path.join(this._rootPath, 'package.json')
    const pkg = fs.readJSONSync(pkgPath)
    return pkg.version
  }

  async create () {
    const { projectDir, template, pluginName, version, description, type } = this.conf
    const templatePath = this.templatePath(template)

    if (!fs.existsSync(templatePath)) {
      return console.log(chalk.red(`创建插件失败：找不到模板${templatePath}`))
    }

    createPlugin({
      version,
      template,
      description,
      pluginType: type,
      projectName: pluginName,
      projectRoot: projectDir,
      templateRoot: getRootPath(),
    })
  }
}

export type { Plugin as PluginCreator }

