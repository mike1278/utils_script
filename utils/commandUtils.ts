import promptSync from 'prompt-sync'

export const prompt = promptSync({ sigint: true })

export const getEnv = (env: string, defaultValue: any | null = null) =>
    process.env[env] ?? defaultValue ?? prompt(env + ': ')
