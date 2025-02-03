type EventName = string | symbol
type EventCallbacks = Record<EventName, Record<'next' | 'tail', Object>>

export class Events {
  protected callbacks?: EventCallbacks
  // Note: Harmony ACE API 8 开发板不支持使用正则 split 字符串 /\s+/
  static eventSplitter = ','

  constructor (opts?) {
    this.callbacks = opts?.callbacks ?? {}
  }

  on (eventName: EventName, callback?: (...args: any[]) => void, context?: any): this {
    if (!callback) return this

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
  once (events: EventName, callback: (...r: any[]) => void, context?: any): this {
    const wrapper = (...args: any[]) => {
      callback.apply(this, args)
      this.off(events, wrapper, context)
    }

    this.on(events, wrapper, context)

    return this
  }

  off (events?: EventName, callback?: (...args: any[]) => void, context?: any) {
    let event: EventName | undefined, calls: EventCallbacks | undefined, _events: EventName[]
    if (!(calls = this.callbacks)) {
      return this
    }
    if (!(events || callback || context)) {
      delete this.callbacks
      return this
    }
    if (typeof events === 'symbol') {
      _events = [events]
    } else {
      _events = events ? events.split(Events.eventSplitter) : Object.keys(calls)
    }
    while ((event = _events.shift())) {
      let node: any = calls[event]
      delete calls[event]
      if (!node || !(callback || context)) {
        continue
      }
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

  trigger (events: EventName, ...args: any[]) {
    let event: EventName | undefined, node, calls: EventCallbacks | undefined, _events: EventName[]
    if (!(calls = this.callbacks)) {
      return this
    }
    if (typeof events === 'symbol') {
      _events = [events]
    } else {
      _events = events.split(Events.eventSplitter)
    }
    while ((event = _events.shift())) {
      if ((node = calls[event])) {
        const tail = node.tail
        while ((node = node.next) !== tail) {
          node.callback.apply(node.context || this, args)
        }
      }
    }
    return this
  }
}
