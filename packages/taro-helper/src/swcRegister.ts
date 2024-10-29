interface ICreateSwcRegisterParam {
  only?: any
  plugins?: [string, any][]
}

export default function createSwcRegister ({ only, plugins }: ICreateSwcRegisterParam) {
  const swcRegisteConfig: Record<string, any> = {
    only: Array.from(new Set([...only])),
    jsc: {
      parser: {
        syntax: 'typescript',
        decorators: true
      },
      transform: {
        legacyDecorator: true
      }
    },
    module: {
      type: 'commonjs'
    }
  }

  if (plugins) {
    swcRegisteConfig.jsc.experimental = {
      plugins
    }
  }

  // TODO: @swc/register 包已废弃，待升级
  require('@swc/register')(swcRegisteConfig)
}
