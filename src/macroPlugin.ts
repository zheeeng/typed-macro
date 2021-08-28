import type { Plugin, ViteDevServer } from 'vite'
import { MacroProvider } from '@/macroProvider'
import { DevServerHelper, getDevServerHelper } from '@/helper/server'
import { Runtime } from '@/core/runtime'

export type MacroPluginHooks = Omit<
  Plugin,
  'name' | 'enforce' | 'apply' | 'configureServer'
> & {
  configureServer?: (
    server: ViteDevServer,
    helpers: DevServerHelper
  ) => (() => void) | void | Promise<(() => void) | void>
}

export type InternalPluginOptions = {
  name: string
  runtime: Runtime
  hooks: MacroPluginHooks
}

export interface MacroPlugin extends Plugin {
  __consume: () => MacroProvider
}

interface InternalMacroPlugin extends MacroPlugin {
  __internal_macro_plugin: true
}

export function macroPlugin(options: InternalPluginOptions): MacroPlugin {
  const {
    name,
    hooks: {
      buildStart,
      configResolved,
      configureServer,
      transform,
      load,
      resolveId,
      ...otherHooks
    },
  } = options

  let runtime: Runtime | undefined = options.runtime

  return {
    __internal_macro_plugin: true,
    __consume() {
      if (!runtime) throw new Error(`plugin '${name}' is used more than once.`)
      const provider: MacroProvider = {
        id: name,
        exports: runtime.exports,
        hooks: {},
      }
      runtime = undefined
      return provider
    },
    name,
    enforce: 'pre',
    configResolved(config) {
      runtime?.setDevMode(config?.env?.DEV ?? false)
      return configResolved?.(config)
    },
    configureServer(server) {
      if (configureServer) configureServer(server, getDevServerHelper(server))
    },
    async buildStart(opt) {
      await Promise.all([
        runtime?.typeRenderer.write(),
        buildStart?.bind(this)(opt),
      ])
    },
    resolveId(id, importer, options, ssr) {
      const result = runtime?.handleResolveId(id)
      if (result) return result
      return resolveId?.bind(this)(id, importer, options, ssr)
    },
    load(id, ssr) {
      const result = runtime?.handleLoad(id)
      if (result) return result
      return load?.bind(this)(id, ssr)
    },
    transform(code, id, ssr) {
      const transformed = runtime?.handleTransform(code, id, ssr)
      return transform?.bind(this)(transformed ?? code, id, ssr) ?? transformed
    },
    ...otherHooks,
  } as InternalMacroPlugin
}

export function isMacroPlugin(o: unknown): o is MacroPlugin {
  return (o as any).__internal_macro_plugin ?? false
}