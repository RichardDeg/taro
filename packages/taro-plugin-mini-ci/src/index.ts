import * as path from 'node:path'

import * as minimist from 'minimist'

import AlipayCI from './AlipayCI'
import BaseCI, { CIOptions } from './BaseCi'
import DingtalkCI from './DingtalkCI'
import JdCI from './JdCI'
import SwanCI from './SwanCI'
import TTCI from './TTCI'
import WeappCI from './WeappCI'

import type { IPluginContext } from '@tarojs/service'

export { CIOptions } from './BaseCi'

const enum EnumAction {
  /** 自动打开预览工具 */
  'open' = 'open',
  /** 预览小程序（上传代码，作为“开发版”小程序） */
  'preview' = 'preview',
  /** 上传小程序（上传代码，可设置为“体验版”小程序） */
  'upload' = 'upload',
}

const EnumActionList = [EnumAction.open, EnumAction.preview, EnumAction.upload]

interface MinimistArgs {
  /** 自定义要处理的项目目录 */
  projectPath: string
  /** 自动打开预览工具 */
  open: boolean
  /** 预览小程序 */
  preview: boolean
  /** 上传小程序 */
  upload: boolean
}

export default (ctx: IPluginContext, _pluginOpts: CIOptions | (() => CIOptions)) => {
  const args = minimist<MinimistArgs>(process.argv.slice(2), {
    boolean: EnumActionList,
    string: ['projectPath'],
    default: {
      projectPath: ''
    }
  })
  const command = args._[0]
  // 参数验证，支持传入配置对象、返回配置对象的异步函数
  ctx.addPluginOptsSchema((joi) => {
    return joi.alternatives().try(
      joi.function().required(),
      joi
        .object()
        .keys({
          /** 微信小程序上传配置 */
          weapp: joi.object({
            appid: joi.string().required(),
            privateKeyPath: joi.string().required(),
            type: joi.string().valid('miniProgram', 'miniProgramPlugin', 'miniGame', 'miniGamePlugin'),
            ignores: joi.array().items(joi.string().required()),
            robot: joi.number(),
            setting: joi.object()
          }),
          /** 字节跳动小程序上传配置 */
          tt: joi.object({
            email: joi.string().required(),
            password: joi.string().required()
          }),
          /** 阿里小程序上传配置 */
          alipay: joi.alternatives().try(
            joi.object({
              appid: joi.string().required(),
              toolId: joi.string().required(),
              privateKeyPath: joi.string().required(),
              clientType: joi.string().valid('alipay', 'ampe', 'amap', 'genie', 'alios', 'uc', 'quark', 'health', 'koubei', 'alipayiot', 'cainiao', 'alihealth'),
              deleteVersion: joi.string().regex(/^\d+\.\d+\.\d+$/)
            }),
            joi.object({
              appid: joi.string().required(),
              toolId: joi.string().required(),
              privateKey: joi.string().required(),
              clientType: joi.string().valid('alipay', 'ampe', 'amap', 'genie', 'alios', 'uc', 'quark', 'health', 'koubei', 'alipayiot', 'cainiao', 'alihealth'),
              deleteVersion: joi.string().regex(/^\d+\.\d+\.\d+$/)
            }),

          ),
          /** 钉钉小程序配置 */
          dd: joi.object({
            token: joi.string().required(),
            appid: joi.string().required(),
            devToolsInstallPath: joi.string(),
            projectType: joi.string().valid(
              'dingtalk-personal',
              'dingtalk-biz-isv',
              'dingtalk-biz',
              'dingtalk-biz-custom',
              'dingtalk-biz-worktab-plugin')
          }),
          /** 百度小程序上传配置 */
          swan: joi.object({
            token: joi.string().required(),
            minSwanVersion: joi.string()
          }),
          jd: joi.object({
            privateKey: joi.string().required(),
            robot: joi.number(),
            ignores: joi.array().items(joi.string()),
          }),
          version: joi.string(),
          desc: joi.string(),
          projectPath: joi.string()
        })
        .required()
    )
  })

  const doAction = async (platform: string, action: EnumAction, projectPath: string) => {
    const { printLog, ProcessTypeEnum, fs } = ctx.helper
    if (typeof platform !== 'string') {
      printLog(ProcessTypeEnum.ERROR, '请传入正确的编译类型！')
      process.exit(0)
    }
    // 可通过异步函数获取插件选项
    const pluginOpts = typeof _pluginOpts === 'function' ? await _pluginOpts() : _pluginOpts
    let ci: BaseCI | null = null
    switch (platform) {
      case 'weapp':
      case 'qywx':
        ci = new WeappCI(ctx, pluginOpts)
        break
      case 'tt':
        ci = new TTCI(ctx, pluginOpts)
        break
      case 'alipay':
      case 'iot':
        ci = new AlipayCI(ctx, pluginOpts)
        break
      case 'dd':
        ci = new DingtalkCI(ctx, pluginOpts)
        break
      case 'swan':
        ci = new SwanCI(ctx, pluginOpts)
        break
      case 'jd':
        ci = new JdCI(ctx, pluginOpts)
        break
    }
    if (!ci) {
      return printLog(ProcessTypeEnum.WARNING, `"@tarojs/plugin-mini-ci" 插件暂时不支持 "${platform}" 平台`)
    }

    projectPath ||= pluginOpts.projectPath || ctx.paths.outputPath
    projectPath = path.isAbsolute(projectPath) ? projectPath : path.join(ctx.paths.appPath, projectPath)

    if (!fs.pathExistsSync(projectPath)) {
      printLog(ProcessTypeEnum.ERROR, `"projectPath"选项配置的路径不存在:${projectPath}`)
      process.exit(0)
    }

    ci.setProjectPath(projectPath)

    ci.init()

    ci[action]()
  }

  // 构建小程序后执行
  if (command === 'build') {
    const onBuildDone = ctx.onBuildComplete || ctx.onBuildFinish
    onBuildDone(async () => {
      let action: EnumAction | null = null

      EnumActionList.forEach(enumAction => {
        if (!action && args[enumAction]) action = enumAction
      })

      if (action) {
        await doAction(ctx.runOpts.options.platform, action, args.projectPath)
      }
    })
  }

  // 注册独立的命令，可直接上传构建后的代码
  EnumActionList.forEach(action => {
    ctx.registerCommand({
      name: action,
      async fn ({ options }) {
        doAction(options.type, action, options.projectPath)
      },
      optionsMap: {
        '--type [typeName]': `${action} type, 支持 weapp/swan/alipay/iot/tt/dd`,
        '--projectPath': `${action} 目录, 不传默认为配置项 'outputRoot' 配置目录`
      },
      synopsisList: [
        `taro ${action} --type weapp`,
        `taro ${action} --type alipay`
      ],
    })
  })
}
