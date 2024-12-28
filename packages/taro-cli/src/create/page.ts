import * as path from 'node:path'

import { CompilerType, createPage as createPageBinding, CSSType, FrameworkType, NpmType, PeriodType } from '@tarojs/binding'
import { babelKit, chalk, DEFAULT_TEMPLATE_SRC, fs, getUserHomeDir, resolveScriptPath, TARO_BASE_CONFIG, TARO_CONFIG_FOLDER } from '@tarojs/helper'

import { getPkgVersion, getRootPath } from '../util'
import { modifyPagesOrSubPackages } from '../util/createPage'
import { TEMPLATE_CREATOR } from './constants'
import Creator from './creator'
import fetchTemplate from './fetchTemplate'

const DEFAULT_TEMPLATE_INFO = {
  name: 'default',
  framework: FrameworkType.React,
  css: CSSType.None,
  compiler: CompilerType.Webpack5,
  typescript: false,
}

export interface IPageConf {
  projectName: string
  projectDir: string
  template: string
  pageName: string
  framework: FrameworkType
  css: CSSType
  npm?: NpmType
  compiler?: CompilerType
  typescript?: boolean
  clone?: boolean
  templateSource?: string
  isCustomTemplate?: boolean
  customTemplatePath?: string
  pageDir?: string
  subpkg?: string
  date?: string
  description?: string
}

// TODO: CustomPartial 与 Project 的类型定义重复了
type CustomPartial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
type IPageOptions = CustomPartial<IPageConf, 'projectDir' | 'projectName' | 'pageDir' | 'template'> & {
  modifyCreateTemplate : ModifyCreateTemplateFn
  afterCreate?: AfterCreateFn
}
type ITemplateInfo = CustomPartial<Pick<IPageConf, 'css' | 'compiler' | 'typescript' | 'template' | 'templateSource' | 'clone' | 'isCustomTemplate' | 'customTemplatePath'>, 'template'>
export type ModifyCreateTemplateCb = (templateInfo: ITemplateInfo) => void
type ModifyCreateTemplateFn = (cb: ModifyCreateTemplateCb) => Promise<void>
type AfterCreateFn = (state: boolean) => void
export enum ConfigModificationState {
  Success,
  Fail,
  NeedLess
}
export type ModifyCallback = (state: ConfigModificationState) => void

// TODO: 看到这里了
export default class Page extends Creator {
  public rootPath: string
  public conf: IPageConf
  private modifyCreateTemplate: ModifyCreateTemplateFn
  private afterCreate: AfterCreateFn | undefined
  private pageEntryPath: string

  constructor (options: IPageOptions) {
    super()

    this.rootPath = this._rootPath
    const defaultConfig = {
      projectDir: '',
      projectName: '',
      pageDir: '',
      template: '',
      description: '',
    }
    this.conf = { ...defaultConfig, ...options }
    this.setProjectConfig(options)
    this.setPageConfig(options)
  }

  getPkgPath () {
    const projectDir = this.conf.projectDir as string
    let pkgPath = path.join(projectDir, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      // 适配 云开发 项目
      pkgPath = path.join(projectDir, 'client', 'package.json')
      if (!fs.existsSync(pkgPath)) {
        console.log(chalk.yellow('请在项目根目录下执行 taro create 命令!'))
        process.exit(0)
      }
    }
    return pkgPath
  }

  getPkgTemplateInfo () {
    const pkg = fs.readJSONSync(this.getPkgPath())
    const templateInfo = pkg.templateInfo || DEFAULT_TEMPLATE_INFO
    // set template name
    templateInfo.template = templateInfo.name
    delete templateInfo.name
    return templateInfo
  }

  setProjectConfig({ projectDir }: IPageOptions) {
    const mergedProjectDir = projectDir || this.conf.projectDir
    const mergedProjectName = path.basename(mergedProjectDir) || this.conf.projectName
    this.conf.projectDir = mergedProjectDir
    this.conf.projectName = mergedProjectName
  }

  setPageConfig({ pageName }: IPageOptions) {
    /** TODO: 待优化 3 点：
     * 1. 分隔符 没有兼容多系统，找一下，有现成的方法
     * 2. 方法有 path.dirname, path.basename，不需要手动按照字符串截取
     * 3. pageDir 的写入逻辑用冲突，如果 options 传入了 pageDir，pageName 也传入了, 此段代码会导致 options.pageDir 的配置不生效
     *
     * */
    // TODO: 目前还没有对 subpkg 和 pageName 这两个字段做 格式验证或者处理
    const lastDirSplitSymbolIndex = pageName.lastIndexOf('/')
    if (lastDirSplitSymbolIndex !== -1) {
      this.conf.pageDir = pageName.substring(0, lastDirSplitSymbolIndex)
      this.conf.pageName = pageName.substring(lastDirSplitSymbolIndex + 1)
    }
  }

  setTemplateConfig (templateInfo?: ITemplateInfo) {
    const pkgTemplateInfo = this.getPkgTemplateInfo()
    const mergedTemplateInfo = templateInfo ?{ ...pkgTemplateInfo, ...templateInfo } :pkgTemplateInfo
    this.conf = { ...this.conf, ...mergedTemplateInfo }
  }

  setPageEntryPath (files: string[], handler) {
    const configFileName = files.find((filename) => /\.config\.(js|ts)$/.test(filename))
    if (!configFileName) return
    const getPageFn = handler[configFileName]
    const { setPageName = '', setSubPkgName = '' } = getPageFn?.(() => {}, this.conf) || {}
    if (this.conf.subpkg) {
      this.pageEntryPath = setSubPkgName.replace(/\.config\.(js|ts)$/, '')
    } else {
      this.pageEntryPath = setPageName.replace(/\.config\.(js|ts)$/, '')
    }
  }

