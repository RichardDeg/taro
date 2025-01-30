import * as path from 'node:path'

import { babelKit } from '@tarojs/helper'
import { isArray, isString } from '@tarojs/shared'

import type { IPluginContext, TaroPlatformBase } from '@tarojs/service'
import type { IComponentConfig } from '@tarojs/taro/types/compile/hooks'

const { types: t, generate, traverse, parse } = babelKit

export interface IOptions {
  pxtransformBlackList?: any[]
  modifyElements?(inline: string[], block: string[]): void
  enableSizeAPIs?: boolean
}

interface OnParseCreateElementArgs {
  nodeName: string
  componentConfig: IComponentConfig
}

export default (ctx: IPluginContext, options: IOptions) => {
  const inlineElements = ['i', 'abbr', 'select', 'acronym', 'small', 'bdi', 'kbd', 'strong', 'big', 'sub', 'sup', 'br', 'mark', 'meter', 'template', 'cite', 'object', 'time', 'code', 'output', 'u', 'data', 'picture', 'tt', 'datalist', 'var', 'dfn', 'del', 'q', 'em', 's', 'embed', 'samp', 'b']
  const blockElements = ['body', 'svg', 'address', 'fieldset', 'li', 'span', 'article', 'figcaption', 'main', 'aside', 'figure', 'nav', 'blockquote', 'footer', 'ol', 'details', 'p', 'dialog', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'dd', 'header', 'section', 'div', 'hgroup', 'table', 'dl', 'hr', 'ul', 'dt', 'view', 'view-block']
  const specialElements = ['slot', 'form', 'iframe', 'img', 'audio', 'video', 'canvas', 'a', 'input', 'label', 'textarea', 'progress', 'button']

  patchMappingElements(ctx, options, inlineElements, blockElements)

  ctx.modifyWebpackChain(({ chain }) => {
    chain.plugin('definePlugin').tap(([pluginConfig, ...restArgs]) => {
      // 默认允许使用 getBoundingClientRect 等 API
      const mergedEnableSizeAPIs = options.enableSizeAPIs ?? true
      const mergedPluginConfig = { ...pluginConfig, ENABLE_SIZE_APIS: mergedEnableSizeAPIs}
      return [mergedPluginConfig, ...restArgs]
    })
  })
  ctx.registerMethod({
    name: 'onSetupClose',
    fn (platform: TaroPlatformBase) {
      injectRuntimePath(platform)
    }
  })
  // 映射、收集使用到的小程序组件
  ctx.onParseCreateElement(({ nodeName, componentConfig }: OnParseCreateElementArgs) => {
    if(![...inlineElements, ...blockElements, ...specialElements].includes(nodeName)) return

    const simple = ['audio', 'button', 'canvas', 'form', 'label', 'progress', 'textarea', 'video']
    const special = {
      a: ['navigator'],
      iframe: ['web-view'],
      img: ['image'],
      input: ['input', 'checkbox', 'radio']
    }

    const includes = componentConfig.includes
    if (simple.includes(nodeName) && !includes.has(nodeName)) {
      includes.add(nodeName)
    } else if (nodeName in special) {
      const maps = special[nodeName]
      maps.forEach(item => {
        if(!includes.has(item)) includes.add(item)
      })
    }
  })
  // TODO: 看到这里了
  // 修改 H5 postcss options
  ctx.modifyRunnerOpts(({ opts }) => {
    modifyPostcssConfigs(opts, options)
  })
}

function injectRuntimePath (platform: TaroPlatformBase) {
  const injectedPath = '@tarojs/plugin-html/dist/runtime'
  if (isArray(platform.runtimePath)) {
    platform.runtimePath.push(injectedPath)
  } else if (isString(platform.runtimePath)) {
    platform.runtimePath = [platform.runtimePath, injectedPath]
  }
}

// TODO: 看到这里了
function modifyPostcssConfigs (config: Record<string, any>, options: IOptions) {
  if (!config?.platform) return

  config.postcss ||= {}
  const postcssConfig = config.postcss

  if (config.platform !== 'h5') {
    postcssConfig.htmltransform ||= { enable: true }
  }

  if (options.pxtransformBlackList) {
    postcssConfig.pxtransform ||= { enable: true }
    const pxtransformConfig = postcssConfig.pxtransform

    if (pxtransformConfig.enable) {
      pxtransformConfig.config ||= {}
      const config = pxtransformConfig.config
      config.selectorBlackList ||= []
      config.selectorBlackList = config.selectorBlackList.concat(options.pxtransformBlackList)
    }
  }
}

function patchMappingElements (ctx: IPluginContext, options: IOptions, inlineElements: string[], blockElements: string[]) {
  const { fs } = ctx.helper
  const runtimeFilePath = path.resolve(__dirname, './runtime.js')
  const runtimeFileContent = fs.readFileSync(runtimeFilePath, 'utf-8')
  const runtimeFileAst = parse(runtimeFileContent, { sourceType: 'unambiguous' })

  if (t.isNode(runtimeFileAst)) {
    options.modifyElements?.(inlineElements, blockElements)

    traverse(runtimeFileAst, {
      VariableDeclarator (path) {
        const node = path.node
        const varId = node.id
        if (varId.type === 'Identifier') {
          if (varId.name === 'inlineElements') {
            node.init = buildNewExpressionAstNode(inlineElements)
          }
          if (varId.name === 'blockElements') {
            node.init = buildNewExpressionAstNode(blockElements)
          }
        }
      }
    })

    const { code } = generate(runtimeFileAst)
    fs.writeFileSync(runtimeFilePath, code)
  }
}

function buildNewExpressionAstNode (elements: string[]) {
  return t.newExpression(
    t.identifier('Set'),
    [t.arrayExpression(elements.map(el => t.stringLiteral(el)))]
  )
}
