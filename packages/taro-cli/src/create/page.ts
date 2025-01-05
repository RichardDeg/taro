import * as path from 'node:path'

import { CompilerType, createPage, CSSType, FrameworkType, NpmType, PeriodType } from '@tarojs/binding'
import { babelKit, chalk, DEFAULT_TEMPLATE_SRC, fs, getUserHomeDir, resolveScriptPath, TARO_BASE_CONFIG, TARO_CONFIG_FOLDER } from '@tarojs/helper'

import { getPkgVersion, getRootPath } from '../util'
import { modifyPagesOrSubPackages } from '../util/createPage'
import { TEMPLATE_CREATOR } from './constants'
import Creator from './creator'
import fetchTemplate from './fetchTemplate'

// TODO: 统一 page & plugin & project & creator 这些文件的代码风格
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

  setPageEntryPath (files: string[], handler: Object) {
    const configFileReg = /\.config\.(js|ts)$/
    const configFileName = files.find((filename) => configFileReg.test(filename))
    if (!configFileName) return

    const getPageFn = handler[configFileName]
    const getPageErrorFn = () => {}
    const { pageDir, pageName, subpkg } = this.conf
    const { setPageName, setSubPkgName } = getPageFn?.(getPageErrorFn, { pageDir, pageName, subpkg }) || {}
    const mergedName = !!subpkg ?setSubPkgName :setPageName
    this.pageEntryPath = mergedName.replace(configFileReg, '')
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
    await this.modifyCreateTemplate(this.modifyCreateTemplateCb.bind(this))
    if (!this.conf.isCustomTemplate) {
      this.setTemplateConfig()
      if (!fs.existsSync(this.templatePath(this.conf.template))) {
        await this.fetchTemplates()
      }
    }
    await this.write()
  }

  // TODO: 看到这里了
  updateAppConfig () {
    const { parse, generate, traverse } = babelKit
    const { projectDir, subpkg, typescript } = this.conf
    const [sourceStr, pageStr] = this.pageEntryPath.split('/src/')

    const appConfigPath = resolveScriptPath(path.join(projectDir, sourceStr, 'src', 'app.config'))
    if (!fs.existsSync(appConfigPath)) {
      return console.log(`$chalk.red('x ')}${chalk.grey(`无法获取 ${appConfigPath} 配置文件，请手动到配置文件中补全新页面信息`)}`)
    }
    const appConfigContent = fs.readFileSync(appConfigPath, 'utf-8')
    const appConfigAst = parse(appConfigContent, {
      sourceType: 'module',
      plugins: typescript ? ['typescript'] : []
    })

    let modifyState = ConfigModificationState.Fail as ConfigModificationState
    traverse(appConfigAst, {
      ExportDefaultDeclaration (path) {
        // TODO: 看到这里了
        modifyPagesOrSubPackages({
          path,
          fullPagePath: pageStr,
          subPkgRootPath: subpkg,
          callback: value => modifyState = value
        })
      },
    })

    switch (modifyState) {
      case ConfigModificationState.Success: {
        const newCode = generate(appConfigAst, { retainLines: true })
        fs.writeFileSync(appConfigPath, newCode.code)
        console.log(`${chalk.green('✔ ')}${chalk.grey(`新页面信息已在 ${appConfigPath} 文件中自动补全`)}`)
        break
      }
      case ConfigModificationState.Fail:
        console.log(`${chalk.red('x ')}${chalk.grey(`自动补全新页面信息失败， 请手动到 ${appConfigPath} 文件中补全新页面信息`)}`)
        break
      case ConfigModificationState.NeedLess:
        console.log(`${chalk.green('✔ ')}${chalk.grey(`新页面信息已存在在 ${appConfigPath} 文件中，不需要补全`)}`)
        break
    }
  }

  async write () {
    const { projectName, projectDir, pageName, pageDir, template, isCustomTemplate, customTemplatePath } = this.conf
    const { framework, css, typescript, compiler, date, description, subpkg } = this.conf
    const templatePath = isCustomTemplate ?customTemplatePath :this.templatePath(template)

    if (!templatePath || !fs.existsSync(templatePath)) {
      return console.log(chalk.red(`创建页面错误：找不到模板${templatePath}`))
    }

    // 引入模板编写者的自定义逻辑
    const handlerPath = path.join(templatePath, TEMPLATE_CREATOR)
    const handlerModule = fs.existsSync(handlerPath) ?require(handlerPath) :{}
    const { handler = {}, basePageFiles = [] } = handlerModule
    const mergedBasePageFiles = Array.isArray(basePageFiles) ? basePageFiles : []
    this.setPageEntryPath(mergedBasePageFiles, handler)

    try {
      await createPage({
        projectDir,
        projectName,
        pageDir,
        pageName,
        compiler,
        framework,
        typescript,
        subpkg,
        template,
        isCustomTemplate,
        customTemplatePath,
        date,
        description,
        basePageFiles: mergedBasePageFiles,
        css: css || CSSType.None,
        period: PeriodType.CreatePage,
        templateRoot: getRootPath(),
        version: getPkgVersion(),
      }, handler)
      console.log(`${chalk.green('✔ ')}${chalk.grey(`创建页面 ${pageName} 成功！`)}`)
      // TODO: 看到这里了
      this.updateAppConfig()
      this.afterCreate?.(true)
    } catch(err) {
      console.log(err)
      this.afterCreate?.(false)
    }
  }
}

export type { Page as PageCreator }
