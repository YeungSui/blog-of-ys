const queue = []
let waiting = false

function proxy(obj) {
    const keys = Object.keys(obj)
    keys.forEach(k => {
        Object.defineProperty(obj, '_' + k, { value: obj[k] })
        Object.defineProperty(obj, k, {
            get() {
                console.log('get ' + k)
                return obj['_' + k]
            },
            set(val) {
                console.log('set ' + k)
                obj['_' + k] = val
                queueUpdate(k ,val)
            }
        })
    })
}

function queueUpdate(key, value) {
    queue.push([key, value])

    // the key: only one promise at a time
    // the first one will create a promise
    // the following will be pushed to the queue only
    // after the macro task, like for-loop at the end, finished,
    // micro tasks, like the promise created here, will be executed
    if (!waiting) {
        waiting = true
        Promise.resolve().then(render)
    }
}

function render() {
    waiting = false
    const bak = queue.slice(0)
    queue.length = 0
    console.log('render: %s', bak.map(([k, v]) => `${k}=${v}`).join(' -> '))
}

const obj = {a: -1}
proxy(obj)
for (let i = 0; i < 3; ++i) {
    obj.a = i
}

// expected output
// set a
// set a
// set a
// render: a=0 -> a=1 -> a=2

// without promise, every time 'obj.a' is set, there will be a 'set a\nrender: a=?' output