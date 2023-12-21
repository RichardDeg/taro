/* eslint-disable accessor-pairs */
// @ts-nocheck
import { ObjectAssign, TaroAny } from '../../'
import { FlexManager, getNodeMarginOrPaddingData, getUnit } from './util'

import type { HarmonyStyle, HarmonyType, TaroStyleType, TaroTextStyleType } from './type'

export { HarmonyStyle, HarmonyType, TaroStyleType, TaroTextStyleType }

export default class StyleSheet {

  public hmStyle: HarmonyStyle = {}

  get display () {
    return this.hmStyle.display
  }

  set display (value: string) {
    this.hmStyle.display = value
  }

  get position () {
    return this.hmStyle.position
  }

  set position (value: string) {
    this.hmStyle.position = value
  }

  get padding () {
    const { top = 0, right = 0, bottom = 0, left = 0 } = this.hmStyle.padding || {}
    return `${top} ${right} ${bottom} ${left}`
  }

  set padding (value: string) {
    this.hmStyle.padding = getNodeMarginOrPaddingData(value)
  }

  set _padding (value: Margin) {
    this.hmStyle.padding = value
  }

  get paddingTop () {
    return this.hmStyle.padding?.top
  }

  set paddingTop (value: string) {
    this.hmStyle.padding = ObjectAssign({}, this.hmStyle.padding, { top: getUnit(value) })
  }

  get paddingBottom () {
    return this.hmStyle.padding?.bottom
  }

  set paddingBottom (value: string) {
    this.hmStyle.padding = ObjectAssign({}, this.hmStyle.padding, { bottom: getUnit(value) })
  }

  get paddingRight () {
    return this.hmStyle.padding?.right
  }

  set paddingRight (value: string) {
    this.hmStyle.padding = ObjectAssign({}, this.hmStyle.padding, { right: getUnit(value) })
  }

  get paddingLeft () {
    return this.hmStyle.padding?.left
  }

  set paddingLeft (value: string) {
    this.hmStyle.padding = ObjectAssign({}, this.hmStyle.padding, { left: getUnit(value) })
  }

  get margin () {
    const { top = 0, right = 0, bottom = 0, left = 0 } = this.hmStyle.margin || {}
    return `${top} ${right} ${bottom} ${left}`
  }

  set margin (value: string) {
    this.hmStyle.margin = getNodeMarginOrPaddingData(value)
  }

  set _margin (value: Margin) {
    this.hmStyle.margin = value
  }

  get marginTop () {
    return this.hmStyle.margin?.top
  }

  set marginTop (value: string) {
    this.hmStyle.margin = ObjectAssign({}, this.hmStyle.margin, { top: getUnit(value) })
  }

  get marginBottom () {
    return this.hmStyle.margin?.bottom
  }

  set marginBottom (value: string) {
    this.hmStyle.margin = ObjectAssign({}, this.hmStyle.margin, { bottom: getUnit(value) })
  }

  get marginRight () {
    return this.hmStyle.margin?.right
  }

  set marginRight (value: string) {
    this.hmStyle.margin = ObjectAssign({}, this.hmStyle.margin, { right: getUnit(value) })
  }

  get marginLeft () {
    return this.hmStyle.margin?.left
  }

  set marginLeft (value: string) {
    this.hmStyle.margin = ObjectAssign({}, this.hmStyle.margin, { left: getUnit(value) })
  }

  get top () {
    return this.hmStyle.top
  }

  set top (value: string | number) {
    this.hmStyle.top = getUnit(value)
  }

  set _top (value: Length) {
    this.hmStyle.top = value
  }

  get left () {
    return this.hmStyle.left
  }

  set left (value: string | number) {
    this.hmStyle.left = getUnit(value)
  }

  set _left (value: Length) {
    this.hmStyle.left = value
  }

  get flex () {
    return this.hmStyle.flex
  }

  set flex (value: string | number) {
    let res: [number, number, number | string] = [0, 0, 'auto']

    if (typeof value === 'number') {
      res = [value, 1, 0]
    } else if (value === 'auto') {
      res = [1, 1, 'auto']
    } else if (value === 'none') {
      res = [0, 0, 'auto']
    } else if (typeof value === 'string') {
      const FlexList = value.replace(new RegExp('/\\s+/g'), ' ').split(' ')
      FlexList.forEach((item, index) => {
        res[index] = index < 2 ? Number(item) : item
      })
    }

    this.flexGrow = res[0]
    this.flexShrink = res[1]
    this.flexBasis = res[2]
    this.hmStyle.flex = value
  }

