import * as path from 'node:path'

import { CompilerType, createProject, CSSType, FrameworkType, NpmType, PeriodType } from '@tarojs/binding'
import {
  chalk,
  DEFAULT_TEMPLATE_SRC,
  DEFAULT_TEMPLATE_SRC_GITEE,
  fs,
  getUserHomeDir,
  SOURCE_DIR,
  TARO_BASE_CONFIG,
  TARO_CONFIG_FOLDER
} from '@tarojs/helper'
import { isArray } from '@tarojs/shared'
import axios from 'axios'
import * as inquirer from 'inquirer'
import * as ora from 'ora'
import * as semver from 'semver'

import { clearConsole, getPkgVersion, getRootPath } from '../util'
import { TEMPLATE_CREATOR } from './constants'
import Creator from './creator'
import fetchTemplate from './fetchTemplate'

import type { ITemplates } from './fetchTemplate'

const NONE_AVAILABLE_TEMPLATE = '无可用模板'
const LOWEST_SUPPORTED_VERSION = 'v18.0.0'

export interface IProjectConf {
  projectName: string
  projectDir: string
  npm: NpmType
  templateSource: string
  clone?: boolean
  template: string
  description?: string
  typescript?: boolean
  css: CSSType
  date?: string
  src?: string
  sourceRoot?: string
  env?: string
  autoInstall?: boolean
  hideDefaultTemplate?: boolean
  framework: FrameworkType
  compiler?: CompilerType
}
type CustomPartial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type IProjectConfOptions = CustomPartial<IProjectConf, 'projectName' | 'projectDir' | 'template' | 'css' | 'npm' | 'framework' | 'templateSource'>
type CustomInquirerPrompts = Record<string, unknown>[]
type AskMethodsFunction = (conf: IProjectConfOptions, choices?: ITemplates[]) => CustomInquirerPrompts
type BasicAnswers = Pick<IProjectConf, 'projectName' | 'description' | 'framework' | 'typescript' | 'css' | 'npm'>
type CompilerAndTemplateSourceAnswers = Pick<IProjectConf, 'compiler' | 'templateSource'>
type TemplateAnswers = Pick<IProjectConf,'template'>
type TemplateSourceAnswers = Pick<IProjectConf, 'templateSource'>
type FetchTemplatesParameter = BasicAnswers & CompilerAndTemplateSourceAnswers

export default class Project extends Creator {
  public rootPath: string
  public conf: IProjectConfOptions

  constructor (options: IProjectConfOptions) {
    super(options.sourceRoot)
    const isUnsupprotedVersion = semver.lt(process.version, LOWEST_SUPPORTED_VERSION)
    if (isUnsupprotedVersion) {
      throw new Error(`Node.js 版本过低，推荐升级 Node.js 至 ${LOWEST_SUPPORTED_VERSION}+`)
    }

    this.rootPath = this._rootPath
    this.conf = Object.assign(
      {
        projectName: '',
        projectDir: '',
        template: '',
        description: '',
        npm: ''
      },
      options
    )
  }

  init () {
    clearConsole()
    console.log(chalk.green('Taro 即将创建一个新项目!'))
    console.log(`Need help? Go and open issue: ${chalk.blueBright('https://tls.jd.com/taro-issue-helper')}`)
    console.log()
  }

  async create () {
    try {
      const answers = await this.ask()
      const date = new Date()
      this.conf = Object.assign(this.conf, answers)
      this.conf.date = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
      this.write()
    } catch (error) {
      console.log(chalk.red('创建项目失败: ', error))
    }
  }

