import { document, window } from '@tarojs/runtime'

import { Cookie, createCookieInstance } from './Cookie'
import { XMLHttpRequest } from './XMLHttpRequest'

import type { XMLHttpRequestEvent } from './XMLHttpRequest'

declare const ENABLE_COOKIE: boolean

if (process.env.TARO_PLATFORM !== 'web') {
  if (ENABLE_COOKIE) {
    const _cookie = createCookieInstance()

    Object.defineProperties(document, {
      URL: {
        get () {
          if (this.defaultView) return this.defaultView.location.href
          return ''
        },
      },
      cookie: {
        get () {
          return _cookie.getCookie(this.URL)
        },
        set (value: string) {
          if (!value || typeof value !== 'string') return
          _cookie.setCookie(value, this.URL)
        },
      },
      /** 获取完整的 cookie，包括 httpOnly 也能获取到 */
      $$cookie: {
        get () {
          return _cookie.getCookie(this.URL, true)
        },
      }
    })
  }
  // TODO: 看到这里了, 为什么要自己实现一个 XMLHttpRequest 类，window 原生有，差异化/定制化的内容是什么
  window.XMLHttpRequest = XMLHttpRequest
}

export { Cookie, document, XMLHttpRequest, XMLHttpRequestEvent }
