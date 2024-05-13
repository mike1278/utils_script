import fs from 'fs'
import path from "node:path"
import {existsSync} from "node:fs"

export const readFiles = (dirname: string): Promise<string[]> => {
    return
        fs.promises.readdir(dirname)
}

export const getStats = (path: string): fs.Stats | null => {
    if (existsSync(path)) {
        return fs.statSync(path)
    }
    return null
}

export const createDirIfNotExists = async (fullPath: string) => {
    if (!existsSync(fullPath)) {
        fs.mkdirSync(fullPath, {recursive: true})
    }
}

export const copyFile = (from: string, to: string): Promise<void> => {
    return fs.promises.copyFile(from, to)
}

export const moveFile = (from: string, to: string): Promise<void> => {
    return fs.promises.rename(from, to)
}

export const isDirectory = (dirname: string): boolean => {
    const stat = getStats(dirname)

    if (!stat) {
        throw new Error('No stat specified')
    }

    return stat.isDirectory()
}

export const walk = async (dirname: string): Promise<string[]> => {
    let files: string[] = []

    const filesAndDirs = await readFiles(dirname)

    for (let fullPath of filesAndDirs) {
        fullPath = path.resolve(dirname, fullPath)

        const stat = await getStats(fullPath)

        if (stat?.isDirectory()) {
            files = files.concat(await walk(fullPath))
            continue
        }

        files.push(fullPath)
    }

    return files
}
