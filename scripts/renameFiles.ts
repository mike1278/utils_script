import minimist from "minimist"
import {prompt} from "~/utils/commandUtils"
import {readFiles} from "~/utils/fileUtils"
import fs from "fs"

const validPath = (path: string | undefined) => !path || path === '?'

export default async (args: CommandArgs) => {
    let path = args?.path

    if (validPath(path)) {
        path = prompt('What is the path: ')
    }

    if (validPath(path)) {
        throw new Error('No path specified')
    }

    const search = prompt('What is the search text: ')
    const replace = prompt('What is the replace text: ')

    const files = await readFiles(path as string)

    for (const file of files) {
        fs.rename(`${path}/${file}`, `${path}/${file.replace(search, replace)}`, (err) => {
            console.error('Error renaming file: ', err)
        })
    }
}

interface CommandArgs extends minimist.ParsedArgs {
    path?: string
}