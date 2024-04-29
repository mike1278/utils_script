import minimist from 'minimist'

export default interface ImportScript {
    fileName: string
    alias: string
    script: (args: minimist.ParsedArgs) => Promise<void>
}
