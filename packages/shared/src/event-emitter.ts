type EventName = string | symbol
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
    if (!callback) return this

    this.callbacks ||= {}
    const eventList: (EventName | undefined)[] = typeof eventName === 'symbol' ? [eventName] : eventName.split(Events.eventSplitter)
    for (const event of eventList) {
      if (!event) break

      // !!! tail 既做指针，也做值使用。每轮循环创建的空对象都有2个指针：tail 和 node.next
      const tail = {}
      const list = this.callbacks[event]

      // !!! 此处用于同步2个指针的指向：tail 和 node.next
      const node: any = list ? list.tail : {}
      node.callback = callback
      node.context = context
      // !!! 此处同步改动3处：改变本轮 node.next 指针的指向；覆写了 上一轮 list.tail & list.next.next 两个指针代表的对象的值
      node.next = tail

      // !!! 此处改动1处：改变本轮 tail 指针的指向，保持和本轮 node.next 指向一致
      this.callbacks[event] = { tail, next: list ? list.next : node }
    }

    return this
  }

  off (eventName?: EventName, callback?: CallbackFn, context?: any) {
    if (!this.callbacks) return this

    if (!eventName && !callback && !context) {
      delete this.callbacks
      return this
    }

    const eventList: (EventName | undefined)[] = typeof eventName === 'symbol'
      ? [eventName]
      : !!eventName
        ? eventName.split(Events.eventSplitter)
        : Object.keys(this.callbacks)

    for (const event of eventList) {
      if (!event) break

      let node: any = this.callbacks[event]
      // 清除指定注册事件, 删除 node 链表的全部节点
      delete this.callbacks[event]
      if (!node || (!callback && !context)) continue

      if (!!node && (!!callback || !!context)) {
        const tail = node.tail
        node = node.next
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