  async fetchTemplates () {
    const homedir = getUserHomeDir()
    let templateSource = DEFAULT_TEMPLATE_SRC
    if (!homedir) chalk.yellow('找不到用户根目录，使用默认模版源！')

    if (this.conf.templateSource) {
      templateSource = this.conf.templateSource
    } else {
      const taroConfigPath = path.join(homedir, TARO_CONFIG_FOLDER)
      const taroConfig = path.join(taroConfigPath, TARO_BASE_CONFIG)
      if (fs.existsSync(taroConfig)) {
        const config = await fs.readJSON(taroConfig)
        templateSource = config && config.templateSource ? config.templateSource : DEFAULT_TEMPLATE_SRC
      } else {
        await fs.createFile(taroConfig)
        await fs.writeJSON(taroConfig, { templateSource })
        templateSource = DEFAULT_TEMPLATE_SRC
      }
    }

    // 从模板源下载模板
    await fetchTemplate(templateSource, this.templatePath(''), this.conf.clone)
  }

  // TODO: 关联参考：packages/taro-cli/templates/plugin-compile/src/index.ts
  modifyCreateTemplateCb (templateInfo: ITemplateInfo) {
    this.setTemplateConfig({ ...templateInfo, isCustomTemplate: true })
  }

  async create () {
    const date = new Date()
    this.conf.date = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    // apply 插件，由插件设置自定义模版 config
    // TODO: 看到这里了
    await this.modifyCreateTemplate(this.modifyCreateTemplateCb.bind(this))
    if (!this.conf.isCustomTemplate) {
      this.setTemplateConfig()
      if (!fs.existsSync(this.templatePath(this.conf.template))) {
        await this.fetchTemplates()
      }
    }
    this.write()
  }

  updateAppConfig () {
    const { parse, generate, traverse } = babelKit

    let modifyState: ConfigModificationState = ConfigModificationState.Fail
    const { subpkg, projectDir, typescript } = this.conf
    const [sourceString, pageString] = this.pageEntryPath.split('/src/')
    const appConfigPath = resolveScriptPath(path.join(projectDir, sourceString, 'src', 'app.config'))
    if (!fs.existsSync(appConfigPath)) {
      return console.log(
        `${chalk.red('x ')}${chalk.grey(`无法获取 ${appConfigPath} 配置文件，请手动到配置文件中补全新页面信息`)}`
      )
    }
    const configFileContent = fs.readFileSync(appConfigPath, 'utf-8')
    const ast = parse(configFileContent, {
      sourceType: 'module',
      plugins: typescript ? ['typescript'] : []
    })

    const callback = (state: ConfigModificationState) => {
      modifyState = state
    }

    traverse(ast, {
      ExportDefaultDeclaration (path) {
        modifyPagesOrSubPackages({
          path,
          fullPagePath: pageString,
          subPkgRootPath: subpkg,
          callback
        })
      },
    })

    switch (modifyState as ConfigModificationState) {
      case ConfigModificationState.Fail:
        console.log(`${chalk.red('x ')}${chalk.grey(`自动补全新页面信息失败， 请手动到 ${appConfigPath} 文件中补全新页面信息`)}`)
        break
      case ConfigModificationState.Success:
      {
        const newCode = generate(ast, { retainLines: true })
        fs.writeFileSync(appConfigPath, newCode.code)
        console.log(`${chalk.green('✔ ')}${chalk.grey(`新页面信息已在 ${appConfigPath} 文件中自动补全`)}`)
        break
      }
      case ConfigModificationState.NeedLess:
        console.log(`${chalk.green('✔ ')}${chalk.grey(`新页面信息已存在在 ${appConfigPath} 文件中，不需要补全`)}`)
        break
    }
  }

  write () {
    const { projectName, projectDir, template, pageName, isCustomTemplate, customTemplatePath, subpkg, pageDir } = this.conf
    let templatePath

    if (isCustomTemplate) {
      templatePath = customTemplatePath
    } else {
      templatePath = this.templatePath(template)
    }

    if (!fs.existsSync(templatePath)) return console.log(chalk.red(`创建页面错误：找不到模板${templatePath}`))

    // 引入模板编写者的自定义逻辑
    const handlerPath = path.join(templatePath, TEMPLATE_CREATOR)
    const basePageFiles = fs.existsSync(handlerPath) ? require(handlerPath).basePageFiles : []
    const files = Array.isArray(basePageFiles) ? basePageFiles : []
    const handler = fs.existsSync(handlerPath) ? require(handlerPath).handler : {}

    this.setPageEntryPath(files, handler)

    createPageBinding({
      pageDir,
      subpkg,
      projectDir,
      projectName,
      template,
      framework: this.conf.framework,
      css: this.conf.css || CSSType.None,
      typescript: this.conf.typescript,
      compiler: this.conf.compiler,
      templateRoot: getRootPath(),
      version: getPkgVersion(),
      date: this.conf.date,
      description: this.conf.description,
      pageName,
      isCustomTemplate,
      customTemplatePath,
      basePageFiles: files,
      period: PeriodType.CreatePage,
    }, handler).then(() => {
      console.log(`${chalk.green('✔ ')}${chalk.grey(`创建页面 ${this.conf.pageName} 成功！`)}`)
      this.updateAppConfig()
      this.afterCreate?.(true)
    }).catch(err => {
      console.log(err)
      this.afterCreate?.(false)
    })
  }
}

export type { Page as PageCreator }
