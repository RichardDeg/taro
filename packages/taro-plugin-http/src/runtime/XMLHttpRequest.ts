import { createEvent, Events, parseUrl, TaroEvent, window } from '@tarojs/runtime'
import { isFunction, isString } from '@tarojs/shared'
import { request } from '@tarojs/taro'

// TODO: 看到这里了
// TODO: 把 taro-plugin-http 看完之后的小任务
// TODO:!!! 提升任务，手动实现一个 XMLHttpRequest 请求。此文件为标准参考答案。
// - 对标 MDN 资料，实现一模一样的 初入参 api
// - 1）ReadMe.md 文档很重要，值得参考
// - 2）Taro.request 和 wx.request 有什么不同
// - 3）Web 端中调用 Taro.request 和 小程序端调用 Taro.request 又有什么不同
// - 4）Taro.request 和 XMLHttpRequest 和 axios 又有什么不同
// - 5) 这个插件是如何被调用的，入口在哪里
// - 6）什么是运行时，什么是编译时。编译小程序和运行小程序有什么不同。为什么这个插件，通过 rollup 分别打包为编译时 dist 和运行时 dist

declare const ENABLE_COOKIE: boolean

const SUPPORT_METHOD = ['OPTIONS', 'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'TRACE', 'CONNECT']
const STATUS_TEXT_MAP = {
  100: 'Continue',
  101: 'Switching protocols',

  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',

  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',

  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Request Entity Too Large',
  414: 'Request-URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Requested Range Not Suitable',
  417: 'Expectation Failed',

  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
}

export interface XMLHttpRequestEvent extends TaroEvent {
  target: XMLHttpRequest
  currentTarget: XMLHttpRequest
  loaded: number
  total: number
}

function createXMLHttpRequestEvent (event: string, target: XMLHttpRequest, loaded: number): XMLHttpRequestEvent {
  const e = createEvent(event) as XMLHttpRequestEvent
  try {
    Object.defineProperties(e, {
      currentTarget: {
        enumerable: true,
        value: target
      },
      target: {
        enumerable: true,
        value: target
      },
      loaded: {
        enumerable: true,
        value: loaded || 0
      },
      // 读 Content-Range 字段，目前来说作用不大,先和 loaded 保持一致
      total: {
        enumerable: true,
        value: loaded || 0
      }
    })
  } catch (err) {
    // no handler
  }
  return e
}

// XMLHttpRequest 参考资料：https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest
export class XMLHttpRequest extends Events {
  // readyState 参考资料：https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/readyState
  static readonly UNSENT = 0
  static readonly OPENED = 1
  static readonly HEADERS_RECEIVED = 2
  static readonly LOADING = 3
  static readonly DONE = 4

  // 欺骗一些库让其认为是原生的xhr
  static toString () {
    return 'function XMLHttpRequest() { [native code] }'
  }

  toString () {
    return '[object XMLHttpRequest]'
  }

  #method: string
  #url: string
  #data: null
  #status: number
  #statusText: string
  #readyState: number
  #header: Record<string, any>
  #responseType: string
  #resHeader: null | Record<string, any>
  #response: null
  #timeout: number
  #withCredentials: boolean
  #requestTask: null | Taro.RequestTask<any>

  // 事件正常流转：loadstart => progress（可能多次） => load => loadend
  // error 流转： loadstart => error => loadend
  // abort 流转： loadstart => abort => loadend
  // web 在线测试：https://developer.mozilla.org/zh-CN/play

  /** 当 request 被停止时触发，例如当程序调用 XMLHttpRequest.abort() 时 */
  onabort: ((e: XMLHttpRequestEvent) => void) | null = null

  /** 当 request 遭遇错误时触发 */
  onerror: ((e: XMLHttpRequestEvent) => void) | null = null

  /** 接收到响应数据时触发 */
  onloadstart: ((e: XMLHttpRequestEvent) => void) | null = null

  /** 请求成功完成时触发 */
  onload: ((e: XMLHttpRequestEvent) => void) | null = null

  /** 当请求结束时触发，无论请求成功 (load) 还是失败 (abort 或 error)。 */
  onloadend: ((e: XMLHttpRequestEvent) => void) | null = null

  /** 在预设时间内没有接收到响应时触发 */
  ontimeout: ((e: XMLHttpRequestEvent) => void) | null = null

  /** 当 readyState 属性发生变化时，调用的事件处理器 */
  onreadystatechange: ((e: XMLHttpRequestEvent) => void) | null = null

  constructor () {
    super()

    this.#method = ''
    this.#url = ''
    this.#data = null
    this.#status = 0
    this.#statusText = ''
    this.#readyState = XMLHttpRequest.UNSENT
    this.#header = {
      Accept: '*/*',
    }
    this.#responseType = ''
    this.#resHeader = null
    this.#response = null
    this.#timeout = 0
    /** 向前兼容，默认为 true */
    this.#withCredentials = true

    this.#requestTask = null
  }

  addEventListener (event: string, callback: (arg: any) => void) {
    if (!isString(event)) return
    this.on(event, callback, null)
  }

  removeEventListener (event: string, callback: (arg: any) => void) {
    if (!isString(event)) return
    this.off(event, callback, null)
  }

  /**
   * readyState 变化
   */
  #callReadyStateChange (readyState) {
    const isDiff = readyState !== this.#readyState
    this.#readyState = readyState

    if (isDiff) {
      const readystatechangeEvent = createXMLHttpRequestEvent('readystatechange', this, 0)
      this.trigger('readystatechange', readystatechangeEvent)
      isFunction(this.onreadystatechange) && this.onreadystatechange(readystatechangeEvent)
    }
  }

  /**
   * 执行请求
   */
  #callRequest () {
    if (!window?.document) {
      console.warn('this page has been unloaded, so this request will be canceled.')
      return
    }

    if (this.#timeout) {
      setTimeout(() => {
        if (!this.#status && this.#readyState !== XMLHttpRequest.DONE) {
          // 超时
          if (this.#requestTask) this.#requestTask.abort()
          this.#callReadyStateChange(XMLHttpRequest.DONE)
          const timeoutEvent = createXMLHttpRequestEvent('timeout', this, 0)
          this.trigger('timeout', timeoutEvent)
          isFunction(this.ontimeout) && this.ontimeout(timeoutEvent)
        }
      }, this.#timeout)
    }

    // 重置各种状态
    this.#status = 0
    this.#statusText = ''
    this.#readyState = XMLHttpRequest.OPENED
    this.#resHeader = null
    this.#response = null

    // 补完 url
    let url = this.#url
    url = url.indexOf('//') === -1 ? window.location.origin + url : url

    // 头信息
    const header = Object.assign({}, this.#header)
    // https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Cookies
    // @ts-ignore
    header.cookie = window.document.$$cookie
    if (!this.withCredentials) {
      // 不同源，要求 withCredentials 为 true 才携带 cookie
      const { origin } = parseUrl(url)
      if (origin !== window.location.origin) delete header.cookie
    }
    this.#requestTask = request({
      url,
      data: this.#data || {},
      header,
      // @ts-ignore
      method: this.#method,
      dataType: this.#responseType === 'json' ? 'json' : 'text',
      responseType: this.#responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
      success: this.#requestSuccess.bind(this),
      fail: this.#requestFail.bind(this),
      complete: this.#requestComplete.bind(this),
    })
  }

  /**
   * 请求成功
   */
  #requestSuccess ({ data, statusCode, header }) {
    if (!window?.document) {
      console.warn('this page has been unloaded, so this request will be canceled.')
      return
    }

    this.#status = statusCode
    this.#resHeader = header

    this.#callReadyStateChange(XMLHttpRequest.HEADERS_RECEIVED)

    /**
     * FIXME: BUG !!! 存疑!!! 如果 setCookieStr 是以分号分割的，该代码写入 window.document.cookie 会丢失部分键值对
     * - eg.1:
     *   - setCookieStr = 'kkk, f=12121,456, aaaa=7878; fff=io, ffffff=hghghghg';
     *   - setCookieArr = ['kkk', ' f=12121,456', ' aaaa=7878; fff=io', ' ffffff=hghghghg'];
     *   - 部分写入失败：fff=io
     * - eg.2:
     *   - setCookieStr = 'aaa=bbb; domain=taro.com';
     *   - 全部写入失败
     * - eg.3:
     *   - setCookieStr = 'aaa=ccc; domain2222=taro.com';
     *   - 部分写入失败： domain2222=taro.com
     */
    // 读取 set-cookie 的值，并写入 window.document.cookie
    if (ENABLE_COOKIE) {
      const setCookieStr = this.getResponseHeader('set-cookie')
      if (!!setCookieStr) {
        const setCookieArr: string[] = []

        let start = 0
        let startSplit = 0
        let nextSplit = setCookieStr.indexOf(',')

        while (nextSplit !== -1) {
          const lastSplitStr = setCookieStr.substring(start, nextSplit)
          const splitStr = setCookieStr.substring(nextSplit)

          // eslint-disable-next-line no-control-regex
          if (/^,\s*([^,=;\x00-\x1F]+)=([^;\n\r\0\x00-\x1F]*).*/.test(splitStr)) {
            // 分割成功，则上一片是完整 cookie
            setCookieArr.push(lastSplitStr)
            start = nextSplit + 1
          }

          startSplit = nextSplit + 1
          nextSplit = setCookieStr.indexOf(',', startSplit)
        }
        // 塞入最后一片 cookie
        const lastSplitStr = setCookieStr.substring(start)
        setCookieArr.push(lastSplitStr)

        setCookieArr.forEach(cookie => {
          window.document.cookie = cookie
        })
      }
    }

    // 处理返回数据
    if (data) {
      this.#callReadyStateChange(XMLHttpRequest.LOADING)
      const contentLength = Number(this.getResponseHeader('content-length') || 0)
      const loadstartEvent = createXMLHttpRequestEvent('loadstart', this, contentLength)
      this.trigger('loadstart', loadstartEvent)
      isFunction(this.onloadstart) && this.onloadstart(loadstartEvent)
      this.#response = data

      const loadEvent = createXMLHttpRequestEvent('load', this, contentLength)
      this.trigger('load', loadEvent)
      isFunction(this.onload) && this.onload(loadEvent)
    }
  }

  /**
   * 请求失败
   */
  #requestFail (err) {
    // 微信小程序，无论接口返回200还是其他，响应无论是否有错误，都会进入 success 回调；只有类似超时这种请求错误才会进入 fail 回调
    //
    /**
     * 阿里系小程序，接口返回非200状态码，会进入 fail 回调, 此时 err 对象结构如下（当错误码为 14 或 19 时，会多返回 status、data、headers。可通过这些字段获取服务端相关错误信息）：
     {
       data: "{\"code\": 401,\"msg\":\"登录过期，请重新登录\"}"
       error: 19
       errorMessage: "http status error"
       headers: {date: 'Mon, 14 Aug 2023 08:54:58 GMT', content-type: 'application/json;charset=UTF-8', content-length: '52', connection: 'close', access-control-allow-credentials: 'true', …}
       originalData: "{\"code\": 401,\"msg\":\"登录过期，请重新登录\"}"
       status: 401
     }
     */
    // 统一行为，能正常响应的，都算 success.
    if (err.status) {
      this.#requestSuccess({
        data: err,
        statusCode: err.status,
        header: err.headers
      })
      return
    }
    this.#status = 0
    this.#statusText = err.errMsg || err.errorMessage
    const errorEvent = createXMLHttpRequestEvent('error', this, 0)
    this.trigger('error', errorEvent)
    isFunction(this.onerror) && this.onerror(errorEvent)
  }

  /**
   * 请求完成
   */
  #requestComplete () {
    this.#requestTask = null
    this.#callReadyStateChange(XMLHttpRequest.DONE)

    if (this.#status) {
      const contentLength = Number(this.getResponseHeader('content-length') || 0)
      const loadendEvent = createXMLHttpRequestEvent('loadend', this, contentLength)
      this.trigger('loadend', loadendEvent)
      isFunction(this.onloadend) && this.onloadend(loadendEvent)
    }
  }

  /**
   * 对外属性和方法
   */
  get timeout () {
    return this.#timeout
  }

  set timeout (timeout) {
    if (typeof timeout !== 'number' || !isFinite(timeout) || timeout <= 0) return

    this.#timeout = timeout
  }

  get status () {
    return this.#status
  }

  get statusText () {
    if ([XMLHttpRequest.UNSENT, XMLHttpRequest.OPENED].includes(this.#readyState)) return ''

    return STATUS_TEXT_MAP[this.#status + ''] || this.#statusText || ''
  }

  get readyState () {
    return this.#readyState
  }

  // 参考 responseType：https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/responseType
  get responseType () {
    return this.#responseType
  }

  set responseType (value) {
    if (typeof value !== 'string') return

    this.#responseType = value
  }

  get responseText () {
    if (!this.#responseType || this.#responseType === 'text') {
      return this.#response
    }

    return null
  }

  get response () {
    return this.#response
  }

  get withCredentials () {
    return this.#withCredentials
  }

  set withCredentials (value) {
    this.#withCredentials = !!value
  }

  abort () {
    if (this.#requestTask) {
      this.#requestTask.abort()
      const abortEvent = createXMLHttpRequestEvent('abort', this, 0)
      this.trigger('abort', abortEvent)
      isFunction(this.onabort) && this.onabort(abortEvent)
    }
  }

  getAllResponseHeaders () {
    if (!this.#resHeader || [XMLHttpRequest.UNSENT, XMLHttpRequest.OPENED].includes(this.#readyState)) return ''

    return Object.keys(this.#resHeader)
      .map((key) => `${key}: ${this.#resHeader![key]}`)
      .join('\r\n')
  }

  getResponseHeader (name: string) {
    if (!this.#resHeader || [XMLHttpRequest.UNSENT, XMLHttpRequest.OPENED].includes(this.#readyState)) return ''

    const key = Object.keys(this.#resHeader).find((item) => item.toLowerCase() === name.toLowerCase())
    const value = key ? this.#resHeader[key] : null

    return typeof value === 'string' ? value : null
  }

  open (method, url) {
    if (!url || typeof url !== 'string') return
    if (!method || typeof method !== 'string') return

    method = method.toUpperCase()
    if (SUPPORT_METHOD.indexOf(method) === -1) return

    this.#method = method
    this.#url = url
    this.#callReadyStateChange(XMLHttpRequest.OPENED)
  }

  setRequestHeader (header, value) {
    if (typeof header === 'string' && typeof value === 'string') {
      this.#header[header] = value
    }
  }

  send (data) {
    if (this.#readyState !== XMLHttpRequest.OPENED) return

    this.#data = data
    this.#callRequest()
  }
}
