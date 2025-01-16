import * as path from 'node:path'
import * as ora from 'ora'
import * as validatePkgName from 'validate-npm-package-name'

import { execCommand, getPkgNameByFilterVersion, getRootPath } from '../../util'

import type { IPluginContext } from '@tarojs/service'

const actionTypeMap = {
  install: '添加',
  uninstall: '删除'
}
const pluginTypeMap = {
  plugin: '插件',
  preset: '插件集'
}
const configKeyMap = {
  plugin: 'plugins',
  preset: 'presets'
}

type TActionType = keyof (typeof actionTypeMap)
type TPluginType = keyof (typeof pluginTypeMap)

// TODO: 看到这里了
export default (ctx: IPluginContext) => {
  ctx.registerCommand({
    name: 'global-config',
    fn ({ _, options }) {
      const { getUserHomeDir, TARO_GLOBAL_CONFIG_DIR, fs, TARO_GLOBAL_CONFIG_FILE } = ctx.helper
      const homedir = getUserHomeDir()
      if (!homedir) return console.log('找不到用户根目录')

      const registry = options.registry || options.r
      const [, action, pluginName] = _
      const rootPath = getRootPath()
      const globalConfigTemplateDir = path.join(rootPath, 'templates', 'global-config')
      const globalConfigDir = path.join(homedir, TARO_GLOBAL_CONFIG_DIR)

      function makeSureConfigExists () {
        if (fs.existsSync(globalConfigDir)) return
        const spinner = ora(`目录不存在，全局配置初始化`).start()
        try {
          fs.copySync(globalConfigTemplateDir, globalConfigDir)
          spinner.succeed(`全局配置初始化成功，${globalConfigDir}`)
        } catch (e) {
          spinner.fail(`全局配置初始化失败，${e}`)
          process.exit(1)
        }
      }

      function addOrRemovePresetOrPlugin (pluginType: TPluginType, actionType: TActionType) {
        makeSureConfigExists()

        const actionTypeName = actionTypeMap[actionType]
        const pluginTypeName = pluginTypeMap[pluginType]
        if (!pluginName) {
          console.error(`缺少要${actionTypeName}的${pluginTypeName}`)
          process.exit(1)
        }

        // TODO: 看到这里了
        const spinner = ora(`开始${actionTypeName}${pluginTypeName} ${pluginName}`).start()
        const pluginWithoutVersionName = getPkgNameByFilterVersion(pluginName)
        if (!validatePkgName(pluginWithoutVersionName).validForNewPackages) {
          spinner.fail('安装的插件名不合规！')
          process.exit(1)
        }
        let command = `cd ${globalConfigDir} && npm ${actionType} ${pluginName}`
        if (registry) {
          command += ` --registry=${registry}`
        }
        execCommand({
          command,
          successCallback (data) {
            console.log(data.replace(/\n$/, ''))
            spinner.start(`开始修改${pluginTypeName}配置`)
            const configFilePath = path.join(globalConfigDir, TARO_GLOBAL_CONFIG_FILE)
            let globalConfig
            try {
              globalConfig = fs.readJSONSync(configFilePath)
            } catch (e) {
              spinner.fail('获取配置文件失败')
            }
            const configKey = configKeyMap[pluginType]
            const configItem = globalConfig[configKey] || []
            const pluginIndex = configItem.findIndex((item) => {
              if (typeof item === 'string') return item === pluginWithoutVersionName
              if (item instanceof Array) return item?.[0] === pluginWithoutVersionName
            })
            const shouldChangeFile = !(Number(pluginIndex !== -1) ^ Number(actionType === 'uninstall'))
            if (shouldChangeFile) {
              actionType === 'install' ? configItem.push(pluginWithoutVersionName) : configItem.splice(pluginIndex, 1)
              try {
                fs.writeJSONSync(configFilePath, {
                  [configKey]: configItem
                })
              } catch (e) {
                spinner.fail(`修改配置文件失败：${e}`)
              }
            }
            spinner.succeed('修改配置文件成功')
          },
          failCallback (data) {
            spinner.stop()
            spinner.warn(data.replace(/\n$/, ''))
          }
        })
      }

      switch (action) {
        case 'add-plugin':
          addOrRemovePresetOrPlugin('plugin', 'install')
          break
        case 'remove-plugin' :
          addOrRemovePresetOrPlugin('plugin', 'uninstall')
          break
        case 'add-preset':
          addOrRemovePresetOrPlugin('preset', 'install')
          break
        case 'remove-preset' :
          addOrRemovePresetOrPlugin('preset', 'uninstall')
          break
        case 'reset':
          if (fs.existsSync(globalConfigDir)) fs.removeSync(globalConfigDir)
          fs.copySync(globalConfigTemplateDir, globalConfigDir)
          break
        default:
          console.error('请输出正确的参数')
      }
    },
    optionsMap: {
      '-r --registry [url]': '指定 npm registry',
      '-h, --help': 'output usage information'
    },
    synopsisList: [
      'taro global-config add-plugin [pluginName]',
      'taro global-config remove-plugin [pluginName]',
      'taro global-config add-preset [presetName]',
      'taro global-config remove-preset [presetName]',
      'taro global-config reset',
    ]
  })
}
