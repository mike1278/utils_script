import {spawn} from 'child_process'
import minimist from "minimist"

export default async (args: CommandArgs) => {
    if (args?.example == "false") {

    }
    const commandProcess = spawn('python', ["./some.py"])

    commandProcess.on('close', async (code) => {
        if (code != 0) {
            console.info(`Python exited with code ${code}`)
            return
        }

        //? other operations
    })
}

interface CommandArgs extends minimist.ParsedArgs {
    example?: string
}