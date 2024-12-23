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

// TODO: 看到这里了
export default class Plugin extends Creator {
  public conf: IPluginConf

  constructor (options: IPluginConf) {
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
    const { projectDir, template, pluginName } = this.conf
    const templatePath = this.templatePath(template)

    if (!fs.existsSync(templatePath)) {
      return console.log(chalk.red(`创建插件失败：找不到模板${templatePath}`))
    }

    createPlugin({
      projectRoot: projectDir,
      projectName: pluginName,
      templateRoot: getRootPath(),
      template,
      version: this.conf.version,
      description: this.conf.description,
      pluginType: this.conf.type,
    })
  }
}
