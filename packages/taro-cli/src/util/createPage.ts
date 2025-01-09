import { babelKit } from '@tarojs/helper'

// TODO: 这个是如何解决循环引用问题的，有没有优化空间
import { ModifyNodeState } from '../create/page'

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

// TODO: 看到这里了
const modifySubPackagesNode = ({ pagesPath, subPackagesPath }: CommonModifyNodeParams, node?: ObjectExpression): ModifyNodeState => {
  let subPackagesProperty = node?.properties.find(property => property.type === 'ObjectProperty' && property.key.type === 'Identifier' && property.key.name === 'subPackages') as ObjectProperty
  if (!subPackagesProperty) {
    subPackagesProperty = t.objectProperty(t.identifier('subPackages'), t.arrayExpression([]))
    // 副作用
    node?.properties.push(subPackagesProperty)
  }
  // 文件格式不对的情况
  const subPackagesPropertyValue = subPackagesProperty.value
  if (subPackagesPropertyValue?.type !== 'ArrayExpression') {
    return ModifyNodeState.Fail
  }

  let targetSubPkgObject: ObjectExpression = subPackagesPropertyValue.elements.find(node => (node as any)?.properties?.find(property => (property as any)?.value?.value === subPackagesPath)) as ObjectExpression
  if (!targetSubPkgObject) {
    // 不存在 当前分包配置对象的情况
    const subPkgItemObject = generateNewSubPackageItem(subPackagesPath)
    targetSubPkgObject = subPkgItemObject
    subPackagesPropertyValue.elements.push(subPkgItemObject)
  }
  if (targetSubPkgObject.type !== 'ObjectExpression' || !isValidSubPkgObject(targetSubPkgObject)) {
    return ModifyNodeState.Fail
  }

  const pagesProperty: ObjectProperty = targetSubPkgObject.properties.find((property: ObjectProperty) => (property.key as any)?.name === 'pages') as ObjectProperty
  const currentPages = (pagesProperty.value as ArrayExpression).elements
  const isPageExists = Boolean(currentPages.find(node => (node as any).value === pagesPath))
  if (isPageExists) {
    return ModifyNodeState.NeedLess
  }

  currentPages.push(t.stringLiteral(pagesPath))
  return ModifyNodeState.Success
}

// 更新属性为 'pages' 的节点, 并返回更新结果
const modifyPagesNode = ({ pagesPath }: CommonModifyNodeParams, node?: ObjectExpression): ModifyNodeState => {
  const pagesProperty = node?.properties.find(property => property.type === 'ObjectProperty' && property.key.type === 'Identifier' && property.key.name === 'pages') as ObjectProperty
  if (!pagesProperty) {
    return ModifyNodeState.Fail
  }

  const pagesPropertyValue = pagesProperty.value
  if (pagesPropertyValue?.type !== 'ArrayExpression') {
    return ModifyNodeState.Fail
  }

  const pagesPropertyValueElement = Boolean(pagesPropertyValue.elements.find(element => (element?.type === 'BigIntLiteral' || element?.type === 'DecimalLiteral' || element?.type === 'StringLiteral') && element.value === pagesPath))
  if (!!pagesPropertyValueElement) {
    return ModifyNodeState.NeedLess
  }

  // 副作用：更新节点
  const targetPageElement = t.stringLiteral(pagesPath)
  pagesPropertyValue.elements.push(targetPageElement)
  return ModifyNodeState.Success
}

type CommonModifyNodeParams = {
  pagesPath: string
  subPackagesPath: string
}
type ModifyNodeParams = CommonModifyNodeParams & {
  pathNode: NodePath<ExportDefaultDeclaration>
}
// TODO: 看到这里了
export const modifyNode = ({ pathNode, pagesPath, subPackagesPath }: ModifyNodeParams): ModifyNodeState => {
  const nodeDeclaration = pathNode.node.declaration
  const mergedSubPackagesPath = !!subPackagesPath ?`${subPackagesPath}/` :''
  const mergedPagesPath = !!subPackagesPath ?pagesPath.split(mergedSubPackagesPath)[0] :pagesPath
  const cb = !!subPackagesPath ?modifySubPackagesNode :modifyPagesNode
  const cbFirstArg = { pagesPath: mergedPagesPath, subPackagesPath: mergedSubPackagesPath }

  let state = ModifyNodeState.Fail
  if (nodeDeclaration.type === 'CallExpression') {
    // eg: export default defineAppConfig({})
    if(nodeDeclaration.callee.type === 'V8IntrinsicIdentifier' && nodeDeclaration.callee.name === 'defineAppConfig') {
      const [ firstArg ] = nodeDeclaration.arguments
      const mergedNode = firstArg.type === 'ObjectExpression' ?firstArg :undefined
      state = cb(cbFirstArg, mergedNode)
    }
  } else if (nodeDeclaration.type === 'ObjectExpression') {
    // eg: export default {}
    state = cb(cbFirstArg, nodeDeclaration)
  }
  return state
}
