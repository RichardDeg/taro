import * as hooks from '../constant'

import type { IPluginContext } from '@tarojs/service'
import type { ModifyCreateTemplateCb, PageCreator } from '../../create/page'
import type { PluginCreator } from '../../create/plugin'

declare const enum CreateTemplateTypeEnum {
  /**
   * taro插件，用于扩展编译过程
   */
  PLUGIN_BUILD = 'plugin-build',
  /**
   * taro插件，用于扩展命令行
   */
  PLUGIN_COMMAND = 'plugin-command',
  /**
   * taro插件，用于扩展 taro create 自定义模版
  */
  PLUGIN_TEMPLATE = 'plugin-template',
  /**
   * taro页面，taro使用者使用
   */
  PAGE = 'page',
}

export default (ctx: IPluginContext) => {
  ctx.registerCommand({
    name: 'create',
    fn ({ _, options }) {
      const type = options.type || CreateTemplateTypeEnum.PAGE
      const name = _[1] || options.name
      const description = options.description || ''
      const { chalk } = ctx.helper
      const { appPath } = ctx.paths

      switch (type) {
        case CreateTemplateTypeEnum.PLUGIN_BUILD:
        case CreateTemplateTypeEnum.PLUGIN_COMMAND:
        case CreateTemplateTypeEnum.PLUGIN_TEMPLATE: {
          if (typeof name !== 'string') return console.log(chalk.red('请输入需要创建的插件名称'))

          const Plugin = require('../../create/plugin').default as typeof PluginCreator
          const plugin = new Plugin({
            projectDir: appPath,
            pluginName: name,
            type,
            template: 'plugin-compile',
            description,
          })
          plugin.create()
          break
        }
        case CreateTemplateTypeEnum.PAGE: {
          if (typeof name !== 'string') return console.log(chalk.red('请输入需要创建的页面名称'))
          const { afterCreate, templateSource, framework, css, typescript, clone, subpkg, dir } = options
          const Page = require('../../create/page').default as typeof PageCreator
          const page = new Page({
            projectDir: appPath,
            pageName: name,
            pageDir: dir,
            framework,
            css,
            typescript,
            clone,
            templateSource,
            subpkg,
            description,
            afterCreate,
            // TODO: 待定函数的命名
            async modifyCreateTemplate (cb: ModifyCreateTemplateCb) {
              await ctx.applyPlugins({ name: hooks.MODIFY_CREATE_TEMPLATE, opts: cb })
            }
          })
          page.create()
          break
        }
      }
    },
    optionsMap: {
      '--name [name]': '名称',
      '--dir [dir]': '路径',
      '--subpkg [subpkg]': '分包路径',
      '--description [description]': '介绍',
      '--type [type]': '模版类型(page(默认)|plugin-command|plugin-build|plugin-template)'
    },
    synopsisList: [
      'taro create page',
      'taro create --name=page --description=desc',
      'taro create my-plugin --type=plugin-command',
    ]
  })
}
