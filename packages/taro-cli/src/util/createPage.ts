import { babelKit } from '@tarojs/helper'

// TODO: 这个是如何解决循环引用问题的，有没有优化空间
import { ConfigModificationState } from '../create/page'

import type { ArrayExpression, ExportDefaultDeclaration, ObjectExpression, ObjectProperty } from '@babel/types'
import type { NodePath } from 'babel__traverse'

const t = babelKit.types

const generateNewSubPackageItem = (subPackage: string) => {
  const pageObject = t.objectProperty(t.identifier('pages'), t.arrayExpression([]))
  const subPkgRootObject = t.objectProperty(t.identifier('root'), t.stringLiteral(subPackage))
  const subPkgItemObject = t.objectExpression([subPkgRootObject, pageObject])
  return subPkgItemObject
}

const isValidSubPkgObject = (subPkgObject: ObjectExpression) => {
  const properties = subPkgObject?.properties || {}
  const rootProperty = properties.find((property: ObjectProperty) => (property.key as any)?.name === 'root') as ObjectProperty
  const pagesProperty = properties.find((property: ObjectProperty) => (property.key as any)?.name === 'pages') as ObjectProperty
  const rootPropertyValueType = rootProperty?.value?.type
  const pagesPropertyValueType = pagesProperty?.value?.type
  return rootPropertyValueType === 'StringLiteral' && pagesPropertyValueType === 'ArrayExpression'
}

// TODO: 抽离 addSubPackage & addPage 中 可复用的代码
const addSubPackage = (node: ObjectExpression, page: string, subPackage: string): ConfigModificationState => {
  let subPackages = node?.properties.find(node => (node as any).key.name === 'subPackages') as ObjectProperty
  if (!subPackages) {
  // config 文件不存在 subPackages 字段的情况，给该字段赋予默认值
    const subPkgObject = t.objectProperty(t.identifier('subPackages'), t.arrayExpression([]))
    subPackages = subPkgObject
    node?.properties.push(subPkgObject)
  }
  const value = subPackages?.value

  // 文件格式不对的情况
  if (!value || value?.type !== 'ArrayExpression') return ConfigModificationState.Fail
  let targetSubPkgObject: ObjectExpression = value.elements.find(node => (node as any)?.properties?.find(property => (property as any)?.value?.value === subPackage)) as ObjectExpression

  if (!targetSubPkgObject) {
    // 不存在 当前分包配置对象的情况
    const subPkgItemObject = generateNewSubPackageItem(subPackage)
    targetSubPkgObject = subPkgItemObject
    value.elements.push(subPkgItemObject)
  }

  if (targetSubPkgObject.type !== 'ObjectExpression' || !isValidSubPkgObject(targetSubPkgObject)) return ConfigModificationState.Fail
  const pagesProperty: ObjectProperty = targetSubPkgObject.properties.find((property: ObjectProperty) => (property.key as any)?.name === 'pages') as ObjectProperty
  const currentPages = (pagesProperty.value as ArrayExpression).elements
  const isPageExists = Boolean(currentPages.find(node => (node as any).value === page))

  if (isPageExists) return ConfigModificationState.NeedLess

  currentPages.push(t.stringLiteral(page))
  return ConfigModificationState.Success
}

// TODO: ts 有些使用复杂问题
// TODO: 定义一个类型守卫函数，接收 node.properties 的入参，返回指定类型的 单个 node 节点
// TODO: 抽离 addSubPackage & addPage 中 可复用的代码
const addPage = (node: ObjectExpression, page: string): ConfigModificationState => {
  // TODO: 参考 第 60 行注释，将 as 类型断言，移除
  const pages = node?.properties.find(node => (node.type === 'ObjectMethod' || node.type === 'ObjectProperty') && node.key.type === 'Identifier' && node.key.name === 'pages') as ObjectProperty
  if (!pages) return ConfigModificationState.Fail

  const value = pages?.value
  // 仅处理 pages 为数组字面量的情形
  if (!value || value?.type !== 'ArrayExpression') return ConfigModificationState.Fail

  const isPageExists = Boolean(value.elements.find(node => (node as any).value === page))
  if (isPageExists) return ConfigModificationState.NeedLess

  const newArrayElement = t.stringLiteral(page)
  value.elements.push(newArrayElement)
  return ConfigModificationState.Success
}

// TODO: 函数变量名待考量
const getConfigModificationState = (path: NodePath<ExportDefaultDeclaration>, { page, pkg }: GetPageConfigReturn, cb: Function): ConfigModificationState => {
  let state = ConfigModificationState.Fail
  const node = path.node.declaration
  // Case 1. `export default defineAppConfig({})` 这种情况
  if (node.type === 'CallExpression') {
    if(node.callee.type === 'V8IntrinsicIdentifier' && node.callee.name === 'defineAppConfig') {
      const [ configNode ] = node.arguments
      state = cb(configNode, page, pkg)
    }
  }
  // Case 2. `export default {}` 这种情况
  if (node.type === 'ObjectExpression') {
    state = cb(node, page, pkg)
  }
  return state
}

type GetPageConfigReturn = {
  page: string
  pkg: string
}
const getPageConfig = (fullPagePath: string, subPkgRootPath?: string): GetPageConfigReturn => {
  if(!subPkgRootPath) return { page: fullPagePath, pkg: '' }

  const pkg = `${subPkgRootPath}/`
  const [ _, page ] = fullPagePath.split(pkg)
  return { pkg, page }
}

type ModifyPagesOrSubPackagesParams = {
  path: NodePath<ExportDefaultDeclaration>
  fullPagePath: string
  subPkgRootPath?: string
}
// TODO: 看到这里了, 函数名有待考量
export const modifyPagesOrSubPackages = ({ fullPagePath, subPkgRootPath, path }: ModifyPagesOrSubPackagesParams): ConfigModificationState => {
  // TODO: 函数命名 以及 变量名 有待考量
  const pageConfig = getPageConfig(fullPagePath, subPkgRootPath)
  // TODO: 这两个子函数有优化的空间
  const cb = !!subPkgRootPath ?addSubPackage :addPage
  return getConfigModificationState(path, pageConfig, cb)
}