  async ask (): Promise<Partial<IProjectConf>> {
    const conf = this.conf

    /************************ 询问基本信息 *************************/
    const projectNamePrompts = this.askProjectName(conf)
    const descriptionPrompts = this.askDescription(conf)
    const frameworkPrompts = this.askFramework(conf)
    const typescriptPrompts = this.askTypescript(conf)
    const cssPrompts = this.askCSS(conf)
    const npmPrompts = this.askNpm(conf)
    const basicPrompts = [
      ...projectNamePrompts,
      ...descriptionPrompts,
      ...frameworkPrompts,
      ...typescriptPrompts,
      ...cssPrompts,
      ...npmPrompts,
    ]
    const basicAnswers = await inquirer.prompt<BasicAnswers>(basicPrompts)

    /************************ 询问编译工具和模版来源 *****************/
    const isSolidFramework = [basicAnswers.framework, conf.framework].includes(FrameworkType.Solid)
    // TODO: 读到这里了
    const templateSourcePrompts = await this.askTemplateSource(conf)
    const compilerPrompts = !isSolidFramework ?this.askCompiler(conf) :[]
    const compilerAndTemplateSourcePrompts = [
      ...compilerPrompts,
      ...templateSourcePrompts,
    ]
    const compilerAndTemplateSourceAnswers = await inquirer.prompt<CompilerAndTemplateSourceAnswers>(compilerAndTemplateSourcePrompts)
    const mergedCompiler = isSolidFramework ?CompilerType.Webpack5:  compilerAndTemplateSourceAnswers.compiler
    const mergedCompilerAndTemplateSourceAnswers = {
      ...compilerAndTemplateSourceAnswers,
      compiler: mergedCompiler,
    }

    /************************ 询问模版类型 *************************/
    const templateChoices = await this.fetchTemplates({
      ...basicAnswers,
      ...mergedCompilerAndTemplateSourceAnswers,
    })
    const templatePrompts = this.askTemplate(conf, templateChoices)
    const templateAnswers = await inquirer.prompt<TemplateAnswers>(templatePrompts)

    return {
      ...basicAnswers,
      ...mergedCompilerAndTemplateSourceAnswers,
      ...templateAnswers,
    }
  }

  askProjectName: AskMethodsFunction = function ({ projectName }) {
    if (typeof projectName !== 'string') {
      return [{
        message: '请输入项目名称！',
        name: 'projectName',
        type: 'input',
        validate (input: string) {
          if (!input) {
            return '项目名不能为空！'
          }
          if (fs.existsSync(input)) {
            return '当前目录已经存在同名项目，请换一个项目名！'
          }
          return true
        }
      }]
    }
    if (fs.existsSync(projectName!)) {
      return [{
        message: '当前目录已经存在同名项目，请换一个项目名！',
        name: 'projectName',
        type: 'input',
        validate (input: string) {
          if (!input) {
            return '项目名不能为空！'
          }
          if (fs.existsSync(input)) {
            return '项目名依然重复！'
          }
          return true
        }
      }]
    }
    return []
  }

  askDescription: AskMethodsFunction = function ({ description }) {
    if (typeof description === 'string') return []

    return [{
      message: '请输入项目介绍',
      name: 'description',
      type: 'input',
    }]
  }

  askTypescript: AskMethodsFunction = function ({ typescript }) {
    if (typeof typescript === 'boolean') return []

    return [{
      message: '是否需要使用 TypeScript ？',
      name: 'typescript',
      type: 'confirm',
    }]
  }

  askCSS: AskMethodsFunction = function ({ css }) {
    if (typeof css === 'string') return []

    const cssChoices = [
      {
        name: 'Sass',
        value: CSSType.Sass
      },
      {
        name: 'Less',
        value: CSSType.Less
      },
      {
        name: 'Stylus',
        value: CSSType.Stylus
      },
      {
        name: '无',
        value: CSSType.None
      }
    ]
    return [{
      message: '请选择 CSS 预处理器（Sass/Less/Stylus）',
      name: 'css',
      type: 'list',
      choices: cssChoices
    }]
  }

  askCompiler: AskMethodsFunction = function ({ compiler }) {
    if (typeof compiler === 'string') return []

    const compilerChoices = [
      {
        name: 'Webpack5',
        value: CompilerType.Webpack5
      },
      {
        name: 'Vite',
        value: CompilerType.Vite
      }
    ]
    return [{
      message: '请选择编译工具',
      name: 'compiler',
      type: 'list',
      choices: compilerChoices
    }]
  }

