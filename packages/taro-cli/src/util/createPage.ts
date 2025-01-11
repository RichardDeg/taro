import { babelKit } from '@tarojs/helper'

// TODO: 这个是如何解决循环引用问题的，有没有优化空间
import { ModifyNodeState } from '../create/page'

import type { ArrayExpression, ExportDefaultDeclaration, Expression, ObjectExpression, ObjectProperty, PatternLike, SpreadElement } from '@babel/types'
import type { NodePath } from 'babel__traverse'

const t = babelKit.types

const buildSubPackagesAstNode = (subPackagesPath: string) => {
  const subPackagesRootAstNode = t.objectProperty(t.identifier('root'), t.stringLiteral(subPackagesPath))
  const pagesAstNode = t.objectProperty(t.identifier('pages'), t.arrayExpression([]))
  const subPackagesAstNode = t.objectExpression([subPackagesRootAstNode, pagesAstNode])
  return subPackagesAstNode
}

const findPropertyFromNode = (propertyKey: string, node?: ObjectExpression): ObjectProperty | undefined => {
  return node?.properties.find(property => property.type === 'ObjectProperty' && property.key.type === 'Identifier' && property.key?.name === propertyKey) as ObjectProperty | undefined
}

const isEqualElement = (elementValue: string, elementNode?: PatternLike | SpreadElement | Expression | null) => {
  return (elementNode?.type === 'BigIntLiteral' || elementNode?.type === 'DecimalLiteral' || elementNode?.type === 'StringLiteral') && elementNode.value === elementValue
}

const isValidSubPackagesElement = (subPackagesElement: ObjectExpression) => {
  const rootProperty = findPropertyFromNode('root', subPackagesElement)
  const pagesProperty = findPropertyFromNode('pages', subPackagesElement)
  return rootProperty?.value.type === 'StringLiteral' && pagesProperty?.value.type === 'ArrayExpression'
}

// TODO: 看到这里了
const modifySubPackagesNode = ({ pagesPath, subPackagesPath }: CommonModifyNodeParams, node?: ObjectExpression): ModifyNodeState => {
  let subPackagesProperty = findPropertyFromNode('subPackages', node)
  // 为空，写入默认空值 ast 节点
  if (!subPackagesProperty) {
    subPackagesProperty = t.objectProperty(t.identifier('subPackages'), t.arrayExpression([]))
    node?.properties.push(subPackagesProperty)
  }
  const subPackagesPropertyValue = subPackagesProperty.value
  if (subPackagesPropertyValue?.type !== 'ArrayExpression') {
    return ModifyNodeState.Fail
  }

  let subPackagesPropertyValueElement = subPackagesPropertyValue.elements.find(element => {
    return element?.type === 'ObjectExpression' && !!element?.properties?.find(elementProperty => {
      return elementProperty.type === 'ObjectProperty' && isEqualElement(subPackagesPath, elementProperty.value)
    })
  })
  // 为空，写入默认空值 元素
  if (!subPackagesPropertyValueElement) {
    subPackagesPropertyValueElement = buildSubPackagesAstNode(subPackagesPath)
    subPackagesPropertyValue.elements.push(subPackagesPropertyValueElement)
  }
  // TODO: 看到这里了
  if (subPackagesPropertyValueElement.type !== 'ObjectExpression' || !isValidSubPackagesElement(subPackagesPropertyValueElement)) {
    return ModifyNodeState.Fail
  }

  const pagesProperty: ObjectProperty = subPackagesPropertyValueElement.properties.find((property: ObjectProperty) => (property.key as any)?.name === 'pages') as ObjectProperty
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
  const pagesProperty = findPropertyFromNode('pages', node)
  const pagesPropertyValue = pagesProperty?.value
  if (pagesPropertyValue?.type !== 'ArrayExpression') {
    return ModifyNodeState.Fail
  }

  const pagesPropertyValueElement = !!pagesPropertyValue.elements.find(element => isEqualElement(pagesPath, element))
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
