import { isMacro, Macro } from '@/core/macro'

export type NamespacedMacros = { [namespace: string]: Macro[] }

export type NamespacedModules = { [namespace: string]: string }

export type NamespacedTypes = {
  [namespace: string]: {
    moduleScope: string[]
    macroScope: string[]
  }
}

export type Exportable = (
  | {
      /**
       * as macros
       */
      macros: Macro[]
    }
  | {
      /**
       * as module, code will be used as source code of the module
       */
      code: string
    }
) & {
  /**
   * Type definitions, will be written to d.ts.
   *
   * e.g.
   * ```typescript
   * { exports: { '@macros': { customTypes: `type A = string` } } }
   * ```
   * will generate
   * ```typescript
   * declare module '@macros' {
   *   type A = string
   * }
   * ```
   */
  customTypes?: string
}

export type NamespacedExportable = { [namespace: string]: Exportable }

export type NormalizedExports = {
  macros: NamespacedMacros
  modules: NamespacedModules
  types: NamespacedTypes
}

export function normalizeExports(
  exports: NamespacedExportable
): NormalizedExports {
  const macros: NamespacedMacros = Object.create(null)
  const modules: NamespacedModules = Object.create(null)
  const types: NamespacedTypes = Object.create(null)
  Object.keys(exports).forEach((ns) => {
    const item = exports[ns]
    types[ns] = {
      moduleScope: item.customTypes ? [item.customTypes] : [],
      macroScope: [],
    }
    if ('code' in item) {
      modules[ns] = item.code
    } else {
      macros[ns] = item.macros.map((m) => ({ name: m.name, apply: m.apply }))
      types[ns].macroScope = item.macros.map((m) => {
        if (!isMacro(m)) throw new Error(`${m.name} is not a macro`)
        return m.__types
      })
    }
  })

  assertNoConflictMacro(macros)

  return {
    macros,
    modules,
    types,
  }
}

export function assertNoConflictMacro(macros: NamespacedMacros) {
  Object.keys(macros).forEach((ns) => {
    const mem = Object.create(null)
    macros[ns].forEach((m) => {
      if (mem[m.name]) {
        throw new Error(
          `a macro with name '${m.name}' in '${ns}' already existed`
        )
      }
      mem[m.name] = 1
    })
  })
}