  get flexBasis () {
    return this.hmStyle.flexBasis
  }

  set flexBasis (value: string) {
    this.hmStyle.flexBasis = getUnit(value)
  }

  set _flexBasis (value: number | string) {
    this.hmStyle.flexBasis = value
  }

  get flexGrow () {
    return Number(this.hmStyle.flexGrow)
  }

  set flexGrow (value: number | string) {
    this.hmStyle.flexGrow = Number(value)
  }

  set _flexGrow (value: number) {
    this.hmStyle.flexGrow = value
  }

  get flexShrink () {
    return Number(this.hmStyle.flexShrink)
  }

  set flexShrink (value: number | string) {
    this.hmStyle.flexShrink = Number(value)
  }

  set _flexShrink (value: number) {
    this.hmStyle.flexShrink = value
  }

  get alignSelf () {
    return FlexManager.reverseItemAlign(this.hmStyle.alignSelf)
  }

  set alignSelf (value: string | number) {
    this.hmStyle.alignSelf = FlexManager.itemAlign(value)
  }

  set _alignSelf (value: ItemAlign) {
    this.hmStyle.alignSelf = value
  }

  set _flexOptions (value) {
    if (typeof value.direction !== 'undefined') {
      this.hmStyle.direction = value.direction
    }
    if (typeof value.justifyContent !== 'undefined') {
      this.hmStyle.justifyContent = value.justifyContent
    }
    if (typeof value.alignItems !== 'undefined') {
      this.hmStyle.alignItems = value.alignItems
    }
    if (typeof value.wrap !== 'undefined') {
      this.hmStyle.flexWrap = value.wrap
    }
    if (typeof value.alignContent !== 'undefined') {
      this.hmStyle.alignContent = value.alignContent
    }
  }

  get flexDirection () {
    return FlexManager.reverseDirection(this.hmStyle.direction)
  }

  set flexDirection (value: string) {
    this.hmStyle.direction = FlexManager.direction(value)
  }

  get justifyContent () {
    return FlexManager.reverseFlexAlign(this.hmStyle.justifyContent)
  }

  set justifyContent (value: string) {
    this.hmStyle.justifyContent = FlexManager.flexAlign(value)
  }

  get alignItems () {
    return FlexManager.reverseItemAlign(this.hmStyle.alignItems)
  }

  set alignItems (value: string) {
    this.hmStyle.alignItems = FlexManager.itemAlign(value)
  }

  get alignContent () {
    return FlexManager.reverseFlexAlign(this.hmStyle.alignContent)
  }

  set alignContent (value: string) {
    this.hmStyle.alignContent = FlexManager.flexAlign(value)
  }

  get flexWrap () {
    return FlexManager.reverseFlexWrap(this.hmStyle.wrap)
  }

  set flexWrap (value: string) {
    this.hmStyle.wrap = FlexManager.flexWrap(value)
  }

  get width () {
    return this.hmStyle.width
  }

  set width (value: string | number) {
    this.hmStyle.width = getUnit(value)
  }

  set _width (value: Length) {
    this.hmStyle.width = value
  }

  get height () {
    return this.hmStyle.height
  }

  set height (value: string | number) {
    this.hmStyle.height = getUnit(value)
  }

  set _height (value: Length) {
    this.hmStyle.height = value
  }
  
  set _constraintSize(value: ConstraintSizeOptions) {
    this.hmStyle.constraintSize = value
  }

  get minHeight () {
    return this.hmStyle.constraintSize?.minHeight
  }

  set minHeight (value: string | number) {
    this._minHeight = getUnit(value)
  }

  get maxHeight () {
    return this.hmStyle.constraintSize?.maxHeight
  }

  set maxHeight (value: string | number) {
    this._maxHeight = getUnit(value)
  }

  get minWidth () {
    return this.hmStyle.constraintSize?.minWidth
  }

  set minWidth (value: string | number) {
    this._minWidth = getUnit(value)
  }

  get maxWidth () {
    return this.hmStyle.constraintSize?.maxWidth
  }

  set maxWidth (value: string | number) {
    this._maxWidth = getUnit(value)
  }

  get background () {
    return `${this.backgroundColor} ${this.backgroundImage} ${this.backgroundRepeat} ${this.backgroundSize}`.trim()
  }

  // TODO: 未实现
  set background (value: string) {
    
  }

