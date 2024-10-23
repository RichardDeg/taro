
/**
 * 参考工具使用手册：
 * 1. minimist: https://www.npmjs.com/package/minimist
 *
 * */
import * as minimist from 'minimist'
import * as path from 'node:path'

import { dotenvParse, fs, patchEnv } from '@tarojs/helper'
import { Config, Kernel } from '@tarojs/service'

import customCommand from './commands/customCommand'
import { getPkgVersion } from './util'

const DISABLE_GLOBAL_CONFIG_COMMANDS = ['build', 'global-config', 'doctor', 'update', 'config']
const DEFAULT_FRAMEWORK = 'react'

// TODO: 1. eslint / prettier 格式化问题未生效
// TODO: 2. tslint，ts 版本校验问题，貌似 vscode 内置的 ts 与 仓库的 ts 不匹配，调整为 仓库自带的 ts 版本
// TODO: 3. debugger，断点调试待配置

export default class CLI {
  appPath: string
  constructor(appPath) {
    this.appPath = appPath || process.cwd()
  }

  run () {
    return this.parseArgs()
  }

  async parseArgs () {
    const args = minimist(process.argv.slice(2), {
      alias: {
        version: ['v'],
        help: ['h'],
        port: ['p'],
        envPrefix: ['env-prefix'],

        /** specially for rn, RN 相关的指定配置项 */
        // Removes cached files.
        resetCache: ['reset-cache'],
        // assets public path.
        publicPath: ['public-path'],
        // File name where to store the resulting bundle.
        bundleOutput: ['bundle-output'],
        // File name where to store the sourcemap file for resulting bundle.
        sourcemapOutput: ['sourcemap-output'],
        // Report SourceMapURL using its full path.
        sourceMapUrl: ['sourcemap-use-absolute-path'],
        // Path to make sourcemaps sources entries relative to.
        sourcemapSourcesRoot: ['sourcemap-sources-root'],
        // Directory name where to store assets referenced in the bundle.
        assetsDest: ['assets-dest'],
      },
      boolean: ['version', 'help', 'disable-global-config'],
      default: {
        build: true,
        check: true,
        'inject-global-style': true
      },
    })

    const _ = args._
    const [command, projectName] = _


    if (command) {
      const appPath = this.appPath
      const presetsPath = path.resolve(__dirname, 'presets')
      const commandsPath = path.resolve(presetsPath, 'commands')
      const platformsPath = path.resolve(presetsPath, 'platforms')
      const commandPlugins = fs.readdirSync(commandsPath)
      const targetPlugin = `${command}.js`

      /***************** 【读取命令行参数，写入 process.env】设置环境变量 *****************/
      process.env.NODE_ENV ||= args.env
      if (process.env.NODE_ENV === 'undefined' && (command === 'build' || command === 'inspect')) {
        process.env.NODE_ENV = (args.watch ? 'development' : 'production')
      }
      args.type ||= args.t
      if (typeof args.plugin === 'string') {
        process.env.TARO_ENV = 'plugin'
      } else if (args.type) {
        process.env.TARO_ENV = args.type
      }


      // *******************************************
      // *********** TODO: 看到这里了！！！！**********
      // *******************************************


      const mode = args.mode || process.env.NODE_ENV
      // 这里解析 dotenv 以便于 config 解析时能获取 dotenv 配置信息
      const expandEnv = dotenvParse(appPath, args.envPrefix, mode)

      const disableGlobalConfig = !!(args['disable-global-config'] || DISABLE_GLOBAL_CONFIG_COMMANDS.includes(command))

      const configEnv = {
        mode,
        command,
      }
      const config = new Config({
        appPath,
        disableGlobalConfig,
      })
      await config.init(configEnv)

      const kernel = new Kernel({
        appPath,
        presets: [
          path.resolve(__dirname, '.', 'presets', 'index.js')
        ],
        config,
        plugins: []
      })
      kernel.optsPlugins ||= []

      // 将自定义的 变量 添加到 config.env 中，实现 definePlugin 字段定义
      const initialConfig = kernel.config?.initialConfig
      if (initialConfig) {
        initialConfig.env = patchEnv(initialConfig, expandEnv)
      }
      if (command === 'doctor') {
        kernel.optsPlugins.push('@tarojs/plugin-doctor')
      } else if (commandPlugins.includes(targetPlugin)) {
        // 针对不同的内置命令注册对应的命令插件
        kernel.optsPlugins.push(path.resolve(commandsPath, targetPlugin))
      }

      // 把内置命令插件传递给 kernel，可以暴露给其他插件使用
      kernel.cliCommandsPath = commandsPath
      kernel.cliCommands = commandPlugins
        .filter(commandFileName => /^[\w-]+(\.[\w-]+)*\.js$/.test(commandFileName))
        .map(fileName => fileName.replace(/\.js$/, ''))


      switch (command) {
        case 'inspect':
        case 'build': {
          // TODO: 122 -180 行，尝试下是否可收起到1个函数内。弄懂这段代码在做什么???
          // TODO: 保持程序入口/主函数干净，收起函数具体实现，改善代码可读性; 做到不看函数内具体实现即可明确功能；（参考 react 源码风格）

          const { publicPath, bundleOutput, sourcemapOutput, sourceMapUrl, sourcemapSourcesRoot, assetsDest } = args

          // FIXME:【特殊处理】引入/改写 plugin 和 platform 变量 => 解决不支持微信小程序插件编译问题
          let plugin
          let platform = args.type

          // 针对不同的内置平台注册对应的端平台插件
          switch (platform) {
            case 'weapp':
            case 'alipay':
            case 'swan':
            case 'tt':
            case 'qq':
            case 'jd':
            case 'h5':
            case 'harmony-hybrid':
              kernel.optsPlugins.push(`@tarojs/plugin-platform-${platform}`)
              break
            default: {
              // plugin, rn
              const platformPlugins = fs.readdirSync(platformsPath)
              const targetPlugin = `${platform}.js`
              if (platformPlugins.includes(targetPlugin)) {
                kernel.optsPlugins.push(path.resolve(platformsPath, targetPlugin))
              }
              break
            }
          }

          // 根据 framework 启用插件
          const framework = kernel.config?.initialConfig.framework || DEFAULT_FRAMEWORK
          const frameworkMap = {
            vue3: '@tarojs/plugin-framework-vue3',
            react: '@tarojs/plugin-framework-react',
            preact: '@tarojs/plugin-framework-react',
            solid: '@tarojs/plugin-framework-solid',
          }
          const targetFrameworkPlugin = frameworkMap[framework]
          if (targetFrameworkPlugin) {
            kernel.optsPlugins.push(targetFrameworkPlugin)
          }

          // 编译小程序插件
          if (typeof args.plugin === 'string') {
            plugin = args.plugin
            platform = 'plugin'
            kernel.optsPlugins.push(path.resolve(platformsPath, 'plugin.js'))

            // TODO: ??? 这是 pluginList, 还是部分的 platform, 如何命名 ???
            // TODO: 是否已由其他公共的 常量配置文件，不需要单个仓库重复写一份。是否需要提取出去变成公共常量
            const pluginList = ['weapp', 'alipay', 'jd']

            if (pluginList.includes(plugin)) {
              kernel.optsPlugins.push(`@tarojs/plugin-platform-${plugin}`)
            }
          }

          // 传递 inspect 参数即可
          if (command === 'inspect') {
            customCommand(command, kernel, args)
            break
          }
          customCommand(command, kernel, {
            args,
            _,
            platform,
            plugin,
            isWatch: Boolean(args.watch),
            // Note: 是否把 Taro 组件编译为原生自定义组件
            isBuildNativeComp: projectName === 'native-components',
            // Note: 新的混合编译模式，支持把组件单独编译为原生组件
            newBlended: Boolean(args['new-blended']),
            // Note: 是否禁用编译
            withoutBuild: !args.build,
            noInjectGlobalStyle: !args['inject-global-style'],
            noCheck: !args.check,
            port: args.port,
            env: args.env,
            deviceType: args.platform,
            resetCache: !!args.resetCache,
            publicPath,
            bundleOutput,
            sourcemapOutput,
            sourceMapUrl,
            sourcemapSourcesRoot,
            assetsDest,
            qr: !!args.qr,
            blended: Boolean(args.blended),
            h: args.h
          })
          break
        }
        case 'init': {
          customCommand(command, kernel, {
            _,
            appPath,
            projectName: projectName || args.name,
            description: args.description,
            typescript: args.typescript,
            framework: args.framework,
            compiler: args.compiler,
            npm: args.npm,
            templateSource: args['template-source'],
            clone: !!args.clone,
            template: args.template,
            css: args.css,
            autoInstall: args.autoInstall,
            h: args.h
          })
          break
        }
        default:
          customCommand(command, kernel, args)
          break
      }
    } else {
      if (args.h) {
        console.log('Usage: taro <command> [options]')
        console.log()
        console.log('Options:')
        console.log('  -v, --version       output the version number')
        console.log('  -h, --help          output usage information')
        console.log()
        console.log('Commands:')
        console.log('  init [projectName]  Init a project with default templete')
        console.log('  config <cmd>        Taro config')
        console.log('  create              Create page for project')
        console.log('  build               Build a project with options')
        console.log('  update              Update packages of taro')
        console.log('  info                Diagnostics Taro env info')
        console.log('  doctor              Diagnose taro project')
        console.log('  inspect             Inspect the webpack config')
        console.log('  help [cmd]          display help for [cmd]')
      } else if (args.v) {
        console.log(getPkgVersion())
      }
    }
  }
}
