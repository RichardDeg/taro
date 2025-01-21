import * as path from 'node:path'
import * as envinfo from 'envinfo'

import { getPkgVersion } from '../../util'

import type { IPluginContext } from '@tarojs/service'

export default (ctx: IPluginContext) => {
  ctx.registerCommand({
    name: 'info',
    async fn ({ _ }) {
      const hasRnInCommand = _[1] === 'rn'
      const { fs, chalk, PROJECT_CONFIG, UPDATE_PACKAGE_LIST } = ctx.helper
      const { appPath, configPath } = ctx.paths

      if (!configPath || !fs.existsSync(configPath)) {
        console.log(chalk.red(`找不到项目配置文件${PROJECT_CONFIG}，请确定当前目录是 Taro 项目根目录!`))
        process.exit(1)
      }

      if (hasRnInCommand) {
        const tempPath = path.join(appPath, '.rn_temp')
        if (fs.lstatSync(tempPath).isDirectory()) {
          process.chdir('.rn_temp')
        }
      }

      const info = await envinfo.run({
        System: ['OS', 'Shell'],
        Binaries: ['Node', 'Yarn', 'npm'],
        npmPackages: [...UPDATE_PACKAGE_LIST, 'react', 'react-native', 'expo', 'taro-ui'],
        npmGlobalPackages: ['typescript']
      }, { title: `Taro CLI ${getPkgVersion()} environment info` })
      console.log(info)
    },
    synopsisList: [
      'taro info',
      'taro info rn'
    ]
  })
}


