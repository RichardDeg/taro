
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

// TODO: 1. 设置保存代码时，自动格式化：eslint / prettier 格式化问题未生效,
// TODO: 2. debugger，断点调试待配置

export default class CLI {
  appPath: string
  constructor(appPath: string) {
    this.appPath = appPath || process.cwd()
  }

  run () {
    return this.parseArgs()
  }

  // TODO: 从小到大 一点点/慢慢来 拆分多个子函数，
  // ??怎么降低函数间的耦合性/关联,
  // 副作用的变量如何处理??
  // 子函数是否需要 return 返回值??
  async parseArgs () {
    /*****************【解析/获取命令行参数】*****************************************/
    // TODO: ??? 是否存在优化空间，抽离个 readArgs 方法，返回 args, 将静态配置项的参数设置都包裹在独立函数内。在入口处只暴露调用
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

    // TODO: ???改写 if... esle... 语句，
    // 封装 console.log 为单独 helpConsole 函数；
    // 并前置helpConsole 函数，通过提前 return，去除一层 if...else...判断，
    // 将 switch command 语句作为主函数暴露出来
    if (command) {
      const appPath = this.appPath
      const presetsPath = path.resolve(__dirname, 'presets')
      const presetsCommandsPath = path.resolve(presetsPath, 'commands')
      const presetsPlatformsPath = path.resolve(presetsPath, 'platforms')

      const miniPlugin = args.plugin
      const isMiniPlugin = typeof miniPlugin === 'string'

      /*****************【读取命令行参数，写入 process.env】设置环境变量 *****************/
      process.env.NODE_ENV ||= args.env
      if (process.env.NODE_ENV === 'undefined' && (command === 'build' || command === 'inspect')) {
        process.env.NODE_ENV = (args.watch ? 'development' : 'production')
      }
      args.type ||= args.t
      if (isMiniPlugin) {
        process.env.TARO_ENV = 'plugin'
      } else if (args.type) {
        process.env.TARO_ENV = args.type
      }

      const mode = args.mode || process.env.NODE_ENV
      /*****************【解析 .env 环境变量配置文件】**********************************
      ******** 需要优先解析 => 以便于后面扩展 kernel.config 内容时 => dotenv 的内容非空 ***
      *****************************************************************************/
      const dotExpandEnv: Record<string, string> = dotenvParse(appPath, args.envPrefix, mode)

      /*****************【读取 config 配置文件内容】***********************************/
      const disableGlobalConfig = !!args['disable-global-config'] || DISABLE_GLOBAL_CONFIG_COMMANDS.includes(command)
      const config = new Config({ appPath, disableGlobalConfig })
      await config.init({ mode, command })

      // TODO: 101 - 132 行，是否存在优化空间，对 kernel 带有副作用的处理逻辑，抽离成单个函数
      const kernel = new Kernel({
        config,
        appPath,
        presets: [
          path.resolve(presetsPath, 'index.js')
        ],
        plugins: []
      })
      // 插件集合
      kernel.optsPlugins ||= []

      // 将自定义的 变量 添加到 config.env 中，实现 definePlugin 字段定义
      const initialConfig = kernel.config?.initialConfig
      if (initialConfig) {
        initialConfig.env = patchEnv(initialConfig, dotExpandEnv)
      }

      /*****************【根据内置命令 command，写入 kernel 插件 optsPlugins】**********/
      const presetsCommandsPlugins = fs.readdirSync(presetsCommandsPath)
      const targetCommandPlugin = `${command}.js`
      if (command === 'doctor') {
        kernel.optsPlugins.push('@tarojs/plugin-doctor')
      } else if (presetsCommandsPlugins.includes(targetCommandPlugin)) {
        kernel.optsPlugins.push(path.resolve(presetsCommandsPath, targetCommandPlugin))
      }

      // 把内置命令插件传递给 kernel，可以暴露给其他插件使用
      kernel.cliCommandsPath = presetsCommandsPath
      kernel.cliCommands = presetsCommandsPlugins
      .filter(fileName => /^[\w-]+(\.[\w-]+)*\.js$/.test(fileName))
      .map(fileName => fileName.replace(/\.js$/, ''))

      switch (command) {
        case 'inspect': {
          this.setKernelOptsPlugins(kernel, args, presetsPlatformsPath)
          // TODO: 看到 customCommand 方法实现了
          customCommand(command, kernel, args)
          break
        }
        case 'build': {
          this.setKernelOptsPlugins(kernel, args, presetsPlatformsPath)
          customCommand(command, kernel, {
            args,
            _,
            //【特殊处理】引入/改写 plugin 和 platform 变量 => 解决不支持微信小程序插件编译问题
            platform: isMiniPlugin ?'plugin' :args.type,
            plugin: isMiniPlugin ?miniPlugin :undefined,
            isWatch: Boolean(args.watch),
            // Note: 是否把 Taro 组件编译为原生自定义组件
            isBuildNativeComp: projectName === 'native-components',
            // Note: 新的混合编译模式，支持把组件单独编译为原生组件
            newBlended: Boolean(args['new-blended']),
            // Note: 是否禁用编译
            withoutBuild: !args.build,
            noInjectGlobalStyle: !args['inject-global-style'],
            noCheck: !args.check,
            deviceType: args.platform,
            resetCache: !!args.resetCache,
            qr: !!args.qr,
            blended: Boolean(args.blended),
            h: args.h,
            env: args.env,
            port: args.port,
            publicPath: args.publicPath,
            assetsDest: args.assetsDest,
            sourceMapUrl: args.sourceMapUrl,
            bundleOutput: args.bundleOutput,
            sourcemapOutput: args.sourcemapOutput,
            sourcemapSourcesRoot: args.sourcemapSourcesRoot,
          })
          break
        }
        case 'init': {
          customCommand(command, kernel, {
            _,
            appPath,
            projectName: projectName || args.name,
            templateSource: args['template-source'],
            clone: !!args.clone,
            h: args.h,
            css: args.css,
            npm: args.npm,
            compiler: args.compiler,
            template: args.template,
            framework: args.framework,
            typescript: args.typescript,
            autoInstall: args.autoInstall,
            description: args.description,
          })
          break
        }
        default: {
          customCommand(command, kernel, args)
        }
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

  setKernelOptsPlugins(kernel: typeof Kernel, args: minimist.ParsedArgs, presetsPlatformsPath: string) {
    /*****************【根据平台 platform，写入 kernel 插件 optsPlugins】************/
    const platform = args.type
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
        // case 'rn' 等，参考：packages/taro-api/src/env.ts
        const presetsPlatformsPlugins = fs.readdirSync(presetsPlatformsPath)
        const targetPlatformPlugin = `${platform}.js`
        if (presetsPlatformsPlugins.includes(targetPlatformPlugin)) {
          kernel.optsPlugins.push(path.resolve(presetsPlatformsPath, targetPlatformPlugin))
        }
      }
    }

    /*****************【根据框架 framework，写入 kernel 插件 optsPlugins】************/
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

    /*****************【根据小程序类型，写入 kernel 插件 optsPlugins】*****************/
    const miniPlugin = args.plugin
    const isMiniPlugin = typeof miniPlugin === 'string'
    if (isMiniPlugin) {
      const miniPlugins = ['weapp', 'alipay', 'jd']
      kernel.optsPlugins.push(path.resolve(presetsPlatformsPath, 'plugin.js'))
      if (miniPlugins.includes(miniPlugin)) {
        kernel.optsPlugins.push(`@tarojs/plugin-platform-${miniPlugin}`)
      }
    }
  }
}
