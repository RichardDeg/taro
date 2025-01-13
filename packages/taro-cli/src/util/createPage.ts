import { babelKit } from '@tarojs/helper'

import { ExportDefaultDeclaration, Expression, ObjectExpression, ObjectProperty, PatternLike, SpreadElement } from '@babel/types'
import type { NodePath } from 'babel__traverse'

const t = babelKit.types

export enum ModifyNodeState {
  Success,
  Fail,
  NeedLess
}

const buildEmptyArrayAstNode = (identifierName: string) => {
  return t.objectProperty(t.identifier(identifierName), t.arrayExpression([]))
}

const buildSubPackagesAstNode = (subPackagesPath: string) => {
  const subPackagesRootAstNode = t.objectProperty(t.identifier('root'), t.stringLiteral(subPackagesPath))
  const pagesAstNode = buildEmptyArrayAstNode('pages')
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

// 更新属性为 'pages' 的节点, 并返回更新结果
const modifyPagesNode = (pagesPath: string, node?: ObjectExpression): ModifyNodeState => {
  const pagesProperty = findPropertyFromNode('pages', node)
  const pagesPropertyValue = pagesProperty?.value
  if (pagesPropertyValue?.type !== 'ArrayExpression') {
    return ModifyNodeState.Fail
  }

  const pagesPropertyValueElement = pagesPropertyValue.elements.find(element => isEqualElement(pagesPath, element))
  if (!!pagesPropertyValueElement) {
    return ModifyNodeState.NeedLess
  }

  // 副作用：更新节点
  pagesPropertyValue.elements.push(t.stringLiteral(pagesPath))
  return ModifyNodeState.Success
}

// 更新属性为 'subPackages'、'pages' 的节点, 并返回更新结果
const modifySubPackagesNode = ({ pagesPath, subPackagesPath }: Pick<ModifyNodeParams, 'pagesPath'|'subPackagesPath'>, node?: ObjectExpression): ModifyNodeState => {
  let subPackagesProperty = findPropertyFromNode('subPackages', node)
  // 副作用：写入默认空节点
  if (!subPackagesProperty) {
    subPackagesProperty = buildEmptyArrayAstNode('subPackages')
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
  // 副作用：写入默认空元素
  if (!subPackagesPropertyValueElement) {
    subPackagesPropertyValueElement = buildSubPackagesAstNode(subPackagesPath)
    subPackagesPropertyValue.elements.push(subPackagesPropertyValueElement)
  }
  if (subPackagesPropertyValueElement.type !== 'ObjectExpression' || !isValidSubPackagesElement(subPackagesPropertyValueElement)) {
    return ModifyNodeState.Fail
  }

  return modifyPagesNode(pagesPath, subPackagesPropertyValueElement)
}

type ModifyNodeParams = {
  pathNode: NodePath<ExportDefaultDeclaration>
  pagesPath: string
  subPackagesPath: string
}
export const modifyNode = ({ pathNode, pagesPath, subPackagesPath }: ModifyNodeParams): ModifyNodeState => {
  const nodeDeclaration = pathNode.node.declaration
  const mergedSubPackagesPath = !!subPackagesPath ?`${subPackagesPath}/` :''
  const mergedPagesPath = !!subPackagesPath ?pagesPath.split(mergedSubPackagesPath)[0] :pagesPath
  const commonParams = { pagesPath: mergedPagesPath, subPackagesPath: mergedSubPackagesPath }

  // eg: export default defineAppConfig({})
  if (nodeDeclaration.type === 'CallExpression' && nodeDeclaration.callee.type === 'V8IntrinsicIdentifier' && nodeDeclaration.callee.name === 'defineAppConfig') {
    const [ firstArg ] = nodeDeclaration.arguments
    const mergedNode = firstArg.type === 'ObjectExpression' ? firstArg : undefined
    return !!subPackagesPath ? modifySubPackagesNode(commonParams, mergedNode) : modifyPagesNode(mergedPagesPath, mergedNode)
  }
  // eg: export default {}
  if (nodeDeclaration.type === 'ObjectExpression') {
    return !!subPackagesPath ? modifySubPackagesNode(commonParams, nodeDeclaration) : modifyPagesNode(mergedPagesPath, nodeDeclaration)
  }
  return ModifyNodeState.Fail
}
