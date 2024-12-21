import * as path from 'node:path'

import type { IPluginContext } from '@tarojs/service'

export default (ctx: IPluginContext) => {
  ctx.registerCommand({
    name: 'config',
    fn ({ _, options }) {
      const { fs, getUserHomeDir, TARO_CONFIG_FOLDER, TARO_BASE_CONFIG } = ctx.helper
      const homedir = getUserHomeDir()
      if (!homedir) return console.log('找不到用户根目录')

      const [, cmd, key, value] = _
      const configPath = path.join(homedir, `${TARO_CONFIG_FOLDER}/${TARO_BASE_CONFIG}`)

      switch (cmd) {
        case 'get': {
          if (!key) return console.log('Usage: taro config get <key>')
          const config = readConfigContentJson(fs, configPath)
          if (config) console.log(`key: ${key}, value: ${config[key]}`)
          break
        }
        case 'set': {
          if (!key || !value) return console.log('Usage: taro config set <key> <value>')
          const config = readConfigContentJson(fs, configPath) || {}
          if (!config) fs.ensureFileSync(configPath)
          fs.writeJSONSync(configPath, {
            ...config,
            [key]: value
          })
          console.log(`set key: ${key}, value: ${value}`)
          break
        }
        case 'delete': {
          if (!key) return console.log('Usage: taro config delete <key>')
          const config = readConfigContentJson(fs, configPath)
          if (config) {
            delete config[key]
            fs.writeJSONSync(configPath, config)
          }
          console.log(`deleted: ${key}`)
          break
        }
        case 'list':
        case 'ls': {
          const config = readConfigContentJson(fs, configPath)
          if (config) {
            console.log('Config info:')
            if (!!options.json) {
              console.log(JSON.stringify(config, null, 2))
            } else {
              for (const key in config) {
                console.log(`${key}=${config[key]}`)
              }
            }
          }
          break
        }
      }
    },
    optionsMap: {
      '--json': '以 JSON 形式输出'
    },
    synopsisList: [
      'taro config set <key> <value>',
      'taro config get <key>',
      'taro config delete <key>',
      'taro config list [--json]'
    ],
  })
}

function displayConfigPath (configPath: string) {
  console.log(`Config path: ${configPath}`)
  console.log()
}

function readConfigContentJson (fs: any, configPath: string): Object | undefined {
  if (!fs.existsSync(configPath)) return undefined
  displayConfigPath(configPath)
  return fs.readJSONSync(configPath)
}
