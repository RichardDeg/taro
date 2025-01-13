// TODO: 看到这里了 看下 3 种 pluginType 的功能
import type { IPluginContext } from '@tarojs/service'

/**
 * 编译过程扩展
 */
{{#if (eq pluginType "plugin-build") }}
import webpackChain from 'webpack-chain'
export default (ctx: IPluginContext, pluginOpts) => {
  ctx.onBuildStart(() => {
    console.log('插件入参：', pluginOpts)
    console.log('编译开始')
  })

  ctx.modifyWebpackChain(({ chain }: { chain: webpackChain }) => {
    console.log('这里可以修改webpack配置')
    // 示例：利用webpackChain向html中插入脚本
    if (process.env.TARO_ENV !== 'h5') return
    chain.plugin('htmlWebpackPlugin').tap(([pluginConfig]) => {
      return [{
        ...pluginConfig,
        script: pluginConfig.script + 'console.log("向html中插入代码");'
      }]
    })
  })

  ctx.onBuildComplete(() => {
    console.log('Taro 构建完成！')
  })

  ctx.modifyBuildAssets(({ assets }) => {
    console.log('修改编译后的结果')
    // 示例：修改html产物内容
    const indexHtml = assets['index.html']
    if (indexHtml && indexHtml._value) {
      indexHtml._value = indexHtml._value.replace(/<title>(.*?)<\/title>/,'<title>被插件修改过的标题</title>')
    }
  })

  ctx.onBuildFinish(() => {
    console.log('Webpack 编译结束！')
  })
}
{{/if}}

/**
 * 命令行扩展
 */
{{#if (eq pluginType "plugin-command") }}
export default (ctx: IPluginContext, pluginOpts) => {
  ctx.registerCommand({
    name: 'say',
    async fn() {
      console.log('插件入参：', pluginOpts)
      console.log('Taro say:', ctx.runOpts.options.msg)
    },
    optionsMap: {
      '--msg': '输出的信息',
    },
    synopsisList: ['taro say --msg Hello!'],
  })
}
{{/if}}

/**
 * 创建 page 模版扩展
 */
{{#if (eq pluginType "plugin-template") }}
import * as fs from 'fs-extra'
const path = require('path')
// 试试参考下：https://nodejs.org/docs/latest/api/zlib.html
// TODO: 这个包已废弃，找找新的轮子
const download = require('download')
// TODO: 这个包已废弃，找找新的轮子
const unzip = require("unzip")
interface ITemplateInfo {
  css: 'none' | 'sass' | 'stylus' | 'less'
  typescript?: boolean
  compiler?: 'webpack5' | 'vite'
  template?: string
}
type TCustomTemplateInfo = Omit<ITemplateInfo & {
  isCustomTemplate?: boolean
  customTemplatePath?: string
}, 'template'>
type ModifyCreateTemplateCb = (customTemplateConfig: TCustomTemplateInfo) => void
interface IPluginOpts extends ITemplateInfo {
  installPath: string
}

// TODO: 关联参考：packages/taro-cli/src/create/page.ts 的 modifyCustomTemplateConfigCb
// TODO: 这段代码，待确认梳理逻辑
export default (ctx: IPluginContext, { installPath, css, typescript, compiler }: IPluginOpts) => {
  ctx.modifyCreateTemplate(async (cb: ModifyCreateTemplateCb)=> {
    const templateName = 'mobx'
    const templatePath = path.join(installPath, templateName)

    // TODO: 看到这里了，代码逻辑有问题，待梳理
    /**
      * 下载模版到电脑本地，可以自行进行判断，看是否需要重新下载
      * 从哪里下载，如何下载，taro 官方不做限定
      * 模版格式和社区模版一样
      * 只要保证下载后的文件目录为 `${templatePath}` 即可，taro 会在该目录下获取模版
      * 如果下载模版失败，请不要调用 cb 函数，taro 会根据默认流程进行兜底创建
      */
    // 如果文件不存在，就下载文件到指定路径
    if (!fs.existsSync(templatePath)) {
      await downloadTemplate({ templateName, templatePath })
    }
    // 如果文件下载成功，调用 cb
    if (fs.existsSync(templatePath)) {
      const templateConfig = {
        customTemplatePath: templatePath,
        css,
        typescript,
        compiler
      }
      cb(templateConfig)
    }
  })
}
// TODO: 代码看不太懂
// TODO: 如何判断下载成功或失败了？什么时候创建了  templatePath 文件了么
const downloadTemplate = async ({ templateName, templatePath }: { templateName: string, templatePath: string }) => {
  return new Promise<void>(async (resolve, reject)=>{
    const zipPath = path.join(templatePath, `${templateName}.zip` )
    const downloadUrl = 'https://storage.360buyimg.com/olympic-models-test/mobx.zip'
    await download(downloadUrl, zipPath)
    const readableStream = fs.createReadStream(zipPath)
    const writableStream = unzip.Extract({ path: templatePath })
    readableStream.pipe(writableStream)
    writableStream.on('close', function () {
      fs.unlinkSync(zipPath)
      console.log("解压完成!")
      resolve()
    })
    writableStream.on('error', function (err) {
      console.log(err)
      reject()
    })
  })
}
{{/if}}
