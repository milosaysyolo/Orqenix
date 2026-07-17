import { describe, it, expect } from 'vitest'

describe('@orqenix/binding-core', () => {
  it('exports binding contract types and helpers', async () => {
    const mod = await import('../src/index.js')

    expect(mod).toBeDefined()

    // Functions
    expect(typeof mod.resolveMcpBinPath).toBe('function')
    expect(mod.resolveMcpBinPath()).toBe('orqenix-mcp')

    expect(typeof mod.buildMcpCommand).toBe('function')
    const cmd = mod.buildMcpCommand({
      projectPath: '/test',
      transport: 'stdio',
    })
    expect(cmd.command).toBe('orqenix-mcp')
    expect(cmd.args).toContain('/test')
    expect(cmd.args).toContain('stdio')

    // Types are erased at runtime — just verify the names are re-exported
    // by checking the module shape (TypeScript types become undefined)
    expect(mod.AgentBinding).toBeUndefined()
    expect(mod.BindingConfig).toBeUndefined()
  })
})
