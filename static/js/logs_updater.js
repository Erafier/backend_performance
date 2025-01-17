const PerformanceLogsApp = {
    delimiters: ['[[', ']]'],
    props: ['project_id', 'report_id'],
    data() {
        return {
            websocket_api_url: '',
            state: 'unknown',
            websocket: undefined,
            connection_retries: 5,
            connection_retry_timeout: 2000,
            logs: [],
            tags_mapper: [],
            isShowLastLogs: true,
        }

    },
    mounted() {
      console.log("Logs: mounted()")
      this.websocket_api_url = `/api/v1/backend_performance/loki_url/${this.project_id}/?report_id=${this.report_id}`
      this.init_websocket()
    },
    computed: {
        reversedLogs: function () {
            return this.logs.reverse()
        },
    },
    template: `
        <div class="card card-12 pb-4 card-table">
            <div class="card-header">
                <div class="d-flex justify-content-between">
                    <p class="font-h3 font-bold">Logs</p>
                    <label class="custom-checkbox d-flex align-items-center">
                        <input type="checkbox" 
                            :checked="isShowLastLogs"
                            @click="setShowLastLogs">
                            <span class="ml-2">Show last logs</span>
                    </label>
                </div>
            </div>
            <div class="card-body card-table">
              <div class="container-logs">
                    <table id="tableLogs" class="table-logs">
                    </table>
                </div>
            </div>
        </div>
    `,
    methods: {
        setShowLastLogs() {
            this.isShowLastLogs = !this.isShowLastLogs;
            if (this.isShowLastLogs) {
                const elem = document.querySelector('.container-logs');
                elem.scrollTop = elem.scrollHeight;
            }
        },
        scrollLogsToEnd() {
            const elem = document.querySelector('.container-logs');
            elem.scrollTop = elem.scrollHeight;
        },
        init_websocket() {
            console.log("Logs: init_websocket()")
            fetch(this.websocket_api_url, {
                method: 'GET'
            }).then(response => {
                if (response.ok) {
                    response.json().then(data => {
                      this.websocket = new WebSocket(data.websocket_url)
                      this.websocket.onmessage = this.on_websocket_message
                      this.websocket.onopen = this.on_websocket_open
                      this.websocket.onclose = this.on_websocket_close
                      this.websocket.onerror = this.on_websocket_error
                    })
                } else {
                    console.warn('Websocket failed to initialize', response)
                }
            })
        },
        on_websocket_open(message) {
            this.state = 'connected'
        },
        on_websocket_message(message) {
            if (message.type !== 'message') {
                console.log('Unknown message', message)
                return
            }

            const data = JSON.parse(message.data)
            const logsTag = data.streams.map(logTag => {
                return logTag.stream.hostname;
            })

            const uniqTags = [...new Set(logsTag)].filter(tag => !!(tag))
            uniqTags.forEach(tag => {
                if(!this.tags_mapper.includes(tag)) {
                    this.tags_mapper.push(tag)
                }
            })
            const tagColors = [
                '#f89033',
                '#e127ff',
                '#2BD48D',
                '#2196C9',
                '#6eaecb',
                '#385eb0',
                '#7345fc',
                '#94E5B0',
            ]

            data.streams.forEach((stream_item, streamIndex) => {
                stream_item.values.forEach((message_item, messageIndex) => {
                    const d = new Date(Number(message_item[0])/1000000)
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const timestamp = d.toLocaleString("en-GB", {timeZone: tz})
                    const indexColor = this.tags_mapper.indexOf(stream_item.stream.hostname);
                    const coloredTag = `<td><span style="color: ${tagColors[indexColor]}" class="ml-4">[${stream_item.stream.hostname}]</span></td>`

                    if (stream_item.stream.filename == "/tmp/jmeter_logs.log") {
                        const messages = message_item[1].split(" ")
                        const coloredText = `${coloredTag}<td><span class="colored-log colored-log__${messages[2]}">${messages[2]}</span></td>`
                        const message = message_item[1].split(" ").slice(3)
                        const row = `<tr><td>${timestamp}</td>${coloredText}<td>${message}</td><br>`
                        $('#tableLogs').append(row)
                    } else if (stream_item.stream.filename == null) {
                        const message = message_item[1]
                        const log_level = stream_item.stream.level
                        const coloredText = `${coloredTag}<td><span class="colored-log colored-log__${log_level}">${log_level}</span></td>`
                        const row = `<tr><td>${timestamp}</td>${coloredText}<td class="log-message__${streamIndex}-${messageIndex}"></td></tr>`
                        $('#tableLogs').append(row)
                        $(`.log-message__${streamIndex}-${messageIndex}`).append(`<plaintext>${message}`)
                    }
                    if (this.isShowLastLogs) this.scrollLogsToEnd()
                })
            })
        },
        on_websocket_close(message) {
            this.state = 'disconnected'
            let attempt = 1;
            const intrvl = setInterval(() => {
                this.init_websocket()
                if (this.state === 'connected' || attempt > this.connection_retries) clearInterval(intrvl)
                attempt ++
            }, this.connection_retry_timeout)
        },
        on_websocket_error(message) {
            this.state = 'error'
            this.websocket.close()
        }

    }
}

register_component('performancelogsapp', PerformanceLogsApp)
