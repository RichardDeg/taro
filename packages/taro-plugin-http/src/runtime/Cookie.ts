/******************************************************************************
Copyright (c) 2019 wechat-miniprogram.
Reference and modify code by miniprogram-render/src/bom/cookie.js.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
import { parseUrl } from '@tarojs/runtime'
import { getStorageSync, setStorage } from '@tarojs/taro'

// FIXME: 猜测: 部分函数的入参类型不标明，即表示对第三方传入的入参类型持不信任态度，所以要用 js 逻辑兜底类型校验

const STORAGE_KEY = 'PAGE_COOKIE'
export class Cookie {
  #map: any
  constructor () {
    /** { domain: { path: { key: 类 window.location 对象 } } } */
    this.#map = {}
  }

  static parse (cookieStr: string) {
    if (!cookieStr || typeof cookieStr !== 'string') return null

    const cookieStrArr = cookieStr.trim().split(';')

    /************** 解析 cookie 字段: name、value *************************************************/
    // eslint-disable-next-line no-control-regex
    const parseNameAndValueResult = /^([^=;\x00-\x1F]+)=([^;\n\r\0\x00-\x1F]*).*/.exec(cookieStrArr.shift()!)
    if (!parseNameAndValueResult) return null
    const cookieName = (parseNameAndValueResult[1] || '').trim()
    const cookieValue = (parseNameAndValueResult[2] || '').trim()

    /************** 解析 cookie 字段: path、domain、expires、maxAge、secure、httpOnly **************/
    let path: string | null = null
    let domain: string | null = null
    let expires: number | null = null
    let maxAge: number | null = null
    let secure = false
    let httpOnly = false

    for (let item of cookieStrArr) {
      item = item.trim()
      if (!item) continue

      let [key, value] = item.split('=')
      key = (key || '').trim().toLowerCase()
      value = (value || '').trim()

      if (!key) continue

      switch (key) {
        case 'path':
          if (value.startsWith('/')) path = value
          break
        case 'domain':
          value = value.replace(/^\./, '').toLowerCase()
          if (value) domain = value
          break
        case 'expires':
          if (value) {
            const timeStamp = Date.parse(value)
            if (timeStamp) expires = timeStamp
          }
          break
        case 'max-age':
          if (/^-?[0-9]+$/.test(value)) maxAge = +value * 1000
          break
        case 'secure':
          secure = true
          break
        case 'httponly':
          httpOnly = true
          break
      }
    }

    return {
      key: cookieName,
      value: cookieValue,
      path,
      domain,
      expires,
      maxAge,
      secure,
      httpOnly,
    }
  }

  /**
   * 判断 domain
   */
  $_checkDomain (host, cookieDomain) {
    if (host === cookieDomain) return true
    return host.endsWith(`.${cookieDomain}`)
  }

  /**
   * 判断 path
   */
  $_checkPath (path, cookiePath) {
    return path.startsWith(cookiePath)
  }

  /**
   * 判断过期
   */
  $_checkExpires (cookie) {
    const now = Date.now()

    // maxAge 优先
    if (cookie.maxAge !== null) return cookie.createTime + cookie.maxAge > now

    // 判断 expires
    if (cookie.expires !== null) return cookie.expires > now

    return true
  }

  /**
   * 设置 cookie
   */
  setCookie (cookie, url) {
    const cookieObj = Cookie.parse(cookie)
    const { host, pathname } = parseUrl(url)

    if (!cookieObj) return
    if (!this.$_checkDomain(host, cookieObj.domain)) return

    let mergedCookiePath = cookieObj.path || ''
    if (!mergedCookiePath.startsWith('/')) {
      const path = pathname.startsWith('/') ? pathname : '/'
      const lastSlashIndex = path.lastIndexOf('/')
      mergedCookiePath = lastSlashIndex === 0 ? path : path.substr(0, lastSlashIndex)
    }

    const cookieKey = cookieObj.key
    const mergedCookieDomain = cookieObj.domain || host

    this.#map[mergedCookieDomain] ||= {}
    this.#map[mergedCookieDomain][mergedCookiePath] ||= {}

    if (!this.$_checkExpires(cookieObj)) {
      delete this.#map[mergedCookieDomain][mergedCookiePath][cookieKey]
    } else {
      const oldCookie = this.#map[mergedCookieDomain][mergedCookiePath][cookieKey]
      const mergedCookieCreateTime = oldCookie?.createTime || Date.now()
      const mergedCookie = { ...cookieObj, createTime: mergedCookieCreateTime, domain: mergedCookieDomain, path: mergedCookiePath }
      this.#map[mergedCookieDomain][mergedCookiePath][cookieKey] = mergedCookie
    }

    setStorage?.({ key: STORAGE_KEY, data: this.serialize() })
  }

  // TODO: 看到这里了
  /**
   * 拉取 cookie
   */
  getCookie (url: string, includeHttpOnly = false) {
    const { protocol, host, pathname } = parseUrl(url)
    const path = pathname.startsWith('/') ? pathname : '/'

    const mergedCookieList: any[] = []
    const domainList = Object.keys(this.#map)
    for (const domainItem of domainList) {
      if (!this.$_checkDomain(host, domainItem)) continue

      const domainMap = this.#map[domainItem] || {}
      const pathList = Object.keys(domainMap)

      for (const pathItem of pathList) {
        if (!this.$_checkPath(path, pathItem)) continue

        const pathMap = domainMap[pathItem] || {}
        const keyList = Object.keys(pathMap)

        for (const keyItem of keyList) {
          const cookie = pathMap[keyItem]

          if (!cookie) continue
          // TODO: 待确定 wss 与 cookie.secure 的关系
          if (cookie.secure && !['https:', 'wss:'].includes(protocol)) continue
          if (!includeHttpOnly && cookie.httpOnly && !['https:', 'http:'].includes(protocol)) continue

          if (this.$_checkExpires(cookie)) {
            mergedCookieList.push(cookie)
          } else {
            // TODO: 参考下 js-cookie ,在读取 cookie 时 会删除过期键值么。是否这行代码可删除
            delete this.#map[domainItem][pathItem][keyItem]
          }
        }
      }
    }

    const cookieStr = mergedCookieList
    .sort((a, b) => {
      const gap = a.createTime - b.createTime

      if (!gap) {
        return a.key < b.key ? -1 : 1
      } else {
        return gap
      }
    })
    .map((cookie) => `${cookie.key}=${cookie.value}`)
    .join('; ')

    return cookieStr
  }

  /**
   * 序列化
   */
  serialize () {
    try {
      return JSON.stringify(this.#map)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('cannot serialize the cookie')
      return ''
    }
  }

  /**
   * 反序列化
   */
  deserialize (str) {
    let map = {}
    try {
      map = JSON.parse(str)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('cannot deserialize the cookie')
      map = {}
    }

    // 合并 cookie
    const domainList = Object.keys(map)

    for (const domainItem of domainList) {
      const domainMap = map[domainItem] || {}
      const pathList = Object.keys(domainMap)

      for (const pathItem of pathList) {
        const pathMap = map[domainItem][pathItem] || {}

        Object.keys(pathMap).forEach((key) => {
          const cookie = pathMap[key]

          if (!cookie) return

          // 已存在则不覆盖
          if (!this.#map[domainItem]) this.#map[domainItem] = {}
          if (!this.#map[domainItem][pathItem]) this.#map[domainItem][pathItem] = {}
          if (!this.#map[domainItem][pathItem][key]) this.#map[domainItem][pathItem][key] = cookie
        })
      }
    }
  }
}

/**
 * 创建 cookie 实例并反序列化
 * @returns
 */
export function createCookieInstance () {
  const cookieInstance = new Cookie()
  try {
    const cookie = getStorageSync(STORAGE_KEY)
    if (cookie) cookieInstance.deserialize(cookie)
  } catch (err) {
    // ignore
  }
  return cookieInstance
}
