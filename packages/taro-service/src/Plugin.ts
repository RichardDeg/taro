import { addPlatforms } from '@tarojs/helper'
import { processRegisterMethodArgs } from './utils'

import type { Func } from '@tarojs/taro/types/compile'
import type Kernel from './Kernel'
import type { ICommand, IHook, IPlatform } from './utils/types'


type PluginConstructorParams = { id: string, path: string, ctx: Kernel }

export default class Plugin {
  id: PluginConstructorParams['id']
  path: PluginConstructorParams['path']
  ctx: PluginConstructorParams['ctx']
  optsSchema: Func

  constructor ({ id, path, ctx }: PluginConstructorParams) {
    this.id = id
    this.path = path
    this.ctx = ctx
  }

  register (hook: IHook) {
    const targetHookId = this.id
    const { name: targetHookName, fn: targetHookFn } = hook
    if (typeof targetHookName !== 'string') {
      throw new Error(`插件 ${targetHookId} 中注册 hook 失败， hook.name 必须是 string 类型`)
    } else if (typeof targetHookFn !== 'function') {
      throw new Error(`插件 ${targetHookId} 中注册 hook 失败， hook.fn 必须是 function 类型`)
    }

    const originHookValue = this.ctx.hooks.get(targetHookName) || []
    const targetHookValue = originHookValue.concat({ ...hook, plugin: targetHookId })
    this.ctx.hooks.set(targetHookName, targetHookValue)
  }

  registerCommand (command: ICommand) {
    const targetCommandName = command.name
    if (this.ctx.commands.has(targetCommandName)) {
      throw new Error(`命令 ${targetCommandName} 已存在`)
    }
    this.ctx.commands.set(targetCommandName, command)
    this.register(command)
  }

  registerPlatform (platform: IPlatform) {
    const targetPlatformName = platform.name
    if (this.ctx.platforms.has(targetPlatformName)) {
      throw new Error(`适配平台 ${targetPlatformName} 已存在`)
    }
    addPlatforms(targetPlatformName)
    this.ctx.platforms.set(targetPlatformName, platform)
    this.register(platform)
  }

  registerMethod (...args: any[]) {
    const { name: targetMethodName, fn } = processRegisterMethodArgs(args)
    const originMethodValue = this.ctx.methods.get(targetMethodName) || []
    // TODO: ?? 此处 bind this 是否可优化为 箭头函数 => 再看下 this 指向问题
    const targetMethodValue = originMethodValue.concat(fn || function (fn: Func) {
      this.register({
        name,
        fn
      })
    }.bind(this))
    this.ctx.methods.set(targetMethodName, targetMethodValue)
  }

  addPluginOptsSchema (schema) {
    this.optsSchema = schema
  }
}