  set _background (value: TaroAny) {
    const _backgroundImage: HarmonyType.Background.backgroundImage = value?.image?.[0]
    if (_backgroundImage) {
      this.hmStyle.backgroundImage = _backgroundImage.src
      if (_backgroundImage.repeat) {
        this.hmStyle.backgroundRepeat = _backgroundImage.repeat
      }
    }
    this.hmStyle.backgroundImageSize = value?.size?.[0]
    this.hmStyle.backgroundColor = this.hmStyle.backgroundImage ? null : value?.color

    const _backgroundPosition: HarmonyType.Background.backgroundImagePosition = value?.position?.[0]
    this.hmStyle.backgroundImagePosition = _backgroundPosition
  }

  get backgroundColor () {
    return this.hmStyle.backgroundColor
  }

  set backgroundColor (value: string) {
    this.hmStyle.backgroundColor = value
  }

  get backgroundImage () {
    return this.hmStyle.backgroundImage && `url(${this.hmStyle.backgroundImage})`
  }

  set backgroundImage (value: string) {
    if (typeof value === 'string' && value.indexOf('url(') !== -1 && value.indexOf(')') !== -1) {
      // 如果包含 url()，则说明是 background-image 属性
      const match = value.match(new RegExp('url\\([\'"]?(.*?)[\'"]?\\)'))
      if (match) {
        this.hmStyle.backgroundImage = match[1]
      }
    }
  }

  get backgroundRepeat () {
    if (this.hmStyle.backgroundRepeat) {
      switch (this.hmStyle.backgroundRepeat) {
        case ImageRepeat.X: return 'repeat-x'; break
        case ImageRepeat.Y: return 'repeat-y'; break
        case ImageRepeat.XY: return 'repeat'; break
        case ImageRepeat.NoRepeat: return 'no-repeat'; break
      } 
    }
  }

  set backgroundRepeat (value: string) {
    if (typeof value === 'string') {
      switch (value) {
        case 'repeat-x': this.hmStyle.backgroundRepeat = ImageRepeat.X; break
        case 'repeat-y': this.hmStyle.backgroundRepeat = ImageRepeat.Y; break
        case 'no-repeat': this.hmStyle.backgroundRepeat = ImageRepeat.NoRepeat; break
        default: this.hmStyle.backgroundRepeat = ImageRepeat.XY; break
      }
    }
  }

  get backgroundSize () {
    if (this.hmStyle.backgroundImage) {
      return [this.hmStyle.backgroundImageSize.width, this.hmStyle.backgroundImageSize.height].join(' ')
    }
  }

  set backgroundSize (value: string) {
    if (typeof value === 'string') {
      const sizes = value.split(' ')
      if (sizes.length === 1) {
        this.hmStyle.backgroundImageSize = { width: getUnit(sizes[0]) }
      } else if (sizes.length === 2) {
        this.hmStyle.backgroundImageSize = { width: getUnit(sizes[0]), height: getUnit(sizes[1]) }
      }
    }
  }

  get backgroundPosition () {
    if (this.hmStyle.backgroundImagePosition) {
      switch (this.hmStyle.backgroundImagePosition) {
        case Alignment.TopStart: return 'left top'; break
        case Alignment.Top: return 'center top'; break
        case Alignment.TopEnd: return 'right top'; break
        case Alignment.Start: return 'left center'; break
        case Alignment.Center: return 'center center'; break
        case Alignment.End: return 'right center'; break
        case Alignment.BottomStart: return 'left bottom'; break
        case Alignment.Bottom: return 'center bottom'; break
        case Alignment.BottomEnd: return 'right bottom'; break
        default: {
          if (this.hmStyle.backgroundImagePosition) {
            return [this.hmStyle.backgroundImagePosition, this.hmStyle.backgroundImagePosition.y].join(' ')
          }
        }
      }
    }
  }

  set backgroundPosition (value: string) {
    if (typeof value === 'string') {
      const positions = backgroundImagePosition.split(' ')
      const horizontal = positions[0].toLowerCase()
      const vertical = positions[1].toLowerCase() || 'top'

      if (horizontal === 'left' && vertical === 'top') {
        this.hmStyle.backgroundImagePosition = Alignment.TopStart
      } else if (horizontal === 'center' && vertical === 'top') {
        this.hmStyle.backgroundImagePosition = Alignment.Top
      } else if (horizontal === 'right' && vertical === 'top') {
        this.hmStyle.backgroundImagePosition = Alignment.TopEnd
      } else if (horizontal === 'left' && vertical === 'center') {
        this.hmStyle.backgroundImagePosition = Alignment.Start
      } else if (horizontal === 'center' && vertical === 'center') {
        this.hmStyle.backgroundImagePosition = Alignment.Center
      } else if (horizontal === 'right' && vertical === 'center') {
        this.hmStyle.backgroundImagePosition = Alignment.End
      } else if (horizontal === 'left' && vertical === 'bottom') {
        this.hmStyle.backgroundImagePosition = Alignment.BottomStart
      } else if (horizontal === 'center' && vertical === 'bottom') {
        this.hmStyle.backgroundImagePosition = Alignment.Bottom
      } else if (horizontal === 'right' && vertical === 'bottom') {
        this.hmStyle.backgroundImagePosition = Alignment.BottomEnd
      } else {
        if (/^\d+(\.\d+)?(px|%|vw|vh)$/.test(horizontal)) {
          this.hmStyle.backgroundImagePosition = { x: getUnit(horizontal) }
          if (/^\d+(\.\d+)?(px|%|vw|vh)$/.test(vertical)) {
            this.hmStyle.backgroundImagePosition = { x: getUnit(horizontal), y: getUnit(vertical) }
          }
        }
      }
    }
  }