  askFramework: AskMethodsFunction = function ({ framework }) {
    if (typeof framework === 'string') return []

    const frameworkChoices = [
      {
        name: 'React',
        value: FrameworkType.React
      },
      {
        name: 'PReact',
        value: FrameworkType.Preact
      },
      {
        name: 'Vue3',
        value: FrameworkType.Vue3
      },
      {
        name: 'Solid',
        value: FrameworkType.Solid
      }
    ]
    return [{
      message: '请选择框架',
      name: 'framework',
      type: 'list',
      choices: frameworkChoices
    }]
  }

  askNpm: AskMethodsFunction = function ({ npm }) {
    if (typeof npm === 'string') return []

    const packageChoices = [
      {
        name: 'yarn',
        value: NpmType.Yarn
      },
      {
        name: 'pnpm',
        value: NpmType.Pnpm
      },
      {
        name: 'npm',
        value: NpmType.Npm
      },
      {
        name: 'cnpm',
        value: NpmType.Cnpm
      }
    ]
    return [{
      message: '请选择包管理工具',
      name: 'npm',
      type: 'list',
      choices: packageChoices
    }]
  }

  // TODO: 看到这里了，怎样确定 answers 的类型
  async askTemplateSource({ template, templateSource }: IProjectConfOptions): Promise<CustomInquirerPrompts> {
    if (template === 'default' || templateSource) return []

    const homedir = getUserHomeDir()
    const taroConfigPath = path.join(homedir, TARO_CONFIG_FOLDER)
    const taroConfig = path.join(taroConfigPath, TARO_BASE_CONFIG)

    let localTemplateSource: string
    // 检查本地配置
    if (fs.existsSync(taroConfig)) {
      // 存在则把模板源读出来
      const config = await fs.readJSON(taroConfig)
      localTemplateSource = config?.templateSource
    } else {
      // 不存在则创建配置
      await fs.createFile(taroConfig)
      await fs.writeJSON(taroConfig, { templateSource: DEFAULT_TEMPLATE_SRC })
      localTemplateSource = DEFAULT_TEMPLATE_SRC
    }

    const templateSourceChoices = [
      {
        name: 'Gitee（最快）',
        value: DEFAULT_TEMPLATE_SRC_GITEE
      },
      {
        name: 'Github（最新）',
        value: DEFAULT_TEMPLATE_SRC
      },
      {
        name: 'CLI 内置默认模板',
        value: 'default-template'
      },
      {
        name: '自定义',
        value: 'self-input'
      },
      {
        name: '社区优质模板源',
        value: 'open-source'
      }
    ]

    if (localTemplateSource && localTemplateSource !== DEFAULT_TEMPLATE_SRC && localTemplateSource !== DEFAULT_TEMPLATE_SRC_GITEE) {
      templateSourceChoices.unshift({
        name: `本地模板源：${localTemplateSource}`,
        value: localTemplateSource
      })
    }

    return [{
      message: '请选择模板源',
      name: 'templateSource',
      type: 'list',
      choices: templateSourceChoices,
    }, {
      message: '请输入模板源！',
      name: 'templateSource',
      type: 'input',
      askAnswered: true,
      // TODO: 看到这里了，怎样确定 answers 的类型
      when (answers: TemplateSourceAnswers) {
        return answers.templateSource === 'self-input'
      }
    }, {
      message: '请选择社区模板源',
      name: 'templateSource',
      type: 'list',
      // TODO: 看到这里了，怎样确定 answers 的类型
      async choices (answers: TemplateSourceAnswers & BasicAnswers) {
        // TODO: 看到这里了
        return await getOpenSourceTemplates(answers.framework)
      },
      askAnswered: true,
      // TODO: 看到这里了，怎样确定 answers 的类型
      when (answers: TemplateSourceAnswers) {
        return answers.templateSource === 'open-source'
      }
    }]
  }

