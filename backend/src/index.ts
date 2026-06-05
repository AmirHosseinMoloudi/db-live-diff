import { Hono } from 'hono'
import { createBunWebSocket } from 'hono/bun'
import { getDiff } from './diffEngine'
import * as path from 'path'

const app = new Hono()
const { upgradeWebSocket, websocket } = createBunWebSocket()

const tempDir = path.join(process.cwd(), '.temp_diff')
let lastSchema: string | null = null
let activeInterval: Timer | null = null

app.get('/ws', upgradeWebSocket((c) => {
  return {
    onMessage(event, ws) {
      try {
        const data = JSON.parse(event.data.toString())
        if (data.type === 'START_WATCH') {
          const { dbUrl, intervalMs } = data
          console.log(`Watching database: ${dbUrl}`);
          
          if (activeInterval) clearInterval(activeInterval);
          lastSchema = null;

          // Perform initial check
          getDiff(dbUrl, lastSchema, tempDir).then((res) => {
            if (res.error) {
              ws.send(JSON.stringify({ type: 'ERROR', error: res.error, details: res.details }))
            } else {
              lastSchema = res.newSchema
              ws.send(JSON.stringify({ type: 'INITIAL', schema: res.newSchema }))
            }
          })

          // Setup watcher execution loop
          activeInterval = setInterval(async () => {
            const res = await getDiff(dbUrl, lastSchema, tempDir)
            if (res.error) {
              ws.send(JSON.stringify({ type: 'ERROR', error: res.error, details: res.details }))
            } else if (res.diff) {
              lastSchema = res.newSchema
              ws.send(JSON.stringify({ 
                type: 'DIFF', 
                diff: res.diff, 
                schema: res.newSchema, 
                timestamp: new Date().toLocaleTimeString() 
              }))
            }
          }, intervalMs || 3000)
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'ERROR', error: 'Parsing Error', details: err.message }))
      }
    },
    onClose() {
      console.log('Client connection closed. Resetting loop watcher.');
      if (activeInterval) {
        clearInterval(activeInterval)
        activeInterval = null
      }
    }
  }
}))

export default {
  port: 3001,
  fetch: app.fetch,
  websocket
}