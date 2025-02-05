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
        const node = { next: tail, callback, context }
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

    // TODO: 待重构，以双节点指针的形式，改写 node 链表上的节点
    for (const event of eventList) {
      if (!event) break

      let node: any = this.callbacks[event]
      // 清空指定注册事件, 删除 node 链表的全部节点
      delete this.callbacks[event]

      if (!!node && (!!callback || !!context)) {
        const tail = node.tail
        node = node.next

        this.callbacks ||= {}
        while (node !== tail) {
          const cb = node.callback
          const ctx = node.context
          // 重新注册事件, 重新创建 node 链表的节点（剔除 callback 或 context 的同属性节点）
          if ((callback && cb !== callback) || (context && ctx !== context)) {
            this.on(event, cb, ctx)
          }
          node = node.next
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
      node = node.next
      while (node !== tail) {
        const cb = node.callback
        const ctx = node.context
        cb.apply(ctx || this, args)
        node = node.next
      }
    }
    return this
  }
}
