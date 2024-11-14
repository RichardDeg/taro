import { addPlatforms } from '@tarojs/helper'

import type { Func } from '@tarojs/taro/types/compile'
import type Kernel from './Kernel'
import { processRegisterMethodArgs } from './utils'
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
    if (typeof hook.name !== 'string') {
      throw new Error(`插件 ${this.id} 中注册 hook 失败， hook.name 必须是 string 类型`)
    }
    if (typeof hook.fn !== 'function') {
      throw new Error(`插件 ${this.id} 中注册 hook 失败， hook.fn 必须是 function 类型`)
    }
    const hooks = this.ctx.hooks.get(hook.name) || []
    hook.plugin = this.id
    this.ctx.hooks.set(hook.name, hooks.concat(hook))
  }

  registerCommand (command: ICommand) {
    if (this.ctx.commands.has(command.name)) {
      throw new Error(`命令 ${command.name} 已存在`)
    }
    this.ctx.commands.set(command.name, command)
    this.register(command)
  }

  registerPlatform (platform: IPlatform) {
    if (this.ctx.platforms.has(platform.name)) {
      throw new Error(`适配平台 ${platform.name} 已存在`)
    }
    addPlatforms(platform.name)
    this.ctx.platforms.set(platform.name, platform)
    this.register(platform)
  }

  registerMethod (...args) {
    const { name, fn } = processRegisterMethodArgs(args)
    const methods = this.ctx.methods.get(name) || []
    methods.push(fn || function (fn: Func) {
      this.register({
        name,
        fn
      })
    }.bind(this))
    this.ctx.methods.set(name, methods)
  }

  addPluginOptsSchema (schema) {
    this.optsSchema = schema
  }
}
