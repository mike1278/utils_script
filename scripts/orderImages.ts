import minimist from "minimist"
import {prompt} from "~/utils/commandUtils"
import {readFiles} from "~/utils/fileUtils"
import fs from "fs"
import Exiftool from "exiftool-vendored"

const exiftool = new Exiftool.ExifTool({taskTimeoutMillis: 5000})

const validPath = (path: string | undefined) => !path || path === '?'

const isImage = (file: string) => {
    const ext = file.split('.').pop()

    if (!ext) {
        console.log('Invalid file extension: ', file)
        return false
    }

    return ['jpg', 'jpeg', 'png', 'raw', 'webp', 'tiff', 'gif'].includes(ext)
}

export default async (args: CommandArgs) => {
    let path = args?.path ?? prompt('What is the path: ')

    if (validPath(path)) {
        throw new Error('No path specified')
    }

    const files = (await readFiles(path as string))
        .filter(file => isImage(file))

    for (const file of files) {
        await exiftool.read(file).then(result => {
            console.log(`${file}: `, result)
        }).catch(error => {
            console.log('Error reading file: ', error)
        })
    }
}

interface CommandArgs extends minimist.ParsedArgs {
    path?: string
}