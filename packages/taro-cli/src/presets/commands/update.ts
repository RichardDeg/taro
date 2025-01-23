import * as path from 'node:path'
import * as inquirer from 'inquirer'
import * as getLatestVersion from 'latest-version'
import * as ora from 'ora'
import * as semver from 'semver'
import { NpmType } from '@tarojs/binding'

import packagesManagement from '../../config/packagesManagement'
import { execCommand, getPkgItemByKey } from '../../util'

import type { IPluginContext } from '@tarojs/service'

export default (ctx: IPluginContext) => {
  ctx.registerCommand({
    name: 'update',
    async fn ({ _, options }) {
      const [, updateType, version] = _ as [string, ('self' | 'project')?, string?]
      const { appPath, configPath } = ctx.paths
      const { chalk, fs, PROJECT_CONFIG, UPDATE_PACKAGE_LIST } = ctx.helper
      let npm = options.npm

      /** 更新全局的 Taro CLI */
      async function updateSelf () {
        const spinner = ora('正在获取最新版本信息...').start()
        const taroVersion = await getSemanticVersion(version, chalk)
        spinner.stop()
        console.log(chalk.green(`Taro 最新版本：${taroVersion}\n`))

        if(!npm) npm = await askNpm()
        const command = `${packagesManagement[npm].globalCommand}@${taroVersion}`
        execUpdate(command, taroVersion, true)
      }

      /** 更新当前项目中的 Taro 相关依赖 */
      async function updateProject () {
        if (!configPath || !fs.existsSync(configPath)) {
          console.log(chalk.red(`找不到项目配置文件 ${PROJECT_CONFIG}，请确定当前目录是 Taro 项目根目录!`))
          process.exit(1)
        }

        const spinner = ora('正在获取最新版本信息...').start()
        const taroVersion = await getSemanticVersion(version, chalk)
        spinner.stop()

        const pkgPath = path.join(appPath, 'package.json')
        const pkgMap = require(pkgPath)
        const oldVersion = pkgMap.dependencies['@tarojs/taro']
        // 更新 @tarojs/* 版本和 NervJS 版本
        Object.keys(pkgMap.dependencies || {}).forEach((key) => {
          if (UPDATE_PACKAGE_LIST.indexOf(key) !== -1) {
            pkgMap.dependencies[key] = taroVersion
          }
        })
        Object.keys(pkgMap.devDependencies || {}).forEach((key) => {
          if (UPDATE_PACKAGE_LIST.indexOf(key) !== -1) {
            pkgMap.devDependencies[key] = taroVersion
          }
        })

        // 写入package.json
        try {
          await fs.writeJson(pkgPath, pkgMap, { spaces: '\t' })
          console.log(chalk.green(`项目当前 Taro 版本：${oldVersion}，Taro 最新版本：${taroVersion}，更新项目 package.json 成功！`))
          console.log()
        } catch (err) {
          console.error(err)
        }

        if(!npm) npm = await askNpm()
        const command = packagesManagement[npm].command
        execUpdate(command, taroVersion)
      }

      if (updateType === 'self') return updateSelf()
      if (updateType === 'project') return updateProject()

      console.log(chalk.red('命令错误:'))
      console.log(`${chalk.green('taro update self [version]')} 更新 Taro 开发工具 taro-cli 到指定版本或 Taro3 的最新版本`)
      console.log(`${chalk.green('taro update project [version]')} 更新项目所有 Taro 相关依赖到指定版本或 Taro3 的最新版本`)
    },
    optionsMap: {
      '--npm [npm]': '包管理工具',
      '-h, --help': 'output usage information'
    },
    synopsisList: [
      'taro update self [version]',
      'taro update project [version]'
    ]
  })
}

function execUpdate (command: string, version: string, isSelf = false) {
  const updateTarget = isSelf ? ' CLI ' : ' Taro 项目依赖'
  const spinner = ora(`正在更新${updateTarget}到 v${version} ...`).start()
  execCommand({
    command,
    successCallback (data) {
      spinner.stop()
      console.log(data.replace(/\n$/, ''))
    },
    failCallback (data) {
      spinner.stop()
      spinner.warn(data.replace(/\n$/, ''))
    }
  })
}

async function getSemanticVersion (versionStr: string = '', chalk: any) {
  let semanticVersion = ''
  if (versionStr) {
    semanticVersion = semver.clean(versionStr) || ''
  } else {
    const taroPkgName = getPkgItemByKey('name')
    try {
      semanticVersion = await getLatestVersion(taroPkgName, { version: 'latest' })
    } catch (e) {
      semanticVersion = await getLatestVersion(taroPkgName)
    }
  }

  if (!semver.valid(semanticVersion)) {
    console.log(chalk.red('命令错误:无效的 version ~'))
    throw Error('无效的 version!')
  }

  return semanticVersion
}

async function askNpm (): Promise<NpmType> {
  const packageChoices = [
    {
      name: 'yarn',
      value: NpmType.Yarn
    },
    {
      name: 'pnpm',
      value: NpmType.Pnpm
    },
    {
      name: 'npm',
      value: NpmType.Npm
    },
    {
      name: 'cnpm',
      value: NpmType.Cnpm
    }
  ]

  const npmPrompts = [{
    message: '请选择包管理工具',
    name: 'npm',
    type: 'list',
    choices: packageChoices
  }]

  const { npm } = await inquirer.prompt<{ npm: NpmType }>(npmPrompts)
  return npm
 }