  askTemplate: AskMethodsFunction = function ({ template, hideDefaultTemplate }, initialTemplateChoices = []) {
    if (typeof template === 'string') return []

    const templateChioces = initialTemplateChoices.map(({ desc, name, value }) => ({
      name: String(name) + (!!desc? ` （${desc}）` :''),
      value: value || name
    }))
    if (!hideDefaultTemplate) {
      templateChioces.unshift({
        name: '默认模板',
        value: 'default'
      })
    }
    return [{
      message: '请选择模板',
      name: 'template',
      type: 'list',
      choices: templateChioces,
    }]
  }

  // TODO: 待优化 fetchTemplates 是否是放在 askTemplate 里面获取 choices 函数的，不是作为参数传入，保持和其他 ask 一致的代码风格，在函数内获取 choices
  async fetchTemplates (answers: FetchTemplatesParameter): Promise<ITemplates[]> {
    const { templateSource, framework, compiler } = answers
    this.conf.framework = this.conf.framework || framework || ''
    this.conf.templateSource = this.conf.templateSource || templateSource

    // 使用默认模版
    if (answers.templateSource === 'default-template') {
      this.conf.template = 'default'
      answers.templateSource = DEFAULT_TEMPLATE_SRC_GITEE
    }
    if (this.conf.template === 'default' || answers.templateSource === NONE_AVAILABLE_TEMPLATE) return Promise.resolve([])

    // 从模板源下载模板
    const isClone = /gitee/.test(this.conf.templateSource) || this.conf.clone
    const templateChoices = await fetchTemplate(this.conf.templateSource, this.templatePath(''), isClone)

    const filterFramework = (_framework) => {
      const current = this.conf.framework?.toLowerCase()

      if (typeof _framework === 'string' && _framework) {
        return current === _framework.toLowerCase()
      } else if (isArray(_framework)) {
        return _framework?.map(name => name.toLowerCase()).includes(current)
      } else {
        return true
      }
    }

    const filterCompiler = (_compiler) => {
      if (_compiler && isArray(_compiler)) {
        return _compiler?.includes(compiler)
      }
      return true
    }

    // 根据用户选择的框架筛选模板
    const newTemplateChoices: ITemplates[] = templateChoices
      .filter(templateChoice => {
        const { platforms, compiler } = templateChoice
        return filterFramework(platforms) && filterCompiler(compiler)
      })

    return newTemplateChoices
  }

  write (cb?: () => void) {
    this.conf.src = SOURCE_DIR
    const { projectName, projectDir, template, autoInstall = true, framework, npm } = this.conf as IProjectConf
    // 引入模板编写者的自定义逻辑
    const templatePath = this.templatePath(template)
    const handlerPath = path.join(templatePath, TEMPLATE_CREATOR)
    const handler = fs.existsSync(handlerPath) ? require(handlerPath).handler : {}
    createProject({
      projectRoot: projectDir,
      projectName,
      template,
      npm,
      framework,
      css: this.conf.css || CSSType.None,
      autoInstall: autoInstall,
      templateRoot: getRootPath(),
      version: getPkgVersion(),
      typescript: this.conf.typescript,
      date: this.conf.date,
      description: this.conf.description,
      compiler: this.conf.compiler,
      period: PeriodType.CreateAPP,
    }, handler).then(() => {
      cb?.()
    })
  }
}

function getOpenSourceTemplates (platform: string) {
  return new Promise((resolve, reject) => {
    const spinner = ora({ text: '正在拉取开源模板列表...', discardStdin: false }).start()
    axios.get('https://gitee.com/NervJS/awesome-taro/raw/next/index.json')
      .then(response => {
        spinner.succeed(`${chalk.grey('拉取开源模板列表成功！')}`)
        const collection = response.data
        switch (platform.toLowerCase()) {
          case 'react':
            return resolve(collection.react)
          default:
            return resolve([NONE_AVAILABLE_TEMPLATE])
        }
      })
      .catch(_error => {
        spinner.fail(chalk.red('拉取开源模板列表失败！'))
        return reject(new Error())
      })
  })
}