  get border () {
    return [this.borderWidth, this.borderStyle, this.bordercolor].join(' ')
  }

  set border (value: string) {
    const [width, style, color] = value.split(' ')
    this.hmStyle.borderWidth = getUnit(width)
    this.hmStyle.borderStyle = BORDERhmStyleYLE_MAP.get(style)
    this.hmStyle.borderColor = color
  }

  get borderWidth () {
    return this.hmStyle.borderWidth
  }

  set borderWidth (value: string) {
    this.hmStyle.borderWidth = getUnit(value)
  }

  set _borderWidth (value: Length | EdgeWidths) {
    this.hmStyle.borderWidth = value
  }

  get borderColor () {
    return this.hmStyle.borderColor
  }

  set borderColor (value: string) {
    this.hmStyle.borderColor = value
  }

  set _borderColor (value: ResourceColor | EdgeColors) {
    this.hmStyle.borderColor = value
  }

  get borderStyle () {
    return BORDERhmStyleYLE_MAP.reverse(this.hmStyle.borderStyle)
  }

  set borderStyle (value: string) {
    this.hmStyle.borderStyle = BORDERhmStyleYLE_MAP.get(value)
  }

  set _borderStyle (value: BorderStyle | EdgeStyles) {
    this.hmStyle.borderStyle = value
  }
  
  get borderRadius () {
    return this.hmStyle.borderRadius
  }

  set borderRadius (value: string) {
    this.hmStyle.borderRadius = getUnit(value)
  }

  set _borderRadius (value: Length | BorderRadiuses) {
    this.hmStyle.borderRadius = value
  }

  get zIndex (): number {
    return Number(this.hmStyle.zIndex)
  }

  set zIndex (value: string) {
    this.hmStyle.zIndex = Number(value)
  }

  get opacity () {
    return this.hmStyle.opacity
  }

  set opacity (value: string) {
    const val = Number(value)

    this.hmStyle.opacity = Number.isNaN(val) ? 1 : val
  }

  get overflow () {
    return this.hmStyle.clip ? 'hidden' : 'visible'
  }

  set overflow (value: string) {
    this.hmStyle.clip = value === 'hidden'
  }

  get focus () {
    return !!this.hmStyle.focus
  }

  set focus (value: boolean) {
    this.hmStyle.focus = value
  }

  set _focus (value: boolean) {
    this.hmStyle.focus = value
  }

  // 文本相关
  get color () {
    return this.hmStyle.color
  }

  set color (value: string) {
    this.hmStyle.color = value
  }

  set _color (value: ResourceColor) {
    this.hmStyle.color = value
  }

  get fontSize () {
    return this.hmStyle.fontSize
  }

  set fontSize (value: string) {
    this.hmStyle.fontSize = getUnit(value)
  }

  set _fontSize (value: number | string | Resource) {
    this.hmStyle.fontSize = value
  }

  get fontWeight () {
    return this.hmStyle.fontWeight
  }

  set fontWeight (value: string) {
    this.hmStyle.fontWeight = value
  }

  set _fontWeight (value: number | FontWeight | string) {
    this.hmStyle.fontWeight = value
  }

  get fontStyle () {
    switch (this.hmStyle.fontStyle) {
      case FontStyle.Italic: return 'italic'; break
      case FontStyle.Normal: return 'normal'; break
      default: return ''
    }
  }

  set fontStyle (value: string) {
    switch (value) {
      case 'italic':
        return FontStyle.Italic
      default:
        return FontStyle.Normal
    }
  }

  set _fontStyle (value: FontStyle) {
    this.hmStyle.fontStyle = value
  }

  get fontFamily () {
    return this.hmStyle.fontFamily
  }

