import 'module-alias/register'
import 'dotenv/config'
import minimist from 'minimist'
import {readFiles} from "~/utils/fileUtils"
import type ImportScript from "~/types/importScript"

const consoleArguments = minimist(process.argv.slice(2))

if (consoleArguments._.length === 0) {
    console.info('No script specified')
    process.exit(1)
}

const executeScript = consoleArguments._[0]

const execute = async () => {
    const importedFiles: ImportScript[] = []

    await readFiles('./scripts').then(async (scripts) => {
        for (const name of scripts) {
            const {default: script, alias} = await import(`./scripts/${name}`)

            importedFiles.push({
                fileName: name,
                alias: alias ?? name.replace('.ts', ''),
                script
            })
        }
    })

    const script = importedFiles.filter(file => file.alias === executeScript)[0]

    if (!script) {
        console.error('Script not found')
        process.exit(1)
    }

    console.log('Running script: ', executeScript)

    await script.script(consoleArguments)
}

execute()
    .then(() => {
        console.info('Done!')
        process.exit(0)
    })
    .catch(e => {
        console.error('Error: ', e)
        process.exit(1)
    })