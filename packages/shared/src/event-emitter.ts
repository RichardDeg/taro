type EventName = string | symbol
// TODO: 待移除 any 类型，确定 EventCallbacks 与 node 的 ts 类型，还有可选参数问题
// // TODO: 待确定，这样定义 ts 类型是否会引起循环引用问题
// type EventCallbackNode = {
//   next: EventCallbackNode
//   tail?: EventCallbackNode
//   callback?: CallbackFn
//   context?: any
// }
type EventCallbacks = Record<EventName, Record<'next' | 'tail', Object>>
type CallbackFn = (...args: any[]) => void

export class Events {
  protected callbacks?: EventCallbacks
  // Note: Harmony ACE API 8 开发板不支持使用正则 split 字符串 /\s+/
  static eventSplitter = ','

  constructor (opts?) {
    this.callbacks = opts?.callbacks ?? {}
  }

  on (eventName: EventName, callback: CallbackFn, context?: any) {
    this.callbacks ||= {}
    const eventList: (EventName | undefined)[] = typeof eventName === 'symbol' ? [eventName] : eventName.split(Events.eventSplitter)
    for (const event of eventList) {
      if (!event) break

      const tail = {}
      if (this.callbacks[event]) {
        this.callbacks[event].tail = tail
      } else {
        const node = { next: tail, context, callback }
        this.callbacks[event] = { tail, next: node }
      }
    }
    return this
  }

  // TODO: 看到这里了
  off (eventName?: EventName, callback?: CallbackFn, context?: any) {
    // 无注册事件，直接返回
    if (!this.callbacks) return this

    // 清空所有注册事件
    if (!eventName && !callback && !context) {
      delete this.callbacks
      return this
    }

    const eventList: (EventName | undefined)[] = typeof eventName === 'symbol'
      ? [eventName]
      : !!eventName
        ? eventName.split(Events.eventSplitter)
        : Object.keys(this.callbacks)

    // TODO: 看到这里了
    for (const event of eventList) {
      if (!event) break

      let node: any = this.callbacks[event]
      delete this.callbacks[event]
      if (!node || (!callback && !context)) continue

      const tail = node.tail
      while ((node = node.next) !== tail) {
        const cb = node.callback
        const ctx = node.context
        if ((callback && cb !== callback) || (context && ctx !== context)) {
          this.on(event, cb, ctx)
        }
      }
    }
    return this
  }

  once (eventName: EventName, callback: CallbackFn, context?: any) {
    const wrapper = (...wrapperArgs: any[]) => {
      callback.apply(this, wrapperArgs)
      this.off(eventName, wrapper, context)
    }

    this.on(eventName, wrapper, context)

    return this
  }

  trigger (eventName: EventName, ...args: any[]) {
    if (!this.callbacks) return this

    const eventList: (EventName | undefined)[] = typeof eventName === 'symbol' ? [eventName] : eventName.split(Events.eventSplitter)
    for (const event of eventList) {
      if (!event) break

      let node: any = this.callbacks[event]
      if (!node) continue

      const tail = node.tail
      while ((node = node.next) !== tail) {
        node.callback.apply(node.context || this, args)
      }
    }
    return this
  }
}