  set fontFamily (value: string) {
    this.hmStyle.fontFamily = value
  }

  set _fontFamily (value: string | Resource) {
    this.hmStyle.fontFamily = value
  }
  
  get textAlign () {
    switch (this.hmStyle.textAlign) {
      case TextAlign.End: return 'right'; break
      case TextAlign.Center: return 'center'; break
      case TextAlign.Start: return 'left'; break
      default: return ''
    }
  }

  set textAlign (value: string) {
    switch (value) {
      case 'right':
        return TextAlign.End
      case 'center':
        return TextAlign.Center
      default:
        return TextAlign.Start
    }
  }

  set _textAlign (value: TextAlign) {
    this.hmStyle.textAlign = value
  }

  get lineHeight () {
    return this.hmStyle.lineHeight
  }

  set lineHeight (value: string) {
    this.hmStyle.lineHeight = getUnit(value)
  }

  set _lineHeight (value: string | number | Resource) {
    this.hmStyle.lineHeight = value
  }

  get letterSpacing () {
    return this.hmStyle.letterSpacing
  }

  set letterSpacing (value: string) {
    this.hmStyle.letterSpacing = getUnit(value)
  }

  set _letterSpacing (value: number | string) {
    this.hmStyle.letterSpacing = value
  }
 
  get textDecoration () {
    switch (this.hmStyle.decoration) {
      case TextDecorationType.Underline: return 'underline'; break
      case TextDecorationType.Overline: return 'overline'; break
      case TextDecorationType.LineThrough: return 'line-through'; break
      case TextDecorationType.None: return 'none'; break
      default: return ''
    }
  }

  set textDecoration (value: string) {
    if (typeof value === 'string') {
      switch (value) {
        case 'underline': this.hmStyle.decoration = TextDecorationType.Underline; break
        case 'overline': this.hmStyle.decoration = TextDecorationType.Overline; break
        case 'line-through': this.hmStyle.decoration = TextDecorationType.LineThrough; break
        default: this.hmStyle.decoration = TextDecorationType.None; break
      }
    }
  }

  set _decoration (value: TextDecorationType) {
    this.hmStyle.decoration = value
  }

  get textOverflow () {
    if (this.hmStyle.textOverflow) {
      switch (this.hmStyle.textOverflow.overflow) {
        case TextOverflow.Clip: return 'clip'; break
        case TextOverflow.Ellipsis: return 'ellipsis'; break
        case TextOverflow.MARQUEE: return 'marquee'; break
        default: return 'none'
      }
    }
  }

  set textOverflow (value: string) {
    if (typeof value === 'string') {
      let overflow = TextOverflow.None
      switch (value) {
        case 'clip': overflow = TextOverflow.Clip; break
        case 'ellipsis': overflow = TextOverflow.Ellipsis; break
        case 'marquee': overflow = TextOverflow.MARQUEE; break
      }
      this.hmStyle.textOverflow = {
        overflow
      }
    }
  }

  set _textOverflow (value: TextOverflow) {
    switch (value.overflow) {
      case TextOverflow.Clip: 
      case TextOverflow.Ellipsis:
      case TextOverflow.None: this.hmStyle.maxLines = this.hmStyle.maxLines || 1; break
      default: break
    }
    this.hmStyle.textOverflow = value
  }

  get WebkitLineClamp () {
    return Number(this.hmStyle.maxLines)
  }

  set WebkitLineClamp (value: string | number) {
    this.hmStyle.maxLines = Number(value)
  }

  set _WebkitLineClamp (value: number) {
    this.hmStyle.maxLines = value
  }

  set _linearGradient (value: HarmonyType.LinearGradient[]) {
    this.hmStyle.linearGradient = value?.[0]
  }
  
  get transform () {
    return this.hmStyle.transform
  }

  set _tranform (value: HarmonyType.Transform.Transform) {
    this.hmStyle.transform = value
  }
}


class BORDERhmStyleYLE_MAP {
  static solid = BorderStyle.Solid
  static dotted = BorderStyle.Dotted
  static dashed = BorderStyle.Dashed

  static get(type: string): BorderStyle {
    switch (type) {
      case 'dotted': return BorderStyle.Dotted
      case 'dashed': return BorderStyle.Dashed
      default: return BorderStyle.Solid
    }
  }

  static reverse(type: BorderStyle): string {
    switch (type) {
      case BorderStyle.Dotted: return 'dotted'
      case BorderStyle.Dashed: return 'dashed'
      case BorderStyle.Solid: return 'solid'
      default: return ''
    }
  
  }
}