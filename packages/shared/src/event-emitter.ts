type EventName = string | symbol
// TODO: 待移除 any 类型，确定 EventCallbacks 与 node 的 ts 类型，还有可选参数问题
// // TODO: 待确定，这样定义 ts 类型是否会引起循环引用问题
// type EventNode = {
//   next: EventNode | TailNode
//   tail: TailNode
//   callback: CallbackFn
//   context?: any
// }
// type HeaderNode = {
//   next: EventNode | TailNode
//   tail: TailNode
// }
// type TailNode = {}
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

      const tailNode = {}
      if (this.callbacks[event]) {
        // TODO: 这个 if 分支功能待确定 ???
        this.callbacks[event].tail = tailNode
      } else {
        const eventNode = { next: tailNode, callback, context }
        const headerNode = { tail: tailNode, next: eventNode }
        this.callbacks[event] = headerNode
      }
    }
    return this
  }

  /**
   * 参考所有使用案例
   * 1. off()                               - 清除所有事件
   * 2. off(eventName, callback)            - 清除 eventName 的 callback 单个事件
   * 3. off(eventName, undefined, context)  - 清除 eventName 的 context 上的所有事件
   */
  // TODO: 看到这里了
  off (eventName?: EventName, callback?: CallbackFn, context?: any) {
    // 无注册事件，直接返回
    if (!this.callbacks) return this

    // 清除所有注册事件
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

      const headerNode: any = this.callbacks[event]
      // 清除指定注册事件, 删除 node 链表的全部节点
      delete this.callbacks[event]

      if (!!headerNode && (!!callback || !!context)) {
        const tailNode = headerNode.tail
        let eventNode = headerNode.next
        while (eventNode !== tailNode) {
          const cb = eventNode.callback
          const ctx = eventNode.context
          // 重新注册事件, 重新创建 node 链表的节点（剔除 callback 或 context 的同属性节点）
          if ((callback && cb !== callback) || (context && ctx !== context)) {
            this.on(event, cb, ctx)
          }
          eventNode = eventNode.next
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

      const headerNode: any = this.callbacks[event]
      if (!headerNode) continue

      const tailNode = headerNode.tail
      let eventNode = headerNode.next
      while (eventNode !== tailNode) {
        const cb = eventNode.callback
        const ctx = eventNode.context
        cb.apply(ctx || this, args)
        eventNode = eventNode.next
      }
    }
    return this
  }
}
