import * as path from 'node:path'

import {
  createSwcRegister,
  ENTRY,
  fs,
  getModuleDefaultExport,
  getUserHomeDir,
  OUTPUT_DIR,
  resolveScriptPath,
  SOURCE_DIR,
  TARO_GLOBAL_CONFIG_DIR,
  TARO_GLOBAL_CONFIG_FILE
} from '@tarojs/helper'
import * as ora from 'ora'
import { merge } from 'webpack-merge'

import {
  CONFIG_DIR_NAME,
  DEFAULT_CONFIG_FILE
} from './utils/constants'

// TODO:??? type 类型文件是如何归置的 ???
import type { IProjectConfig } from '@tarojs/taro/types/compile'
import type { IConfigEnv, IConfigOptions } from './utils/types'

export default class Config {
  /** IConfigOptions['appPath'] */
  appPath: string
  /** IConfigOptions['disableGlobalConfig'] */
  disableGlobalConfig: boolean
  initialConfig: IProjectConfig
  initialGlobalConfig: IProjectConfig
  isInitSuccess: boolean
  configPath: string

  constructor ({ appPath, disableGlobalConfig }: IConfigOptions) {
    this.appPath = appPath
    this.disableGlobalConfig = !!disableGlobalConfig
    this.initialConfig = {}
    this.initialGlobalConfig = {}
    this.isInitSuccess = false
  }

  async init (configEnv: IConfigEnv) {
    this.configPath = resolveScriptPath(path.join(this.appPath, CONFIG_DIR_NAME, DEFAULT_CONFIG_FILE))
    const hasGlobalConfig = fs.existsSync(this.configPath)

    if (!hasGlobalConfig && this.disableGlobalConfig) return
    if (!hasGlobalConfig && !this.disableGlobalConfig) return this.initGlobalConfig()

    // TODO: 看到这里了 resolveScriptPath 函数
    createSwcRegister({
      only: [
        filePath => filePath.indexOf(path.join(this.appPath, CONFIG_DIR_NAME)) >= 0
      ]
    })

    try {
      const userExport = getModuleDefaultExport(require(this.configPath))
      this.initialConfig = typeof userExport === 'function' ? await userExport(merge, configEnv) : userExport
      this.isInitSuccess = true
    } catch (err) {
      console.log(err)
    }
  }

  initGlobalConfig () {
    const homedir = getUserHomeDir()
    if (!homedir) return console.error('获取不到用户 home 路径')
    const globalPluginConfigPath = path.join(getUserHomeDir(), TARO_GLOBAL_CONFIG_DIR, TARO_GLOBAL_CONFIG_FILE)
    if (!fs.existsSync(globalPluginConfigPath)) return
    const spinner = ora(`开始获取 taro 全局配置文件： ${globalPluginConfigPath}`).start()
    try {
      this.initialGlobalConfig = fs.readJSONSync(globalPluginConfigPath) || {}
      spinner.succeed('获取 taro 全局配置成功')
    } catch (e) {
      spinner.stop()
      console.warn(`获取全局配置失败，如果需要启用全局插件请查看配置文件: ${globalPluginConfigPath} `)
    }
  }

  getConfigWithNamed (platform, configName) {
    const initialConfig = this.initialConfig
    const sourceDirName = initialConfig.sourceRoot || SOURCE_DIR
    const outputDirName = initialConfig.outputRoot || OUTPUT_DIR
    const sourceDir = path.join(this.appPath, sourceDirName)
    const entryName = ENTRY
    const entryFilePath = resolveScriptPath(path.join(sourceDir, entryName))

    const entry = {
      [entryName]: [entryFilePath]
    }

    return {
      entry,
      alias: initialConfig.alias || {},
      copy: initialConfig.copy,
      sourceRoot: sourceDirName,
      outputRoot: outputDirName,
      platform,
      framework: initialConfig.framework,
      compiler: initialConfig.compiler,
      cache: initialConfig.cache,
      logger: initialConfig.logger,
      baseLevel: initialConfig.baseLevel,
      csso: initialConfig.csso,
      sass: initialConfig.sass,
      uglify: initialConfig.uglify,
      plugins: initialConfig.plugins,
      projectName: initialConfig.projectName,
      env: initialConfig.env,
      defineConstants: initialConfig.defineConstants,
      designWidth: initialConfig.designWidth,
      deviceRatio: initialConfig.deviceRatio,
      projectConfigName: initialConfig.projectConfigName,
      jsMinimizer: initialConfig.jsMinimizer,
      cssMinimizer: initialConfig.cssMinimizer,
      terser: initialConfig.terser,
      esbuild: initialConfig.esbuild,
      ...initialConfig[configName],
      ...initialConfig[platform],
    }
  }
}
